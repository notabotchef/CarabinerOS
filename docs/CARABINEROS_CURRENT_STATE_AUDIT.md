# CarabinerOS Current State Audit

Audit date/time: 2026-07-09, Europe/Rome. Scope: factual file-based audit only. No Hermes migration performed.

## 1. Executive Summary

`/Users/estebannunez/Projects/carabiner-os` is the best current source of truth. It is the GitHub-bound CarabinerOS repo, on `main`, with remote `git@github.com:notabotchef/CarabinerOS.git`, a Next.js frontend, Python restaurant domain code, PostgreSQL models/migrations, Agent Zero overlay/runtime config, action-card tooling, demo routes, tests, Docker compose, and docs.

`/Users/estebannunez/Projects/FreshcOS` is mostly an upstream Agent Zero checkout with an untracked early CarabinerOS/FreshcOS overlay. It is newer only in upstream Agent Zero commit terms (`fa65fa3d`, tag `v0.9.8.2`), not in CarabinerOS product completeness. Its local tests expect a missing `carabiner/agent_overlay` and `bridge.py`, so it appears stale/abandoned as a CarabinerOS implementation path.

Main truth: CarabinerOS currently remains Agent Zero-centered. Hermes appears in docs/operations planning only, not active code. Fable can start from GitHub after this sync, but should read this audit first and create adapter boundaries/tests before replacing orchestration.

## 2. What Was Audited

| Target | Branch | Remote(s) | Latest observed commit |
|---|---:|---|---|
| `/Users/estebannunez/Projects/carabiner-os` | `main` | `origin git@github.com:notabotchef/CarabinerOS.git`; `upstream https://github.com/agent0ai/agent-zero.git` | `bdbb5946 Merge pull request #4 from notabotchef/fix/codex-review-findings` |
| `/Users/estebannunez/Projects/carabiner-os/engine/agent-zero` | `carabiner/v1.8` | `origin https://github.com/agent0ai/agent-zero.git` | `3c9b1d5f feat(voice): enable kokoro TTS preload` |
| `/Users/estebannunez/Projects/FreshcOS` | `main` | `origin https://github.com/agent0ai/agent-zero.git` | `fa65fa3d Merge branch 'testing'` |
| `https://github.com/notabotchef/CarabinerOS.git` | `main` | target remote | synced by final commit in this task; exact hash in final response |

Observed dirty state before this audit in `carabiner-os`: many tracked `.rune/` files, `frontend/.rune/metrics/*`, `rune-business`, `rune-pro`, and `rune.config.json` were already deleted; untracked `.claude/.../project_north_star.md` and `usr/extensions/python/webui_ws_event/_30_daily_brief.py` existed. Deletions were not created by this audit and should not be assumed intentional migration cleanup.

## 3. Source of Truth Decision

Best current base: `/Users/estebannunez/Projects/carabiner-os`.

Reasons:
- It is connected to the requested GitHub remote.
- It contains the product frontend under `frontend/src`.
- It contains current CarabinerOS domain code under `carabiner/`.
- It contains Agent Zero as a submodule under `engine/agent-zero`.
- It contains Docker compose, nginx, DB migrations, seed scripts, action-card tests, demo fixtures, and operation docs.
- Its selected Python tests pass when avoiding missing optional `mcp`, and frontend tests pass.

What may still be pulled from `FreshcOS` later:
- Possibly upstream Agent Zero changes after submodule commit `3c9b1d5f`; do not pull blindly because `FreshcOS` is upstream Agent Zero, not product code.
- Historical untracked docs: `docs/HANDOFF-2026-03-18.md`, `docs/competitive-analysis.md`, `docs/migration-plan.md` already exist in archived or richer form in `carabiner-os`.

## 4. Project Identity

CarabinerOS currently appears to be an AI-native restaurant operations platform layered over Agent Zero. Product modules cover chat, orders, inventory, prep, food cost, menu, recipes, invoices, reporting, marketing, action cards, and demo onboarding.

FreshcOS appears to be a working directory/fork experiment: mostly raw Agent Zero plus untracked `carabiner/` and tests from an earlier overlay design. Its remote still points at `agent0ai/agent-zero`, and its README is upstream Agent Zero. Name/structure drift is real: CarabinerOS is canonical product name; FreshcOS is not currently the runnable product base.

## 5. Current Architecture

### Frontend

Path: `frontend/`. Stack: Next.js 16.2, React 19, TypeScript, Tailwind 4, Socket.IO client, Vitest, Playwright config.

Important files:
- `frontend/src/app/page.tsx`: main app route.
- `frontend/src/app/orders`, `inventory`, `prep`, `food-cost`, `menu`, `recipes`, `invoices`, `marketing`, `reporting`, `settings`, `plugins`: module pages.
- `frontend/src/components/action-card.tsx`, `action-card-expanded.tsx`, `notification-panel.tsx`: action-card surface.
- `frontend/src/hooks/use-chat.ts`, `use-action-cards.ts`, `use-socket.ts`, `use-expo-stream.ts`, `use-voice-recorder.ts`, `use-tts.ts`: chat/realtime/voice hooks.
- `frontend/next.config.ts`: proxies A0 and Carabiner `/api/*`, `/message*`, `/chats`, `/socket.io/*`.

Status: partial but test-covered. Frontend tests pass; lint fails on existing React hook rule in `frontend/src/components/chat-composer.tsx`.

### Backend/API

Path: `carabiner/api/`, `python/websocket_handlers/`, Agent Zero submodule backend.

Important files:
- `carabiner/api/flask_blueprint.py`: Flask blueprint with workspace REST routes.
- `carabiner/api/_a0_handlers.py`: Agent Zero `ApiHandler` factories for `/api/<resource>`.
- `carabiner/api/chats.py`: chat fallback when Agent Zero is unavailable.
- `carabiner/api/demo.py`, `demo_routes.py`: demo account/workspace/card action routes.
- `python/websocket_handlers/state_sync_handler/action_cards_handler.py`: handles `card_message`, `card_commit`, `card_dismiss`; forwards card messages to Agent Zero.

Status: active. Some drift/duplication exists: `carabiner/api/reporting.py` and `locations.py` are FastAPI-style routers in a Flask/A0 app, so active registration is unclear.

### Database

Path: `carabiner/db/`. Stack: PostgreSQL 16, SQLAlchemy async, asyncpg, Alembic.

Important files:
- `carabiner/db/models.py`: core restaurant models.
- `carabiner/db/workspace_models.py`: workspace/product models, action log, invoices, menus, prep, recipes.
- `carabiner/db/repositories.py`: async repository functions.
- `carabiner/db/migrations/versions/*.py`: 14 migration files including initial schema, workspace seed, reporting, recipes, invoices, inventory, marketing, menu, prep.
- `carabiner/db/seed_realistic.py`, `seed_functional.py`: seed scripts.

Status: active in Docker/app path. `alembic.ini` has local default URL and no env indirection.

### Agent/orchestration layer

Active center: Agent Zero.

Important files:
- `engine/agent-zero`: Agent Zero submodule pinned to `3c9b1d5f`.
- `usr/agents/gm`, `agm`, `executivechef`, `souschef`, `marketing`, `expo`: restaurant role profiles.
- `usr/plugins/carabiner/extensions/python/startup_migration/_10_carabiner_init.py`: DB init and A0 API stub registration.
- `usr/prompts/agent.system.tool.carabiner_read.md`, `carabiner_write.md`: tool docs.

Status: active, but prompts drift. Specialist prompts still mention `code_execution_tool` and raw `carabiner` CLI even though `usr/tools/carabiner_read.py` and `carabiner_write.py` exist.

### Tool/action layer

Important files:
- `carabiner/cli/`: Typer CLI commands for orders, inventory, prep, food cost, menu, recipes, invoices, vendors, campaigns.
- `usr/tools/carabiner_read.py`, `usr/tools/carabiner_write.py`: A0 tools wrapping CLI reads/writes.
- `python/tools/action_card.py`: emits action cards via `helpers.ws_manager.send_data`.
- `python/tools/daily_brief_tool.py`: builds data-driven daily brief card.
- `carabiner/mcp/server.py`: FastMCP server with broad CRUD/actions. Optional dependency missing in system Python check.

Status: active/partial. CLI and card tools have tests. MCP exists but local check failed without `mcp` package installed.

### Worker/task layer

Agent Zero supplies task/scheduler/deferred execution via submodule runtime. Carabiner-specific worker behavior is limited to extensions and web socket handlers:
- `usr/extensions/python/webui_ws_event/_30_daily_brief.py`: handles `daily_brief_request` and bypasses A0 for deterministic card creation.
- `usr/scheduler/tasks.json`: runtime scheduler config; do not commit personal runtime changes unless reviewed.

Status: partial. No separate Rust executor found.

### Audit/trace layer

Important files:
- `carabiner/db/workspace_models.py`: `ActionLog`, `InvoiceEvent`, `EightySixLog`, `MenuItemHistory`.
- `carabiner/domain/connectors.py`: builds external action plans/log entries.
- Agent Zero history/state traces through submodule/runtime.
- `docs/_archive/socket.io.rtf`: historical trace sample, large/archive only.

Status: partial. Data models exist, but full end-to-end audit trail behavior needs tests before Hermes migration.

### Policy/execution layer

Important files:
- `usr/tools/carabiner_read.py`: read verbs/resource allowlist.
- `usr/tools/carabiner_write.py`: write verbs/resource allowlist plus notification attempt.
- `usr/prompts/agent.system.tool.carabiner_write.md`: tells agent not to invent `location_id`.
- `python/tools/action_card.py`: validates card fields.
- `carabiner/domain/connectors.py`: external action planning status/channel hints.

Status: partial. Policy is mostly prompt/tool-level, not central enforced authorization. Preserve before replacing.

### LLM/model layer

Agent Zero/LiteLLM model routing is inherited from submodule/runtime and `usr/settings.json`.

Evidence:
- `usr/settings.local.json.example`: local Ollama `http://localhost:11434` overrides.
- `tests/test_e2e_chat_streaming.py`: assumes Ollama `qwen2.5:9b` and A0 configured with `ollama_chat`.
- `FreshcOS/conf/model_providers.yaml`: upstream provider list includes Ollama/OpenAI/OpenRouter, but FreshcOS is not canonical.

Status: active via A0 config, but local secrets/settings are runtime-managed.

### Docker/local dev

Important files:
- `docker-compose.dev.yml`: PostgreSQL, Agent Zero, frontend, nginx.
- `Dockerfile.agent-zero`: builds from `agent0ai/agent-zero-base:latest`, copies submodule engine, Carabiner domain, tool overlays.
- `nginx.dev.conf`: routes `/api/*`, `/socket.io/*`, A0, frontend.
- `.env.example`: added by this audit.

Status: Docker config validates.

### Tests/checks

Backend tests: `tests/`. Frontend tests: `frontend/src/__tests__`, `frontend/e2e`.

Observed:
- `python3 -m pytest tests/test_action_card_tool.py tests/test_daily_brief_tool.py tests/test_action_cards_handler.py -q`: pass, 46 tests.
- `python3 -m pytest ... tests/test_mcp_type_coercion.py`: fails because `mcp` package missing in system Python.
- `pnpm test -- --runInBand`: pass, 62 frontend tests, with React prop warnings.
- `pnpm lint`: fails on `react-hooks/set-state-in-effect` in `frontend/src/components/chat-composer.tsx`.
- FreshcOS tests fail 14/17 due missing overlay directories and `bridge.py`.

### Docs/prompts

Important docs:
- `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `DESIGN_TOKENS.md`.
- `docs/ARCHITECTURE.md`, `docs/README.md`.
- `docs/03-development/roadmap/*`, `docs/_archive/*`, `docs/05-operations/*`.

Status: useful but not all current. This audit should be read before older roadmap/AgentScope/Hermes docs.

## 6. Current Feature Inventory

| Feature | Status | Evidence Path(s) | Notes |
|---|---|---|---|
| chat interface | Partial | `frontend/src/hooks/use-chat.ts`, `carabiner/api/chats.py`, `engine/agent-zero` | A0-backed with fallback store. E2E requires running stack/Ollama. |
| operator console | Partial | `frontend/src/app/*`, `frontend/src/components/shell.tsx` | Module dashboard exists. |
| vendors | Partial | `carabiner/cli/commands/vendors.py`, `carabiner/api/_a0_handlers.py` | Read endpoints/CLI present. |
| products | Unknown | `carabiner/db/models.py` (`Item`) | No explicit product module page. |
| inventory | Partial | `frontend/src/app/inventory`, `carabiner/cli/commands/inventory.py`, `carabiner/mcp/server.py` | Includes counts/par/waste. |
| purchase orders | Partial | `frontend/src/app/orders`, `carabiner/cli/commands/orders.py` | CRUD exists. |
| invoices | Partial | `frontend/src/app/invoices`, `carabiner/cli/commands/invoices.py`, `InvoiceEvent` | Upload/approve tools in MCP; needs runtime check. |
| recipe costing | Partial | `frontend/src/app/recipes`, `carabiner/cli/commands/recipes.py` | Modernist recipe migrations exist. |
| food cost | Partial | `frontend/src/app/food-cost`, `carabiner/cli/commands/food_cost.py` | Summary/daily/budget handlers exist. |
| menu engineering | Partial | `frontend/src/app/menu`, `menu_recalculate_matrix` in MCP | 86/un86 and matrix logic present in MCP. |
| tasks | Partial | Agent Zero scheduler, `usr/scheduler/tasks.json` | A0-level tasks exist; product task workflow unclear. |
| worker/orchestrator | Partial | Agent Zero submodule, `usr/agents/*`, `call_subordinate` prompts | A0 is orchestrator. |
| automation pause/kill switch | Partial | Agent Zero runtime, UI tests mention pause | Product-specific kill switch unclear. |
| audit log/timeline | Partial | `ActionLog`, `InvoiceEvent`, `EightySixLog` | Models exist; UI/end-to-end unclear. |
| policy-gated execution | Partial | `usr/tools/carabiner_write.py`, prompts, validators | No central policy engine found. |
| Rust executor | Missing | repo search | No Rust files found in audited relevant paths. |
| LLM router/planner | Partial | Agent Zero/LiteLLM, `usr/settings.json` | A0 handles model routing. |
| local Ollama | Partial | `usr/settings.local.json.example`, e2e test comments | Config path exists. |
| OpenAI/cloud LLM | Partial | A0 settings model/provider support | Real keys ignored/untracked. |
| Agent0 | Working/Active | `engine/agent-zero`, `Dockerfile.agent-zero`, `usr/plugins/carabiner` | Core runtime dependency. |
| Hermes | Documentation-only | `docs/README.md`, `docs/05-operations/*`, `frontend/pnpm-lock.yaml` package refs irrelevant | No active Hermes code. |
| Fable readiness | Partial | this audit, repo sync | Needs tests/adapter plan first. |
| Docker setup | Partial/Working config | `docker-compose.dev.yml`, `Dockerfile.agent-zero` | Config validates; build not run. |
| tests | Partial | `tests/`, `frontend/src/__tests__` | Some pass; lint and optional MCP dependency fail. |

## 7. Agent0 Dependency Map

| Path | Type | What it does | Active? | Migration impact | Risk |
|---|---|---|---|---|---|
| `engine/agent-zero` | submodule/code | Agent runtime, Flask/Socket.IO, tools, memory, prompts | Yes | Main orchestration replacement boundary | High |
| `Dockerfile.agent-zero` | config | Builds A0 base plus Carabiner overlay | Yes | Hermes image/build path must replace/adapt | High |
| `docker-compose.dev.yml` | config | Runs `agent-zero` service | Yes | Service graph must change carefully | High |
| `usr/plugins/carabiner/.../_10_carabiner_init.py` | plugin/code | Creates DB, registers A0 API stubs | Yes | Needs equivalent startup/bootstrap in Hermes | High |
| `carabiner/api/_a0_handlers.py` | code | A0 `ApiHandler` factory | Yes | Likely replace with plain API adapter | High |
| `python/tools/action_card.py` | tool/code | A0 tool class emits Socket.IO action cards | Yes | Preserve output contract; replace Tool base adapter | Medium |
| `python/tools/daily_brief_tool.py` | tool/code | A0 tool class builds daily brief card | Yes | Pure builder can stay; Tool wrapper changes | Medium |
| `usr/tools/carabiner_read.py`, `carabiner_write.py` | tool/code | A0 tool wrappers around CLI | Likely yes | Preserve policy/read-write split | High |
| `usr/agents/*` | prompts/config | GM/specialist subordinate profiles | Yes | Inputs to Hermes agent design | Medium |
| `frontend/src/lib/socket-client.ts` | frontend code | Connects same-origin `/ws` compatible with A0 | Yes | Hermes websocket contract must match or adapter | High |
| `carabiner/api/chats.py` | code | A0-backed chat with fallback | Yes | Replace A0 calls or retain fallback | Medium |
| `tests/conftest.py` | tests | Stubs A0 heavy imports | Yes | Test strategy for migration | Medium |

If Agent0 means Agent Zero/A0, it is very present and active.

## 8. Hermes Readiness Map

Hermes references found:
- `docs/README.md`: roadmap says “End-to-end chat (A0 calling CLI) — Hermes Engineer”; operations section links Paperclip org.
- `docs/05-operations/README.md`: identifies Hermes Engineer as first implementation owner.
- `docs/05-operations/agents/paperclip-company/agents/hermes-engineer/AGENTS.md`: Paperclip agent instructions.
- `frontend/pnpm-lock.yaml`: `hermes-parser` / `hermes-estree` are JS parser deps, unrelated to target Hermes migration.

No active Hermes runtime, package, service, adapter, API client, or orchestration code was found.

Likely replacement boundary:
- Replace A0 orchestration/chat/tool runtime.
- Keep `carabiner/db`, `carabiner/cli`, `carabiner/api/schemas.py`, frontend module pages, action-card payload shape, audit models, migrations.
- Create adapters for chat, tool invocation, websocket events, policy-gated writes, and audit logging.

Do not touch until tests exist:
- CLI read/write behavior.
- Action card payload contract.
- Chat streaming contract.
- DB migrations/schema.
- Existing frontend module routes.

Fable needs before coding:
- This audit.
- `README.md`, `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`.
- `docker-compose.dev.yml`, `Dockerfile.agent-zero`, `nginx.dev.conf`.
- `usr/agents/gm/prompts/agent.system.main.role.md` and specialist prompts.
- `carabiner/api/_a0_handlers.py`, `carabiner/api/chats.py`, `python/websocket_handlers/state_sync_handler/action_cards_handler.py`.
- `usr/tools/carabiner_read.py`, `usr/tools/carabiner_write.py`.

## 9. Fable Readiness

Fable can start from GitHub after this audit if the repo is pushed and submodule checkout is available. Blockers:
- Lint currently fails.
- Optional MCP tests require installing `mcp`.
- Existing dirty deletions in `.rune/`/rune artifacts need owner decision.
- No active Hermes adapter boundary exists.
- Product docs and prompts disagree on CLI-via-code-execution vs dedicated tools.

Files Fable should read first:
1. `docs/CARABINEROS_CURRENT_STATE_AUDIT.md`
2. `README.md`
3. `docs/ARCHITECTURE.md`
4. `docker-compose.dev.yml`
5. `Dockerfile.agent-zero`
6. `frontend/next.config.ts`
7. `frontend/src/lib/socket-client.ts`
8. `carabiner/api/_a0_handlers.py`
9. `carabiner/api/chats.py`
10. `usr/plugins/carabiner/extensions/python/startup_migration/_10_carabiner_init.py`
11. `usr/tools/carabiner_read.py`
12. `usr/tools/carabiner_write.py`
13. `python/tools/action_card.py`
14. `python/tools/daily_brief_tool.py`

## 10. Important Files and Directories

| Path | Purpose | Owner/module | Current/stale/unknown |
|---|---|---|---|
| `frontend/` | Next.js operator UI | Frontend | Current |
| `carabiner/` | Restaurant domain code | Backend/domain | Current |
| `carabiner/db/` | ORM, repositories, migrations | Data | Current |
| `carabiner/cli/` | Typer CLI used by tools/agents | Tooling | Current |
| `carabiner/mcp/server.py` | MCP CRUD/action server | Tooling | Partial |
| `python/tools/` | A0 tool overlays | Agent tools | Current |
| `python/websocket_handlers/` | A0 websocket handlers | Realtime | Current |
| `usr/agents/` | Restaurant agent profiles | Orchestration | Current but prompt drift |
| `usr/plugins/carabiner/` | A0 plugin bootstrap | Orchestration/API | Current |
| `usr/tools/` | A0 carabiner read/write tools | Tool policy | Current |
| `engine/agent-zero` | Agent Zero submodule | Runtime | Current dependency |
| `docs/_archive/` | Old A0/AgentScope docs | Docs | Stale/reference only |
| `docs/05-operations/` | Paperclip/Hermes org docs | Ops | Planning/reference |
| `FreshcOS/` | Upstream A0 checkout plus stale overlay | External local project | Stale for product |

## 11. Environment and Secrets

Required/observed env vars:
- `DATABASE_URL`
- `FLASK_SECRET_KEY`
- `ALLOWED_ORIGINS`
- `A0_URL`
- `NEXT_PUBLIC_A0_URL`
- Optional provider keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`
- Optional Ollama base: `http://localhost:11434` via settings override.

Secret risks:
- `usr/.env`, `usr/secrets.env`, `frontend/.env.local`, `usr/chats`, `usr/memory`, `frontend/.next`, and `frontend/node_modules` are ignored.
- `docker-compose.dev.yml` contains dev-only database password and `FLASK_SECRET_KEY`; not production-safe.
- `usr/settings.json` is tracked and contains settings structure. Do not put real keys there.
- `.swarm/memory.db` and `.claude-flow/*` are tracked from earlier repo state and look generated/runtime-like. This audit did not remove them.

`.env.example` was added with placeholders.

## 12. Runbook

Install:
- Frontend: `cd frontend && pnpm install`
- Backend domain deps in Docker are installed by `Dockerfile.agent-zero`.
- Local Python needs Agent Zero deps plus `carabiner/requirements.txt` and optional `mcp` for MCP tests.

Dev:
- Full stack: `docker compose -f docker-compose.dev.yml up`
- Frontend only: `cd frontend && pnpm dev`
- Agent Zero direct via Docker: `http://localhost:5050`
- App via nginx: `http://localhost:8080`

DB:
- Docker starts PostgreSQL on `localhost:5432`.
- Seed realistic data: `docker compose exec agent-zero bash -c 'source /opt/venv-a0/bin/activate && PYTHONPATH=/cos python -m carabiner.db.seed_realistic --no-confirm'`
- Alembic config: `alembic.ini`, script location `carabiner/db/migrations`.

Tests/checks:
- Python selected unit tests: `python3 -m pytest tests/test_action_card_tool.py tests/test_daily_brief_tool.py tests/test_action_cards_handler.py -q`
- Frontend unit tests: `cd frontend && pnpm test -- --runInBand`
- Frontend lint: `cd frontend && pnpm lint`
- Docker config: `docker compose -f docker-compose.dev.yml config`

Known failure points:
- `pnpm lint` fails on `frontend/src/components/chat-composer.tsx:163`.
- MCP test import fails without `mcp` package.
- FreshcOS local tests fail because expected overlay files are missing.

## 13. Checks Performed

| Command | Directory | Result | Notes |
|---|---|---|---|
| `git status --short` | both repos | completed | Dirty states documented. |
| `git branch --show-current` | both repos | completed | Both `main`; submodule `carabiner/v1.8`. |
| `git remote -v` | both repos | completed | `carabiner-os` points to target. |
| `git log --oneline -n 10` | both repos | completed | Recent commits documented. |
| `find . -maxdepth 3 -type f/d` | both repos | completed | Used for inventory. |
| `rg` reference searches | both repos | completed | Agent0/Hermes/Fable/orchestration refs summarized. |
| `docker compose -f docker-compose.dev.yml config` | `carabiner-os` | pass | Config OK. |
| `python3 -m pytest tests/test_action_card_tool.py tests/test_daily_brief_tool.py tests/test_action_cards_handler.py -q` | `carabiner-os` | pass | 46 passed. |
| `python3 -m pytest ... test_mcp_type_coercion.py` | `carabiner-os` | fail | `ModuleNotFoundError: No module named 'mcp'`. |
| `python3 -m compileall -q carabiner python usr/tools usr/extensions` | `carabiner-os` | pass | No syntax errors surfaced. |
| `cd frontend && pnpm test -- --runInBand` | `carabiner-os` | pass | 62 passed; React prop warnings. |
| `cd frontend && pnpm lint` | `carabiner-os` | fail | One error in `chat-composer.tsx`; 11 warnings. |
| `python3 -m pytest tests/test_discovery.py tests/test_tools.py -q` | `FreshcOS` | fail | 14 failed due missing overlay/bridge. |
| `docker compose -f docker/run/docker-compose.yml config` | `FreshcOS` | pass | Upstream A0 compose config OK. |

## 14. GitHub Sync Summary

Files added/updated by this audit:
- Added `.env.example`.
- Added `docs/CARABINEROS_CURRENT_STATE_AUDIT.md`.
- Added/staged `usr/extensions/python/webui_ws_event/_30_daily_brief.py` because it is product-relevant and already present locally.

Files excluded:
- `usr/.env`, `usr/secrets.env`, `frontend/.env.local`, `usr/chats`, `usr/memory`, `frontend/.next`, `frontend/node_modules`, caches, pyc files, `.DS_Store`.
- Pre-existing deletions under `.rune/`, `frontend/.rune/metrics`, `rune-business`, `rune-pro`, `rune.config.json` were not intentionally staged by this audit.

Branch: `main`.
Commit hash: recorded in final response after commit creation.
Push result: recorded in final response.

## 15. Risks and Unknowns

- A0 remains central runtime. Hermes migration is not started.
- Repo has pre-existing tracked generated/runtime files (`.swarm`, `.claude-flow`) and pre-existing tracked deletions. Owner should decide what to preserve/remove.
- `docs/ARCHITECTURE.md` appears useful but includes paths that do not exactly match current files, e.g. `carabiner/plugins` vs actual `usr/plugins/carabiner`.
- Prompts/tooling drift: old instructions use `code_execution_tool`; newer direct tools exist.
- MCP code exists but local environment lacks `mcp` package for tests.
- `docker-compose.dev.yml` has dev secrets in plain text.
- No Rust executor found.
- No active Hermes code found.
- No full stack runtime test was run.
- No Docker build was run.
- No real DB migration/seed was run.

## 16. DO

- Read this audit first.
- Preserve current working features.
- Preserve local-first design.
- Preserve auditability.
- Preserve policy gates.
- Create adapter boundaries before replacing orchestration.
- Write tests around current behavior before changing it.
- Document every migration decision.
- Keep repo runnable.
- Keep env/secrets safe.

## 17. DON'T

- Do not assume old docs are true.
- Do not delete Agent0/Agent Zero code until replacement is verified.
- Do not bypass policy/executor safety.
- Do not remove audit traces.
- Do not hardcode secrets.
- Do not rewrite UI unnecessarily.
- Do not collapse everything into one untraceable agent.
- Do not perform broad refactors before identifying working paths.
- Do not trust package names without checking active imports.

## 18. EXPECTATIONS

- Fable should first understand current orchestration boundary.
- Hermes should replace only necessary orchestration layer.
- Restaurant ops product model should remain intact.
- Data model should remain stable unless migration is explicit.
- Current working CRUD/workflows should keep working.
- Task/action/audit traces should remain visible.
- Local dev should still run.
- Tests/checks should improve, not disappear.

## 19. MUST

- No secrets committed.
- GitHub repo must be cloud-agent usable.
- Project must have setup instructions.
- Audit file must be committed.
- Env example must exist.
- Current source files must be preserved.
- Migration must be traceable.
- Policy-gated execution must not be bypassed.
- Auditability must remain.
- Final Fable prompt must be based on discovered facts only.

## 20. TO-DO

P0 - before Fable starts coding:
- Resolve dirty tracked deletions decision (`.rune`, rune submodules/config).
- Install proper Python deps or document venv command for full test suite including `mcp`.
- Fix current frontend lint error or mark accepted debt.
- Verify full Docker stack boots and nginx routes work.
- Lock down exact current chat/action-card websocket contracts in tests.

P1 - first Hermes migration steps:
- Build orchestration adapter interface around chat send/stream, tool calls, action card emit, audit log write, and policy-gated mutation.
- Add contract tests for A0 current behavior.
- Implement Hermes behind adapter while keeping A0 path runnable.
- Migrate one narrow path first: read-only chat over `carabiner_read`.

P2 - after migration cleanup:
- Remove or archive A0-specific stubs only after Hermes tests pass.
- Update prompts from `code_execution_tool` CLI calls to final tool boundary.
- Decide fate of MCP server and Paperclip bridge.
- Clean generated/runtime tracked artifacts with explicit owner approval.

P3 - future product improvements:
- Formal policy engine.
- Full audit timeline UI.
- Better invoice parsing/upload flow.
- Product catalog abstraction.
- E2E tests for critical restaurant workflows.
- Production secret management.

## 21. Questions for Esteban

1. Should existing tracked `.rune/` deletions and `rune-business`/`rune-pro` deletions be preserved as deletions, restored, or archived?
2. Is Hermes intended to replace Agent Zero entirely or only the GM/specialist orchestration loop?
3. Should `carabiner.mcp.server` remain a supported integration surface during Hermes migration?

## 22. Draft Ultimate Fable Prompt

You are Fable working on CarabinerOS. Do not trust old memory or prior architecture summaries. Start by reading `docs/CARABINEROS_CURRENT_STATE_AUDIT.md`, then `README.md`, `docs/ARCHITECTURE.md`, `docker-compose.dev.yml`, `Dockerfile.agent-zero`, `frontend/next.config.ts`, `frontend/src/lib/socket-client.ts`, `carabiner/api/_a0_handlers.py`, `carabiner/api/chats.py`, `usr/plugins/carabiner/extensions/python/startup_migration/_10_carabiner_init.py`, `usr/tools/carabiner_read.py`, `usr/tools/carabiner_write.py`, `python/tools/action_card.py`, and `python/tools/daily_brief_tool.py`.

Current factual state: `/Users/estebannunez/Projects/carabiner-os` is the canonical GitHub-bound CarabinerOS repo. It is a restaurant operations platform with Next.js frontend, Python/Flask/Agent Zero backend, PostgreSQL/SQLAlchemy data model, Typer CLI, A0 tools/extensions, Socket.IO action cards, and Agent Zero submodule orchestration. `/Users/estebannunez/Projects/FreshcOS` is not the canonical product base; it is mostly upstream Agent Zero plus stale/untracked overlay remnants. Hermes is not active code yet. Agent Zero is still the active runtime.

Do not perform broad refactors first. Do not delete Agent Zero code until replacement is verified. Do not bypass policy-gated writes or action/audit traces. Do not rewrite frontend modules unless migration requires a narrow compatibility fix. Preserve restaurant ops identity: GM, AGM, Executive Chef, Sous Chef, Marketing, Expo, orders, inventory, prep, invoices, recipes, menu, food cost, reporting, action cards, and auditability.

Migration path:
1. Establish current behavior with tests/contracts around chat send/stream, action card payloads, `carabiner_read`, `carabiner_write`, CLI CRUD, DB repositories, and websocket events.
2. Define adapter boundaries for orchestration, tool execution, websocket emission, audit logging, and policy-gated mutation.
3. Put Hermes behind adapter without removing A0 path.
4. Migrate one read-only flow first, then one write flow with audit/action-card verification.
5. Keep Docker/local dev runnable throughout.
6. Update docs after each decision.

Checks to run:
- `docker compose -f docker-compose.dev.yml config`
- `python3 -m pytest tests/test_action_card_tool.py tests/test_daily_brief_tool.py tests/test_action_cards_handler.py -q`
- install/activate proper Python deps, then include `tests/test_mcp_type_coercion.py` if MCP remains supported
- `cd frontend && pnpm test -- --runInBand`
- `cd frontend && pnpm lint`
- full stack smoke after Docker boot

Deliverables:
- Adapter design doc or ADR.
- Tests for current A0 behavior before migration changes.
- Minimal Hermes adapter implementation.
- Updated runbook.
- Migration notes listing every A0 touchpoint replaced or intentionally retained.
- Status report with commands run, pass/fail results, files changed, remaining risks.

Progress reporting:
- Report facts from files and tests only.
- Call out failures directly.
- Do not claim Hermes parity until contract tests pass.
- Keep product language focused on restaurant operations, not generic agent demos.
