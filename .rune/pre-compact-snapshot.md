# Pre-Compact Snapshot
Generated: 2026-04-01T01:27:00.128Z

## Session Metrics
- Tool calls: 59
- Session start: 2026-03-31T20:38:56.084Z
- Top tools: unknown(59)

## State Files (preview)
### .rune/progress.md
# Progress

## [2026-03-31] Session 12 — Stabilization, Cleanup, and Architecture Decision

**Completed:**
- [x] Fixed API 404s — blueprint registration moved to run_ui.py startup
- [x] Fixed CSRF endpoint — nginx proxies /csrf_token → /api/csrf_token
- [x] Eliminated codex_proxy — removed from settings.json, _model_config, Dockerfile, .env
- [x] Fixed Socket.IO chat — added `handlers: ["ws_webui"]` to auth (A0 v1.11 requirement)
- [x] Fixed plugin installer — removed stale `from turtle import stamp` import
- [x] Docker self-update infrastructure — .git in image, /exe/ scripts, git index synced, stash-safe
- [x] Fixed startup hang — HF_HUB_OFFLINE=1, hf_cache volume, asyncio.new_event_loop for DB init
- [x] Cleaned 85 branches → 1, 40 worktrees → 1 (16.6 GB reclaimed), 10 stashes → 0
- [x] Closed 5 open PRs — documented in docs/future-work/closed-prs-2026-03-31.md
- [x] Moved 22 research docs from root to docs/research/
- [x] CarabinerOS README replacing upstream A0 README
- [x] All changes committed and pushed to GitHub

**Still Broken (carried to Session 13):**
- [ ] Chat message rendering — Socket connects, state_push received, but cOS chat page renders blank
- [ ] DB route async errors — food-cost/summary, prep/today return 500 (event loop conflict)
- [ ] Home page — Daily Brief and stats widgets not rendering
- [ ] Model config — openrouter with wrong api_base, needs OpenRouter key or switch to local Ollama
- [ ] Self-update — version detection works but actual update untested

**Key Architecture Decision:**
CarabinerOS was built INSIDE Agent Zero (fork-and-merge), not ON TOP of it. Every fix this session revealed another A0 protocol incompatibility (API paths, WebSocket handlers, config migration, event loop). Decision: **clean rebuild on fresh A0 v1.6** with plugin-only architecture. Zero patches to A0 core files.

**Next Session Should:**
1. Fresh clone of agent0ai/agent-zero at v1.6 tag
2. Set up as git submodule at engine/agent-zero/
3. Create usr/plugins/carabiner/ plugin (DB init, API routes via plugin lifecycle)
4. Reconnect frontend to stock A0 WebSocket protocol
5. Verify: chat works, DB routes return data, module pages render
6. Session 13 starter prompt saved in conversation

---

## [2026-03-28] Session 11 — Tiny Router Build + A0 Personal Instance Setup

**Completed:**
- [x] Deleted OpenClaw — processes, launchd agent, npm package, `~/.openclaw/`, Docker images (~13GB reclaimed)
- [x] Home directory audit — identified ~72GB of stale files (a0/, a0backup/, a0dev/, agent-zero/, carabiner-os.zip, .ollama, .gemini, .codex, .antigravity)
- [x] Cleaned Docker images — removed old agent0ai/agent-zero (8.25GB), stale worktree build (4.74GB), curlimages/curl
- [x] Built `a0-tiny-router` plugin — full ONNX inference pipeline using upstream `tgupj/tiny-router` (DeBERTa-v3-small, 44M params)
- [x] Extracted inference-only functions into `tiny_router_helpers/upstream.py` — no torch/datasets dependency at runtime
- [x] Downloaded INT8 ONNX model (172MB) from HuggingFace, verified 6-7ms inference inside A0 container
- [x] 20/20 tests passing (12 routing logic + 8 smoke tests with real model)
- [x] Made plugin A0-spec-compliant: renamed to `tiny_router`, `usr.plugins.*` imports, Store Gate webui, LICENSE, execute.py
- [x] Installed in personal A0 at `/Users/estebannunez/agent-zero/a0/usr/plugins/tiny_router/`

### .rune/decisions.md
# Decisions Log

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

## [2026-03-31] Decision: All A0 Endpoints Moved to /api/ Prefix

**Context:** CarabinerOS nginx and Next.js rewrites pointed to bare paths (/message_async, /chats, /csrf_token). All returned 404 or 405.
**Decision:** A0 v1.11 moved all endpoints under /api/. Updated nginx.dev.conf and frontend/next.config.ts to proxy to /api/ prefixed paths.
**Rationale:** A0's register_api_route() registers a catch-all /api/<path> dispatcher. Bare paths like /message_async don't exist — they're at /api/message_async.
**Impact:** nginx.dev.conf (7 location blocks), frontend/next.config.ts (7 rewrites)

## [2026-03-28] Decision: Tiny Router A0 Plugin — Inference-Only Extraction

**Context:** The upstream `tgupj/tiny-router` package requires torch, datasets, and other heavy ML deps. At runtime in A0, only ONNX inference is needed.
**Decision:** Extract only the inference-path functions (`prepare_record`, `scale_logits`, `canonicalize_action`, `normalize_interaction`, `build_prompt`) into `tiny_router_helpers/upstream.py`. Keep upstream as git submodule for reference. Runtime deps: only onnxruntime, transformers, sentencepiece, numpy.
**Rationale:** Avoids ~2GB torch dependency in A0 container. The extracted functions are pure Python + numpy — no torch needed for ONNX inference.
**Impact:** `tiny_router_helpers/upstream.py` (standalone), `vendor/tiny-router/` (submodule reference only)

## [2026-03-28] Decision: Codex Proxy Startup at monologue_start

**Context:** Codex proxy started at `message_loop_start` via `_10_codex_proxy.py`. LiteLLM tried to connect to `127.0.0.1:8400` before the proxy was listening, causing connection refused errors.
**Decision:** Added `monologue_start/_05_codex_proxy_boot.py` that starts the proxy once per conversation before any message loop iteration.
**Rationale:** `monologue_start` fires before the message loop begins. By the time `message_loop_start` → LLM call happens, the proxy is already listening.
**Impact:** `/a0/usr/plugins/codex-provider/extensions/python/monologue_start/_05_codex_proxy_boot.py`

## [2026-03-28] Decision: Ollama num_ctx Must Be Passed via kwargs

**Context:** A0's `ctx_length` in model config controls how much history A0 sends to the LLM. But Ollama independently allocates its own context window — defaulting to 65K for GLM-30B (~26GB RAM). This caused OOM and hangs.
**Decision:** Pass `num_ctx` directly to Ollama via the model config `kwargs` field: `{"kwargs": {"num_ctx": 8192}}`. This controls Ollama's actual memory allocation.
**Rationale:** A0's `ctx_length` and Ollama's `num_ctx` are independent settings. Without explicit `num_ctx` in kwargs, Ollama uses the model's default (65K for GLM), regardless of what A0 sends.
**Impact:** `_model_config/config.json` — `kwargs.num_ctx` for both chat and utility models

## [2026-03-28] Decision: Phase 1 Tiny Router — Log Only, No LLM Skip

**Context:** The upstream model is trained on synthetic data (F1: 0.78, exact match: 0.46). Routing decisions might be wrong for real restaurant messages.
**Decision:** Phase 1 logs every classification but never skips the LLM. Phase 2 (configurable via plugin settings UI) will actually skip for canned responses once thresholds are validated.
**Rationale:** Collect real classification data before trusting the model with cost-saving decisions. A wrong canned response ("Got it.") to an actual question would be worse than the token cost savings.
**Impact:** Extension logs `WOULD skip LLM -> "Got it." (Phase 1: pass-through)` — visible in logs for threshold tuning

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
