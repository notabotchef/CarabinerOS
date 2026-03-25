# Pre-Compact Snapshot
Generated: 2026-03-25T08:30:35.770Z

## Session Metrics
- Tool calls: 136
- Session start: 2026-03-25T06:16:47.939Z
- Top tools: unknown(136)

## State Files (preview)
### .rune/progress.md
# Progress

## [2026-03-25] Session 9 Summary — Action Cards End-to-End Fix

**Completed:**
- [x] Debugged action card delivery — root cause: `snapshot.notifications` never consumed by frontend (data arriving, thrown on floor)
- [x] Collapsed expo subordinate into A0 direct `notify_user` calls — saves ~800-1000 tokens per notification
- [x] Updated `_25_restaurant_context.py` — A0 calls `notify_user` directly, no more `call_subordinate(profile="expo")`
- [x] Expanded `A0Notification` type to match backend `NotificationItem.output()` (title, detail, priority, display_time, etc.)
- [x] `useSocket` now extracts `snapshot.notifications` from `state_push` events
- [x] `useActionCards` converts `A0Notification[]` → `ActionCard[]` with type mapping (success→update, warning→urgent, etc.)
- [x] Wired notifications through `SocketProvider` context → `Shell` → `useActionCards`
- [x] Slimmed ALL MCP `*_list` responses — `_slim()` strips 13 heavy JSONB/Text columns (line_items, detail_points, summary, etc.)
- [x] `orders_list` token reduction: 3,103 → ~400-500 tokens (6 orders)
- [x] Disabled auto-emit extension primary path to prevent duplicate cards (notify_user + auto-emit were both creating cards)
- [x] Fixed card UI: removed `aspect-[4/5]` gap, hidden Sheet close button (duplicate X), cleaned card animations
- [x] Rewrote notification panel animations — removed `layoutId`/`LayoutGroup` conflicts, clean spring enter/exit
- [x] Verified end-to-end: user prompt → A0 DB write → A0 calls `notify_user` → `state_push` → frontend card appears
- [x] Expo prompt updated to use `notify_user` tool (kept for scheduled proactive sweeps)

**Key Architecture Decisions:**
- A0 calls `notify_user` directly after DB writes (no subordinate delegation)
- Notifications flow via existing `state_push` → `snapshot.notifications` (same pipe as chat streaming)
- MCP `*_list` tools return summary-only fields; `*_get` returns full objects
- Auto-emit extension disabled (A0 direct notification is the single path)

**Known Issues (to fix):**
- [ ] `inventory_create` type coercion — A0 passes int for VARCHAR columns, requires retry (MCP layer should coerce)
- [ ] A0 unnecessarily calls `*_list` before create operations (e.g., lists all 48 inventory items before adding 1)
- [ ] Token cost still high (~$600/mo estimate for real restaurant scale) — needs RAG/pagination/smarter tool selection
- [ ] Card module badge shows "GENERAL" — notify_user `group` field not set by A0, needs prompt guidance
- [ ] Record IDs visible in card detail text — A0 should not include UUIDs in user-facing notifications

**Still Open (carried):**
- [ ] Migration 009 not yet run
- [ ] Full walkthrough all 8 modules — visual QA
- [ ] Wire ModuleChat into remaining 7 modules
- [ ] Apply "Make It Nice" to empty states, loading, errors
- [ ] Daily Brief — A0 scheduled task
- [ ] Settings/integrations page skeleton

**Next Session Should:**
1. Fix A0 unnecessary `*_list` calls before creates — update system prompt to say "don't list before creating"
2. Fix `inventory_create` type coercion in MCP layer (auto-cast int→str for VARCHAR columns)
3. Add `group` field guidance to A0 prompt so cards show correct module badge
4. Strip UUIDs from A0 `notify_user` detail text via prompt guidance
5. Token cost reduction: pagination on `*_list`, or RAG-based tool selection
6. Visual QA all 8 modules on :8080

## [2026-03-24] Session 8 Summary — UI Polish + Integration Architecture

### .rune/decisions.md
# Decisions Log

## [2026-03-25] Decision: A0 direct notify_user (no expo subordinate)

**Context:** Expo subordinate agent added ~800-1000 tokens per notification for a second LLM call that just reformatted data A0 already had. Expo also failed on first try (passed unsupported `priority` field), wasting another ~300 tokens.
**Decision:** A0 calls `notify_user` directly after DB writes. No subordinate delegation for reactive notifications. Expo agent kept for scheduled proactive sweeps only.
**Rationale:** A0 has all the context — vendor name, item counts, deadline. Spawning a subordinate to reformat is pure overhead. The notify_user tool is simple (title, message, detail, type). A0 can assess urgency inline.
**Impact:** `usr/extensions/system_prompt/_25_restaurant_context.py` (prompt change), `usr/extensions/tool_execute_after/_30_action_card_emit.py` (auto-emit disabled). Frontend unchanged — consumes `snapshot.notifications` from `state_push`.

## [2026-03-25] Decision: Slim MCP list responses

**Context:** `orders_list` returned 3,103 tokens for 6 orders (full line_items JSONB, detail_points, summary, prompt). A real restaurant with 50+ orders would cost thousands in tokens monthly. `inventory_list` was even worse: 10,219 tokens for 48 items.
**Decision:** All `*_list` MCP tools strip 13 heavy columns (line_items, detail_points, prompt, summary, extracted_data, gl_codes, media_urls, components, steps, ingredients, notes, equipment, tags, events). `*_get` tools return full objects.
**Rationale:** LLM only needs summary fields to decide what to do. Full detail is fetched on demand via `*_get`. This is a 75-85% token reduction on list calls.
**Impact:** `carabiner/mcp/server.py` — `_slim()` helper applied to 13 list endpoints. No model or repository changes.

## [2026-03-25] Decision: Notifications via state_push (not separate Socket.IO events)

**Context:** Action cards were delivered via direct `sio.emit("action_card")` on `/state_sync` — but CSRF cookie validation was rejecting CarabinerOS's socket connections. Chat streaming worked because it uses the same `state_push` mechanism.
**Decision:** Notifications flow through the existing `state_push` → `snapshot.notifications` pipeline. Frontend reads notifications from the same events that deliver chat. No new socket events, no new handshakes.
**Rationale:** The pipe already works (chat proves it). Adding a second delivery mechanism (direct `action_card` emit) introduced CSRF issues and duplicate cards. Single path = simple path.
**Impact:** `frontend/src/hooks/use-action-cards.ts` (consumes `snapshot.notifications`), `frontend/src/hooks/use-socket.ts` (exposes notifications), `frontend/src/components/socket-provider.tsx` (context). Auto-emit extension disabled.

## [2026-03-24] Decision: Self-extending plugin architecture

**Context:** CarabinerOS needs integrations with Toast, OpenTable, Square, Google, 7shifts, etc. Building each one manually doesn't scale. A0 can already write code at runtime.
**Decision:** A0 creates integrations autonomously by writing MCP servers + manifest files to `usr/plugins/`. The frontend dynamically discovers and renders plugin data via a generic PluginWidget — zero React code per integration. Manifests define UI presence, auth config, and natural language routing.
**Rationale:** This makes CarabinerOS a self-extending platform. Traditional SaaS: feature request → 6 weeks. CarabinerOS: user request → A0 builds overnight → live tomorrow. The competitive moat is the ability to build ANY integration on demand.
**Impact:** `docs/plans/self-extending-architecture.md` (full spec), `docs/plans/integration-architecture.md` (OAuth/token details). Build order: manifest schema → plugin discovery API → generic widget → settings page → MCP scaffolding tool → overnight agent.
**Constraints:** A0 can only write to `usr/plugins/`. Cannot modify frontend, domain code, core, auth, or database schema without approval.

## [2026-03-21 16:00] Decision: Use remark-gfm for markdown table rendering

**Context:** CarabinerOS chat rendered markdown tables as raw pipe-delimited text instead of formatted HTML tables
**Decision:** Added remark-gfm plugin to ReactMarkdown and CSS table styles using existing theme variables
**Rationale:** GFM tables are not standard markdown — require remark-gfm plugin. CSS-only approach keeps it simple.
**Impact:** frontend/src/components/message-list.tsx, frontend/src/app/globals.css

## [2026-03-21 16:30] Decision: Use relative venv path for MCP config

**Context:** MCP carabiner_db command used absolute path to venv python, breaking portability across machines and Docker
**Decision:** Changed to `.venv/bin/python` (relative) in usr/settings.json, added settings.local.json pattern for overrides
**Rationale:** Docker uses `python` (system), local dev uses `.venv/bin/python`. Relative path works for local dev; Docker overrides via its own config.
**Impact:** usr/settings.json, .gitignore, usr/settings.local.json.example

## [2026-03-21 17:00] Decision: Unpinned litellm/openai/starlette in requirements.txt

**Context:** requirements.txt had `>=` floor pins that conflicted with exact pins in requirements2.txt (used by Docker)
**Decision:** Use unpinned entries (just package name) so requirements2.txt wins in Docker builds
**Rationale:** requirements2.txt is the authoritative source for Docker version pins. Our entries just ensure the packages are listed.

### .rune/conventions.md
# Conventions

## Python (Backend)
- **Naming**: snake_case for functions/variables, PascalCase for classes and enums
- **Type hints**: Modern Python 3.10+ union syntax (`str | None`), full annotations on public APIs
- **Imports**: Absolute from project root (`from python.helpers import ...`, `from carabiner.db.models import ...`)
- **Async**: Uses `asyncio` + `nest_asyncio` for nested event loops; async throughout DB and API layers
- **API handlers**: Class-based, inheriting `ApiHandler`, with `async def process(...)` entry point
- **API responses**: Dict-based `{"ok": True, "data": ...}` or `{"ok": False, "error": "..."}`
- **ORM models**: SQLAlchemy 2.0 declarative with UUID primary keys, `TimestampMixin`, `LocationScopedMixin`
- **Serialization**: Pydantic v2 schemas in `carabiner/api/schemas.py` for API output
- **Error handling**: try/except in API handlers with explicit Exception raising
- **Extensions**: Add behavior via `usr/extensions/` (system_prompt, tool_execute_after, etc.) — never modify A0 core files

## TypeScript/React (Frontend)
- **Component naming**: PascalCase functions, kebab-case filenames (e.g., `action-card.tsx` -> `ActionCard`)
- **Imports**: ESM with path alias `@/*` -> `./src/*`
- **State management**: React Context + custom hooks (no Redux/Zustand)
- **Hooks pattern**: `use-[name].ts` files exporting a single hook
- **UI library**: shadcn/ui components in `components/ui/`, customized via `globals.css` CSS variables
- **Real-time**: Socket.IO client singleton in `lib/socket-client.ts`, consumed via `useSocket` hook
- **Types**: Centralized in `lib/types.ts`
- **Markdown**: ReactMarkdown with remark-gfm for GFM table support

## Testing
- **Framework**: pytest with `@pytest.mark.asyncio` for async tests
- **Structure**: Separate `tests/` directory (not co-located)
- **Naming**: `test_*.py` files with `test_` prefixed functions
- **Style**: Function-based (no test classes)
- **Frontend**: No frontend tests configured

## Git
- **Commit style**: Conventional commits (`feat(scope):`, `fix(scope):`, `chore:`)
- **Branching**: Agents use feature branches or worktrees; user works on main
- **Dependencies**: requirements2.txt has exact Docker pins; requirements.txt uses flexible pins

## Development
- **Local dev**: `pnpm dev` (frontend :3000) + `.venv/bin/python run_ui.py` (backend :5000)
- **Docker**: `docker compose -f docker-compose.dev.yml up` — serves on :8080 via nginx
- **Preferred**: Docker (port 8080) — handles all proxying correctly

## Action Cards
- **Delivery**: A0 calls `notify_user` directly after DB writes → `NotificationManager` → `state_push` → `snapshot.notifications` → frontend converts to `ActionCard`
- **No subordinate**: Expo agent is NOT used for reactive notifications. A0 handles urgency assessment inline. Expo reserved for scheduled proactive sweeps only.
- **No auto-emit**: `_30_action_card_emit.py` primary path disabled. Single notification path via `notify_user`.
- **Card types**: urgent (amber), action (blue), update (emerald), info (violet)
- **Type mapping**: A0 `notify_user` type → card type: warning→urgent, error→urgent, success→update, info→info, progress→info
- **Frontend**: `useActionCards` hook, sessionStorage persistence, 2-col grid with spring enter/exit animations
- **Visual identity**: Kitchen Display System aesthetic — monospace labels, "Tickets/FIRE/Cleared" vocabulary
- **Action buttons**: ✗ (red/dismiss) + ✓ (green/commit) + contextual action label per type+module (e.g., "86 It", "Order Now", "Approve")
