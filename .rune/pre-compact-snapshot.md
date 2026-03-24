# Pre-Compact Snapshot
Generated: 2026-03-22T01:54:10.338Z

## Session Metrics
- Tool calls: 2
- Session start: 2026-03-22T01:53:17.687Z
- Top tools: unknown(2)

## State Files (preview)
### .rune/progress.md
# Progress

## [2026-03-21 22:00] Session 5 Summary — First Real Trial of CarabinerOS v3

**Completed:**
- [x] Hydration mismatch + script tag warnings fixed
- [x] Chat conversation loading confirmed working
- [x] Table data cards — briefing-style standalone cards outside chat bubbles
- [x] "Daily Briefing" → "Daily Brief"
- [x] Full system test (5 prompts) with live Docker log monitoring
- [x] Bug report: 16 bugs identified, cross-referenced with backend logs
- [x] **C1**: MCP carabiner_db tools available in Docker (env inheritance)
- [x] **C2**: Action card emission pipeline (sio injection + JSON extraction + Expo prompt)
- [x] **C3**: invoice_tool schema fix (Alembic migration 008)
- [x] **C4**: Homepage always creates fresh chat context
- [x] **H2**: Expo whispering streams steps in real-time
- [x] **H4**: ipython installed in Docker for code_execution_tool
- [x] **M2**: Duplicate message guard (sendingRef + 2s dedup)
- [x] Grey bar removed from expo ticket
- [x] MCP location_id auto-resolve for all create tools
- [x] Codex proxy plugin installed — GPT-5.3 brain for A0
- [x] Rune kit framework research — full capability documented
- [x] Architectural decision: notify_user → action cards bridge

**Stress Test Results (5 concurrent prompts with GPT-5.3 Codex):**
- [x] Frontend handled all 5 sessions — 43 requests, all 200s, 18-26ms
- [x] GPT-5.3 processes prompts in true parallel (interleaved streaming)
- [x] A0 self-healed database (started PostgreSQL when down)
- [x] Proper delegation: GM → Executive Chef with structured 7-point brief
- [x] Data-first: Executive Chef ran 3 tools before answering (food_cost, menu, reporting)
- [x] Read tools all work (inventory_list, orders_list, invoices_list, food_cost, menu, reporting)
- [ ] Write tools ALL FAILED — two bugs:
  - Type serialization: MCP binds all values as VARCHAR (breaks NUMERIC/INTEGER columns)
  - UUID double-wrapping: db_mutate wraps location_id as `UUID('...')` string repr
  - Esteban suspects the Codex proxy response normalization is mangling types
- [ ] No action cards emitted (writes must succeed first)
- [ ] Duplicate API fetches: each dashboard page fires 2x same requests (React StrictMode?)

**A0 27B vs GPT-5.3 Comparison:**
- 27B: 27+ LLM calls, installed PostgreSQL from scratch, took 30+ minutes, never completed order
- GPT-5.3: 6 LLM turns, proper delegation, data-grounded response, completed in seconds
- GPT-5.3 composed structured subordinate briefs without prompting
- GPT-5.3 tried 3 different write paths when first failed (create → mutate → batch)

**In Progress:**
- [ ] MCP write tools broken (type serialization + UUID wrapping)
- [ ] Codex patch not persisted in Dockerfile (lost on container restart)
- [ ] Migration 009 not yet run (fixed version on worktree branch)

**Blocked:**

### .rune/decisions.md
# Decisions Log

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
