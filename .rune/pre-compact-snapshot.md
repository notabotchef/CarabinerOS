# Pre-Compact Snapshot
Generated: 2026-03-25T02:59:14.409Z

## Session Metrics
- Tool calls: 38
- Session start: 2026-03-25T01:56:53.657Z
- Top tools: unknown(38)

## State Files (preview)
### .rune/progress.md
# Progress

## [2026-03-24] Session 8 Summary — UI Polish + Integration Architecture

**Completed:**
- [x] Polaroid tactile card redesign — `rounded-[13px]`, shadow depth, module pill badges, no left-border KDS style
- [x] Card bottom spacing fix — removed `aspect-[4/5]` causing empty space below content
- [x] Send button consistency — gradient `ArrowUp` matching chatbot composer on collapsed cards
- [x] Expanded card redesign — matched CarabinerOS design language: glass input, gradient buttons, ChevronLeft back, no monospace
- [x] Sidebar unified scroll — moved `overflow-y-auto` to single wrapper around modules + conversations
- [x] Menu page runtime fix — guarded `PERF_CFG[performance]` with `?? PERF_CFG.Dog` fallback
- [x] Integration research — 15 restaurant platforms evaluated (Toast, OpenTable, Square, Google, 7shifts, Clover, DoorDash, Uber Eats, etc.)
- [x] Integration architecture doc — `docs/plans/integration-architecture.md`: OAuth flow, encrypted token storage, MCP server pattern, build order, legal considerations
- [x] Google Stitch explored — used for Polaroid Tactile action card design mockup, fetched via MCP
- [x] Roadmap refresh — `docs/plans/open-work.md` updated with all session 8 work + integration roadmap

**Key Architecture Decision:**
- Third-party integrations use OAuth-based MCP servers (one per platform)
- `restaurant_integrations` table stores AES-256 encrypted tokens per location per platform
- Build order: Google Suite → Square → 7shifts → Toast (after partner approval) → OpenTable
- Browser automation viable for dev/demos; official APIs for production
- Settings/integrations page needed for "Connect your Toast" onboarding flow

**Open Bug (carried from session 6):**
- [ ] Action cards not reaching frontend from A0 — auto-emit extension fires server-side but cards don't appear
- [ ] A0 still calls `call_subordinate` for card formatting — system prompt should tell it the extension handles this

**Still Open:**
- [ ] Migration 009 not yet run
- [ ] Expo filtering not started
- [ ] Docker image bloat (15GB) — needs .dockerignore additions

**Next Session Should:**
1. Fix Docker image bloat — add `frontend/`, `rune-business/`, `rune-pro/`, `docs/`, `.claude/` to `.dockerignore`
2. Debug action card frontend delivery — the original open bug from session 6
3. Start `restaurant_integrations` DB migration
4. Build settings/integrations page skeleton
5. Start Google Suite MCP (first integration — zero approval gate)
6. Run migration 009

## [2026-03-22 03:45] Session 6 Summary — Action Cards Infrastructure + Critical Fixes

**Completed:**
- [x] MCP type coercion — Decimal/int/UUID from strings (generic column inspection)
- [x] UUID double-wrapping fix — `_parse_uuid()` handles `UUID('...')` repr format
- [x] `action_card` tool — LLM-driven structured card emission via Socket.IO
- [x] Tool prompt (`agent.system.tool.action_card.md`) + system prompt extension
- [x] Module icons on cards — lucide icons matching sidebar nav
- [x] Card-stack arrival animation — top-bar icon flips with type color
- [x] Card list entry/exit animations (spring slide+fade)

### .rune/decisions.md
# Decisions Log

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
**Impact:** requirements.txt

## [2026-03-21 17:30] Decision: Single orchestrator pattern for Claude Code

**Context:** Running two Claude Code sessions on the same repo caused branch conflicts and file corruption
**Decision:** One Claude Code session at a time. Delegated agents use `isolation: "worktree"` for parallel work.
**Rationale:** Git has one working tree — concurrent checkouts corrupt each other's state.
**Impact:** Workflow pattern, not code. Saved in memory for future sessions.

## [2026-03-21 20:30] Decision: Bridge notify_user → action cards instead of Expo JSON parsing

**Context:** We built an Expo extension that parses tool response JSON for action card data, but it's fragile (JSON extraction, prompt engineering for raw JSON output). Meanwhile, A0 has a built-in `notify_user` tool that it naturally uses to send structured notifications with title, message, type, priority.
**Decision:** Create a post-tool extension that intercepts `notify_user` calls and converts them to action card Socket.IO events. Keep the existing Expo extension as a secondary path.
**Rationale:** A0 already WANTS to notify the user — it used notify_user spontaneously when it created the rush order (27B local model, no prompting). Fighting that instinct (forcing Expo to output raw JSON) is harder than riding it. The type mapping is clean: success→update, warning→urgent, info→info.
**Impact:** New extension in usr/extensions/tool_execute_after/ that hooks notify_user → action_card emit. Frontend action card system unchanged. Expo extension remains as fallback.
**Evidence:** A0 session 2026-03-21 — installed PostgreSQL, created schema from memory, inserted order, used notify_user to alert chef. The notification pattern was correct on first try.

## [2026-03-22 00:00] Decision: Two-path action card architecture

**Context:** Original plan was a Python extension that parses tool response text into action cards (fragile JSON extraction). User feedback: "A0 has an LLM brain — let it decide." But then subordinate token cost became a concern.
**Decision:** Two complementary paths: (1) Auto-emit extension detects DB writes (`db_mutate`, `*_create`, `*_update`, `*_delete`) and constructs cards from structured MCP response — zero extra LLM tokens. (2) `action_card` tool stays available for proactive LLM-driven notifications (menu ideas, reminders, email alerts) that aren't DB writes.

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
- **Auto-emit**: DB write tools (`db_mutate`, `*_create`, `*_update`, `*_delete`) auto-generate cards via `_30_action_card_emit.py` extension — zero extra LLM tokens
- **Proactive**: A0 calls `action_card` tool for non-DB notifications (menu ideas, reminders, alerts)
- **sio access**: Always walk agent hierarchy to find sio — subordinates don't have it directly
- **Card types**: urgent (amber), action (blue), update (emerald), info (violet)
- **Frontend**: `useActionCards` hook, sessionStorage persistence, 2-col solitaire grid with flip expand
- **Visual identity**: Kitchen Display System aesthetic — left-border station colors, monospace labels, "Tickets/FIRE/Cleared" vocabulary
- **Action buttons**: ✗ (red/dismiss) + ✓ (green/commit) + contextual action label per type+module (e.g., "86 It", "Order Now", "Approve")
- **Chat suggestions**: `getDefaultSuggestion(card)` + `getDefaultChips(card)` — type+module lookup map for pre-fill and quick-action chips
