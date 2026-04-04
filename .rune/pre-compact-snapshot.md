# Pre-Compact Snapshot
Generated: 2026-04-03T05:02:46.485Z

## State Files (preview)
### .rune/progress.md
# Progress

## [2026-04-02] Session 15 — Action Cards v2 + Chat Context Link

**Completed:**
- [x] Action Cards v2: A0 sends structured JSON in notify_user.detail (actions, stats, changes, chips)
- [x] Frontend notificationToCard() parses rich card payload → contextual action buttons
- [x] Module badge now uses group field from A0 (no more "GENERAL")
- [x] Extensions moved to usr/extensions/python/ (correct A0 overlay path)
- [x] New _20_inject_location.py: injects active location into A0 context per-message
- [x] _30_action_card_emit.py disabled — A0 direct notify_user is the single card path
- [x] ChatContextMixin: nullable chat_context_id column on all workspace models
- [x] System prompt injects context ID → A0 passes --chat-context on all writes
- [x] ModuleChat accepts chatContextId prop, subscribes to the record's conversation
- [x] CLI orders/prep accept --chat-context flag
- [x] 4 agent prompts updated: context ID + card JSON schema
- [x] MiroShark sim2 report committed

**Also Completed (same session):**
- [x] Fixed: chat_context_id was missing from 7 Pydantic output schemas (OrderOut, InventoryOut, PrepOut, MenuOut, CampaignOut, InvoiceOut, RecipeOut) — Chat Context Link now flows end-to-end
- [x] Fixed: floating island nav — p-2→p-1.5, gap-2→gap-1, rounded-2xl→rounded-xl, shadow-md→shadow-sm, removed cOS logo, buttons size-8→size-7

**Also Completed (session 16):**
- [x] GTM docs committed: NYC beta targets, distributor channel brief, liability framework
- [x] TypeScript build error fixed: order-detail-panel.tsx double-cast (tsc now clean)
- [x] Demo seeder parameterized: --restaurant-name flag for personalized NYC pitches
- [x] Demo runbook written: docs/gtm/demo-runbook.md (15-min script, recovery paths, sim-validated messaging)
- [x] Action card summary/detail fields corrected: title→summary (headline), message→detail (body) — was reversed in notify_user.py
- [x] Card timestamp fixed: emitting seconds not ms (frontend stale filter uses seconds)

**Still Needs Work:**
- [ ] Action cards: live test — does A0 produce valid JSON in notify_user.detail, does card render rich? (requires live stack)
- [ ] CLI write commands: test end-to-end (orders create via A0 chat)
- [ ] Real-time sync: cOS doesn't get state_push when conversation started in A0 WebUI

**Next Session Should:**
1. `docker compose -f docker-compose.dev.yml up` — bring stack up
2. Send "Draft a new order for Pacific Seafood for produce replenishment based on our par levels" in A0 chat
3. Verify: action card appears with title as headline, structured actions/stats visible
4. Verify: order appears in Orders page with chat_context_id, side-chat links to that conversation
5. Real-time sync: investigate why cOS misses state_push from A0 WebUI sessions

**Branch:** main (clean, pushed to GitHub)

---

## [2026-04-01] Session 14 — Get A0 + CarabinerOS Running (Full Stack Restoration)

**Completed:**
- [x] Rewrote Dockerfile.agent-zero → FROM agent0ai/agent-zero-base:latest (proper A0 pipeline)

### .rune/decisions.md
# Decisions Log

## [2026-04-01] Decision: CLI Replaces 63 MCP Tools

**Context:** 63 MCP tools inject ~14,000 tokens into every A0 prompt. No filtering — all tools, every message. This is the single biggest token cost.
**Decision:** Replace carabiner-db MCP server with `carabiner` CLI (Typer+Rich). A0 calls via code_execution. Grammar: `carabiner <resource> <verb> [--json]`.
**Rationale:** 35x token reduction in benchmarks (jannikreinhard.com). Claude Code itself uses CLI (git, gh, npm) — no MCP. LLMs trained on billions of terminal interactions — they know CLI natively.
**Impact:** carabiner/cli/ (14 new files), usr/settings.json (mcp_servers = {}), system prompt rewritten, knowledge doc added.

## [2026-04-01] Decision: Dockerfile Must Use agent0ai/agent-zero-base

**Context:** Custom python:3.12-slim Dockerfile missing tkinter, HF model cache, proper A0 runtime. Every rebuild reveals another missing dep. Plugin installer crashes, memory dashboard fails.
**Decision:** Build FROM agent0ai/agent-zero-base:latest (A0's own base image). Add CarabinerOS layer on top (usr/, carabiner/, pip deps).
**Rationale:** A0's base image has everything A0 needs. Mirrors production deployment — same base for all tenants, CarabinerOS as overlay.
**Impact:** Dockerfile.agent-zero must be rewritten. Docker-compose mounts remain the same.

## [2026-04-01] Decision: A0 ApiHandler Stubs via Startup Extension

**Context:** Frontend calls `/api/orders`, `/api/prep`, etc. A0's dispatch system looks for `ApiHandler` classes in `/a0/api/<path>.py`. CarabinerOS can't modify A0 engine files, and A0 has no hook to register Flask blueprints post-startup.
**Decision:** The `_10_carabiner_init.py` startup extension writes thin Python stub files to `/a0/api/` at boot. Each stub imports a factory from `carabiner/api/_a0_handlers.py` that generates A0-compatible `ApiHandler` classes wrapping the repository layer.
**Rationale:** Zero A0 engine modifications. Stubs are regenerated every boot (idempotent). A0's file-based dispatch natively loads them. Factory pattern keeps boilerplate minimal (~3 lines per resource).
**Impact:** `carabiner/api/_a0_handlers.py` (handler factory), `_10_carabiner_init.py` (stub writer), `next.config.ts` (detail rewrites `/api/orders/:id` → `?id=:id`)

## [2026-04-01] Decision: No Global DB Engine at Startup

**Context:** The startup_migration extension runs on a separate asyncio event loop (via `asyncio.new_event_loop()`). A0's uvicorn runs on a different loop. Calling `init_db()` at startup creates a global engine bound to the wrong loop, causing intermittent "attached to a different loop" errors on API requests.
**Decision:** Don't call `init_db()` at startup. Only run `Base.metadata.create_all` (table creation). Let `get_session()` fallback create per-request engines via its cross-loop detection.
**Rationale:** Per-request engines are slightly less efficient but 100% reliable. The startup extension and uvicorn will never share an event loop.
**Impact:** `carabiner/db/engine.py` (broadened error detection), `_10_carabiner_init.py` (removed `init_db()` call)

## [2026-04-01] Decision: Production Architecture — Per-Tenant A0 + Shared DB Cluster

**Context:** Planning how restaurants will deploy. Each restaurant needs isolated A0 (stateful: memory, chats) but infra should scale efficiently.
**Decision:** Per-tenant: own A0 container + own database. Shared: base image, frontend, DB cluster. CarabinerOS layer baked into image, per-tenant config via env vars. Stage 1: OpenRouter LLM, Stage 2: own inference at 500 users, Stage 3: fine-tuned restaurant LLM.
**Rationale:** A0 is stateful (memory, agent profiles per restaurant). Can't share one A0 across tenants. But base image + PostgreSQL cluster are shared efficiently.
**Impact:** Architecture supports 10→100→1000 restaurants. Infra cost: ~$1.50/restaurant/month at 100 tenants.

## [2026-03-31] Decision: Clean Rebuild — Fresh A0 v1.6 with Plugin-Only Architecture

**Context:** Session 12 spent 8+ hours patching A0 v1.11 incompatibilities. Every fix revealed another: API paths moved to /api/, WebSocket requires handlers array, _model_config overrides settings.json, event loops conflict between DeferredTask and SQLAlchemy async. The fork-and-merge architecture means CarabinerOS code is intermingled with A0 core at the repo root — every upstream change breaks us.
**Decision:** Clean rebuild. Fresh clone of agent0ai/agent-zero at v1.6 tag. CarabinerOS as plugin(s) in usr/plugins/carabiner/. Zero patches to A0 core files. Submodule or clean overlay architecture.
**Rationale:** Patching is unsustainable. The root cause is architectural — cOS built inside A0, not on top of it. A clean separation means: (1) A0 updates are a tag bump, not a merge nightmare, (2) all cOS code is clearly separated, (3) the plugin system is the designed extension point.
**Impact:** Entire repo structure changes. All A0 core files replaced with fresh upstream. CarabinerOS code preserved in carabiner/, frontend/, usr/. DB init and API routes move from run_ui.py patches to plugin init hooks.

## [2026-03-31] Decision: Socket.IO Requires handlers Array in Auth

**Context:** CarabinerOS frontend connected to A0 Socket.IO /ws namespace but received no state_push events. Chat was completely dead.
**Decision:** The auth callback must include `handlers: ["ws_webui"]` for A0 to activate the state sync handler. Without it, all events are silently dropped.
**Rationale:** A0's WebSocket dispatch checks `_active_handlers[sid]` — if empty (no handlers declared in auth), it returns early with "NO_HANDLERS" without processing any events. This was a protocol change in A0's newer versions that our frontend never knew about.
**Impact:** `frontend/src/lib/socket-client.ts` — auth callback sends `{ csrf_token, handlers: ["ws_webui"] }`

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
