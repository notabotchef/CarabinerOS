# Fable Hermes Execution Plan

## 1. Executive Summary

CarabinerOS is currently a restaurant operations platform layered over Agent Zero. Agent Zero owns the active runtime boundary: chat orchestration, tool execution, role agents, Socket.IO assumptions, startup plugin registration, and Docker service wiring. CarabinerOS owns the restaurant product layer: Next.js module UI, Python domain/API/CLI code, PostgreSQL/SQLAlchemy/Alembic data model, action-card payloads, audit/event models, and restaurant role identity.

Hermes is not present as active code in this repository. The safe migration strategy is therefore not "replace Agent Zero" in one pass. The strategy is to first wrap the current Agent Zero integration behind explicit adapters, add contract tests around the current behavior, then route one read-only flow and one write flow through Hermes while keeping Agent Zero available as fallback. Agent Zero should only be removed or disabled after Hermes proves parity for chat, tools, policy gates, action cards, audit logging, role orchestration, and Docker/local development.

## 2. Verified Current Architecture

### Frontend

Frontend lives in `frontend/` and uses Next.js 16, React 19, TypeScript, Tailwind CSS 4, Socket.IO client, Vitest, and Playwright config. `frontend/next.config.ts` rewrites `/csrf_token`, `/message_async`, `/message`, `/chats`, `/chat_load`, `/chat_create`, `/chat_remove`, `/api/:path*`, and `/socket.io/:path*` to `A0_URL`. `frontend/src/lib/socket-client.ts` opens a Socket.IO connection to `/ws` with CSRF/session assumptions inherited from Agent Zero.

### Backend/API

The restaurant API/domain code lives in `carabiner/`. `carabiner/api/_a0_handlers.py` creates Agent Zero `ApiHandler` classes for resource routes and custom endpoints. `carabiner/api/chats.py` reads/writes chat state through Agent Zero when available and falls back to `carabiner.chat_store`. `carabiner/api/flask_blueprint.py` also contains Flask routes, while `carabiner/api/reporting.py` and `carabiner/api/locations.py` are FastAPI-style routers whose active registration is unclear from the inspected files.

### Database

Database code lives in `carabiner/db/`. `carabiner/db/models.py` defines core restaurant/accounting models such as `Location`, `Vendor`, `Item`, `Invoice`, `InventoryCount`, `ParLevel`, `WasteLog`, `Recipe`, `MenuItem`, `PrepList`, `PurchaseOrder`, `DailyPL`, and `BudgetPeriod`. `carabiner/db/workspace_models.py` defines workspace/UI models such as `WorkspaceOrder`, `WorkspaceInventory`, `WorkspacePrep`, `WorkspaceFoodCost`, `WorkspaceMenu`, `WorkspaceCampaign`, `WorkspaceInvoice`, `InvoiceEvent`, `WorkspaceRecipe`, `ActionLog`, `MenuItemHistory`, and `EightySixLog`. Repositories in `carabiner/db/repositories.py` expose async CRUD and query functions.

### CLI/tooling

The Typer CLI is under `carabiner/cli/`, with commands for orders, inventory, prep, food cost, menu, recipes, invoices, vendors, and campaigns. Agent-facing wrappers exist in `usr/tools/carabiner_read.py` and `usr/tools/carabiner_write.py`. They enforce resource/verb allowlists and shell out to the `carabiner` CLI with JSON output.

### Agent Zero runtime

Agent Zero is included as a submodule at `engine/agent-zero` and is copied into the Docker image by `Dockerfile.agent-zero`. `docker-compose.dev.yml` runs this as the `agent-zero` service. `usr/plugins/carabiner/extensions/python/startup_migration/_10_carabiner_init.py` initializes tables and writes generated A0 API stubs into `/a0/api`.

### Action cards

`python/tools/action_card.py` is an A0 tool class that validates card type/action/stats/changes, builds a payload, and emits `action_card` via `helpers.ws_manager.send_data`. `python/tools/daily_brief_tool.py` builds deterministic daily brief cards from repository data. `usr/extensions/python/webui_ws_event/_30_daily_brief.py` handles `daily_brief_request` events and bypasses A0 LLM generation for deterministic card construction.

### Websocket flow

`frontend/src/lib/socket-client.ts` connects to `/ws` using Socket.IO polling first, with CSRF data fetched from `/csrf_token`. `python/websocket_handlers/state_sync_handler/action_cards_handler.py` handles `card_message`, `card_commit`, and `card_dismiss`. `card_message` forwards prompt text to `AgentContext.first().communicate(...)` and broadcasts a `card_reply`.

### Docker dev stack

`docker-compose.dev.yml` runs PostgreSQL, `agent-zero`, frontend, and nginx. `nginx.dev.conf` routes chat endpoints, `/api/`, `/socket.io/`, `/a0/`, and frontend traffic. `Dockerfile.agent-zero` builds from `agent0ai/agent-zero-base:latest`, copies `engine/agent-zero`, installs Carabiner dependencies, copies `carabiner/`, `tools/`, and `python/`, sets `PYTHONPATH=/cos`, and creates a `carabiner` CLI wrapper.

### Tests/checks

Current safe checks from the audit and reruns:

- `docker compose -f docker-compose.dev.yml config` passes.
- `python3 -m pytest tests/test_action_card_tool.py tests/test_daily_brief_tool.py tests/test_action_cards_handler.py -q` passes.
- `cd frontend && pnpm test -- --runInBand` passes.
- `cd frontend && pnpm lint` fails on `frontend/src/components/chat-composer.tsx:163` with `react-hooks/set-state-in-effect`.
- Optional MCP test previously failed with `ModuleNotFoundError: No module named 'mcp'`.

### Docs/prompts

Planning docs live in `docs/CARABINEROS_CURRENT_STATE_AUDIT.md`, `docs/FABLE_HERMES_EXECUTION_BRIEF.md`, and `docs/HERMES_EXECUTION_PLAN_REQUEST.md`. Role prompts live under `usr/agents/*/prompts/agent.system.main.role.md`; tool prompts live under `usr/prompts/`. Prompt/tool drift exists: some role prompts still instruct use of `code_execution_tool` and direct CLI calls, while `usr/tools/carabiner_read.py` and `usr/tools/carabiner_write.py` exist as dedicated tools.

## 3. Agent Zero Dependency Map

| File path | Purpose | Active/stale/unclear | Migration impact | Risk | Suggested treatment |
|---|---|---|---|---|---|
| `engine/agent-zero` | Agent Zero runtime, Flask/Socket.IO, tool system, memory, model routing | Active | Main runtime replacement target | High | Wrap first, replace late |
| `Dockerfile.agent-zero` | Builds A0 base image plus Carabiner overlay | Active | Docker path must split A0 and Hermes paths | High | Preserve now, add Hermes variant later |
| `docker-compose.dev.yml` | Runs `agent-zero`, frontend, nginx, PostgreSQL | Active | Service graph must support dual runtime/fallback | High | Wrap with feature/env flags |
| `nginx.dev.conf` | Routes chat/API/Socket.IO traffic to `agent-zero` | Active | Realtime/API routing must move carefully | High | Preserve, add Hermes route only after adapter tests |
| `frontend/next.config.ts` | Proxies A0 chat/API/Socket.IO to `A0_URL` | Active | Frontend assumes A0-compatible endpoint names | High | Preserve endpoint contract; change target behind config |
| `frontend/src/lib/socket-client.ts` | Socket.IO `/ws` connection and CSRF auth | Active | Hermes must match contract or adapter must translate | High | Wrap realtime events before replacing |
| `usr/plugins/carabiner/plugin.yaml` | Enables Carabiner plugin | Active | Hermes needs equivalent bootstrap registration | Medium | Preserve, replace later |
| `usr/plugins/carabiner/extensions/python/startup_migration/_10_carabiner_init.py` | Creates DB tables and writes A0 API stubs | Active | A0-specific; needs non-A0 bootstrap | High | Wrap startup/bootstrap |
| `usr/tools/carabiner_read.py` | A0 Tool for read-only CLI access with allowlist | Active | Policy/read contract must survive | High | Wrap, preserve behavior |
| `usr/tools/carabiner_write.py` | A0 Tool for write CLI access, chat context injection, notifications | Active | Policy/write/audit/action-card surface | High | Wrap, then replace internals |
| `usr/agents/gm` | GM router role prompt/profile | Active | Role orchestration migration input | Medium | Preserve and map to Hermes role |
| `usr/agents/agm` | Purchasing/inventory/invoice role | Active | Role orchestration migration input | Medium | Preserve and map |
| `usr/agents/executivechef` | Food cost/menu/recipe role | Active | Role orchestration migration input | Medium | Preserve and map |
| `usr/agents/souschef` | Prep/station readiness role | Active | Role orchestration migration input | Medium | Preserve and map |
| `usr/agents/marketing` | Campaign/market role | Active | Role orchestration migration input | Medium | Preserve and map |
| `usr/agents/expo` | Action-card/ops monitor role | Active | Notification workflow migration input | Medium | Preserve and map |
| `usr/prompts/agent.system.tool.carabiner_read.md` | Prompt contract for reads | Active | Tool invocation schema contract | Medium | Preserve, update after adapter exists |
| `usr/prompts/agent.system.tool.carabiner_write.md` | Prompt contract for writes and location guard | Active | Policy/writes contract | High | Preserve, migrate with tests |
| `python/tools/action_card.py` | A0 tool class emits action cards | Active | Payload and emit contract must be stable | High | Extract pure builder/emitter adapter |
| `python/tools/daily_brief_tool.py` | A0 tool and pure daily brief card builder | Active | Pure builder can survive runtime change | Medium | Preserve builder, wrap tool |
| `python/websocket_handlers/state_sync_handler/action_cards_handler.py` | Card events and A0 card-message response | Active | Realtime and chat coupling | High | Wrap event handling and chat runtime |
| `carabiner/api/_a0_handlers.py` | A0 `ApiHandler` route factories and custom handlers | Active | Needs plain API/Hermes-compatible equivalent | High | Wrap, replace after contract tests |
| `carabiner/api/chats.py` | A0 chat extraction plus fallback store | Active/partial | Chat runtime migration boundary | High | Wrap with `ChatRuntimeAdapter` |
| `tools/action_card.py`, `tools/daily_brief_tool.py` | A0 discovery shims mounted into `/a0/tools` | Active through Docker mounts | Tool discovery coupling | Medium | Preserve until runtime replacement |
| `usr/settings.json` | A0 runtime settings/model/MCP config | Active runtime config | Hermes config source unclear | Medium | Preserve; add separate Hermes config later |

## 4. Hermes Target Architecture

Hermes target architecture should be defined as adapter-backed until Hermes capabilities are confirmed in code. This plan assumes Hermes will eventually own orchestration and runtime execution, but does not assume any concrete Hermes package, language, executor, or server API because none is present in this repository.

- Orchestration: Hermes should call a stable `OrchestrationAdapter` that can route to Agent Zero or Hermes implementation based on config.
- Chat send/stream: Frontend endpoint names should remain stable while `ChatRuntimeAdapter` handles A0 or Hermes backend calls.
- Tool invocation: Hermes should invoke tools through `ToolExecutionAdapter`, preserving `carabiner_read`, `carabiner_write`, `action_card`, and `daily_brief` contracts.
- Role agents: GM, AGM, Executive Chef, Sous Chef, Marketing, and Expo should remain separate roles. Hermes can change execution mechanics but not collapse role identity.
- Action-card emission: Hermes should emit the same `action_card` payload shape through `ActionCardAdapter`.
- Websocket/realtime events: `RealtimeEventAdapter` should preserve current event names (`action_card`, `card_reply`, `card_commit`, `card_dismiss`, `card_message`, `daily_brief_request`) or explicitly translate them.
- Policy-gated writes: `PolicyGateAdapter` should enforce resource/verb allowlists, required `location_id`, dry-run/approval hooks, and no raw SQL mutation by agents.
- Audit/action logging: `AuditLogAdapter` should write to existing `ActionLog`/event models before adding schema changes.
- Local dev/Docker: Docker should run A0 and Hermes side-by-side during migration. A config flag should choose runtime per flow.
- Fallback/rollback: Agent Zero stays as default until Hermes passes contract tests. Each Hermes slice must be revertible by flag, not by broad git revert.

## 5. Adapter Boundary Design

| Adapter | Responsibility | Current Agent Zero source | Future Hermes target | Contract | Files likely involved | Tests required |
|---|---|---|---|---|---|---|
| `OrchestrationAdapter` | Route a user task to GM/specialist runtime and return structured result/stream handle | `engine/agent-zero`, `usr/agents/*`, `AgentContext.communicate` | Hermes role orchestrator | input: message, context id, role; output: response chunks/final, tool calls, trace id | new `carabiner/runtime/`, `carabiner/api/chats.py`, role prompt loaders | role routing contract, A0 fallback contract |
| `ChatRuntimeAdapter` | Send/load/create/remove chats and stream messages | `carabiner/api/chats.py`, A0 `/message_async`, `/chats` handlers | Hermes chat runtime | input: chat command; output: A0-compatible JSON/events | `carabiner/api/chats.py`, `carabiner/api/_a0_handlers.py`, frontend rewrites | chat CRUD, send/stream, fallback store |
| `ToolExecutionAdapter` | Execute read/write/domain tools with stable allowlists | `usr/tools/carabiner_read.py`, `usr/tools/carabiner_write.py`, A0 `Tool` base | Hermes tool runner | input: tool name, args, context; output: status, JSON/text, side effects | `usr/tools`, new adapter modules, `carabiner/cli` | read allowlist, write allowlist, timeout/error behavior |
| `ActionCardAdapter` | Build, validate, emit action card payloads | `python/tools/action_card.py`, `python/tools/daily_brief_tool.py`, `helpers.ws_manager.send_data` | Hermes emitter or shared realtime service | input: card fields; output: emitted event or validation error | `python/tools`, new `carabiner/runtime/action_cards.py` | payload validation, daily brief shape, emit fallback |
| `AuditLogAdapter` | Persist action/tool/audit traces | `ActionLog`, `InvoiceEvent`, `EightySixLog`, A0 history | Hermes trace/audit writer using existing DB models | input: actor, action, resource, before/after, result; output: log id | `carabiner/db/workspace_models.py`, `carabiner/db/repositories.py` | create/read action log, failure trace |
| `PolicyGateAdapter` | Decide whether a mutation is allowed before tool execution | `usr/tools/*` allowlists, prompts, validators | Hermes policy gate | input: user intent/tool/resource/verb/args/context; output: allow/deny/requires approval | `usr/tools`, prompt docs, new policy module | forbidden verb/resource, missing `location_id`, dry-run |
| `RealtimeEventAdapter` | Normalize websocket events and emit replies | `python/websocket_handlers/state_sync_handler/action_cards_handler.py`, `frontend/src/lib/socket-client.ts` | Hermes realtime/event bridge | input: event name/payload/sid; output: `{ok,data}` or event broadcast | websocket handler, frontend socket client, nginx/Next rewrites | card commit/dismiss/message, daily brief request |

## 6. Test-First Strategy

| Test | Purpose | Current evidence file | Proposed test file | Expected result |
|---|---|---|---|---|
| chat send/stream behavior | Lock `/message_async` and chat response flow before Hermes changes | `frontend/src/hooks/use-chat.ts`, `carabiner/api/_a0_handlers.py`, `carabiner/api/chats.py` | `tests/test_chat_runtime_adapter.py`, `frontend/src/__tests__/hooks/use-chat-runtime.test.ts` | A message can be sent, response/error envelope is stable, fallback remains available |
| `carabiner_read` behavior | Preserve read-only allowlist/CLI JSON behavior | `usr/tools/carabiner_read.py` | `tests/test_tool_execution_adapter_read.py` | allowed resource runs; invalid resource/verb denied; `--json` appended |
| `carabiner_write` behavior | Preserve write allowlist, context injection, notification tolerance | `usr/tools/carabiner_write.py` | `tests/test_tool_execution_adapter_write.py` | create/update/delete allowed only for approved resources; missing CLI returns safe error; notification failure does not block |
| action-card payload structure | Preserve frontend card contract | `python/tools/action_card.py`, `frontend/src/components/action-card.tsx` | extend `tests/test_action_card_tool.py` and `frontend/src/__tests__/components/action-card.test.tsx` | payload has required keys and rejects invalid type/action |
| card commit/dismiss websocket handling | Preserve card event semantics | `python/websocket_handlers/state_sync_handler/action_cards_handler.py` | extend `tests/test_action_cards_handler.py` | commit returns `{"status":"committed"}`; dismiss returns `{"status":"dismissed"}` |
| daily brief card behavior | Preserve deterministic brief card shape | `python/tools/daily_brief_tool.py`, `usr/extensions/python/webui_ws_event/_30_daily_brief.py` | extend `tests/test_daily_brief_tool.py`; add `tests/test_daily_brief_event_adapter.py` | no-data and urgent branches produce stable card payloads |
| selected CLI read/write commands | Preserve human/agent CLI behavior | `carabiner/cli/commands/*` | `tests/test_cli_orders_contract.py`, `tests/test_cli_inventory_contract.py` | list/get returns JSON; dry-run/write behavior remains stable |
| audit/action log writes | Verify write flows leave trace | `ActionLog` in `workspace_models.py`, `create_action_log` in `repositories.py` | `tests/test_audit_log_adapter.py` | a write adapter call creates retrievable action log entry |
| Docker routing assumptions | Preserve `/api`, `/socket.io`, chat endpoint routing | `docker-compose.dev.yml`, `nginx.dev.conf`, `frontend/next.config.ts` | extend `tests/test_nginx_proxy_routing.py` or add config snapshot test | config contains expected services/routes; no unexpected route removal |

## 7. Migration Phases

### Phase 0 — Repo Stabilization

Goal: Stabilize existing repo before Hermes work.

- Resolve or document current lint failure in `frontend/src/components/chat-composer.tsx:163`.
- Verify Python dependency path for full test suite and optional MCP package.
- Decide whether `carabiner/mcp/server.py` remains supported during migration.
- Verify Docker boot path, not only `docker compose config`.
- Verify `engine/agent-zero` submodule checkout works after fresh clone.
- Document known dirty/generated artifacts: `.rune/` deletions, `frontend/.rune/metrics` deletions, `rune-business`, `rune-pro`, `rune.config.json`, `.claude/.../project_north_star.md`.
- Re-run baseline checks and record results in migration notes.

### Phase 1 — Adapter Scaffolding

Goal: Add adapter boundaries while keeping Agent Zero as active implementation.

- Add adapter modules with A0-backed implementations.
- No behavior changes.
- No Agent Zero removal.
- Tests must pass before and after.
- Add contract tests for current behavior.
- Default runtime config remains `agent_zero`.

### Phase 2 — Read-Only Hermes Slice

Goal: Route one safe read-only path through Hermes.

Preferred first slice:

- chat asks for restaurant data through `carabiner_read`
- no writes
- no mutation
- no DB schema changes

Implementation shape:

- Hermes calls `ToolExecutionAdapter.execute("carabiner_read", ...)`.
- Adapter emits same response shape as A0 path.
- A0 fallback remains available by config.

### Phase 3 — Write Flow with Policy + Audit

Goal: Route one narrow write flow through Hermes.

Requirements:

- policy gate must approve
- action card must be emitted
- audit/action log must be written
- rollback to Agent Zero path must remain possible

Preferred first write slice: update one prep item status through `carabiner_write`, because prep is operationally narrow and existing CLI/write patterns exist. Do not start with invoice upload, MCP batch mutation, or broad order creation.

### Phase 4 — Role Agent Migration

Goal: Map GM, AGM, Executive Chef, Sous Chef, Marketing, and Expo roles into Hermes-compatible orchestration.

- Preserve role-specific prompts and responsibilities.
- Map GM as router, not generic assistant.
- Map AGM to orders/inventory/invoices/vendors.
- Map Executive Chef to food cost/menu/recipes/P&L.
- Map Sous Chef to prep/station readiness.
- Map Marketing to campaigns/research.
- Map Expo to action-card quality/urgency checks.
- Do not collapse roles into one generic agent.

### Phase 5 — Runtime Replacement

Goal: Replace Agent Zero runtime only after Hermes parity is proven.

- Add Docker service/runtime for Hermes.
- Move websocket/realtime events behind `RealtimeEventAdapter`.
- Move tool runtime behind `ToolExecutionAdapter`.
- Move startup/bootstrap out of A0 plugin registration.
- Replace A0 API handlers with plain API/Hermes-compatible routes.
- Keep A0 fallback until full smoke test passes.

### Phase 6 — Cleanup

Goal: Remove or archive Agent Zero-specific code only after tests prove Hermes parity.

- Update docs.
- Update prompts/tool invocation instructions.
- Remove or archive A0-specific stubs.
- Clean Docker dependency on `agent0ai/agent-zero-base` only when no longer used.
- Remove submodule only after verified parity and owner approval.
- Document every migration decision.

## 8. Files to Touch

| File/Directory | Phase | Reason | Risk | Notes |
|---|---:|---|---|---|
| `docs/` | 0-6 | Record decisions, plans, runbooks | Low | Keep docs factual |
| `frontend/src/components/chat-composer.tsx` | 0 | Fix lint if approved | Low | Existing lint blocker |
| `tests/` | 0-6 | Add contract tests | Low | Must precede behavior changes |
| `frontend/src/__tests__/` | 0-6 | Frontend contract tests | Low | Socket/chat/card tests |
| `carabiner/runtime/` or similar new package | 1 | Adapter interfaces/implementations | Medium | New boundary |
| `carabiner/api/chats.py` | 1-5 | Route chat through adapter | High | A0/fallback logic |
| `carabiner/api/_a0_handlers.py` | 1-5 | API handler compatibility | High | A0-specific |
| `usr/tools/carabiner_read.py` | 1-3 | Current read implementation source | Medium | Wrap first |
| `usr/tools/carabiner_write.py` | 1-3 | Current write/policy source | High | Preserve guardrails |
| `python/tools/action_card.py` | 1-3 | Extract/wrap card emission | High | Payload contract |
| `python/tools/daily_brief_tool.py` | 1-3 | Preserve pure builder, wrap runtime | Medium | Existing tests |
| `python/websocket_handlers/state_sync_handler/action_cards_handler.py` | 1-5 | Realtime adapter bridge | High | A0 chat coupling |
| `usr/plugins/carabiner/extensions/python/startup_migration/_10_carabiner_init.py` | 1-5 | Bootstrap mapping | High | Writes A0 stubs |
| `usr/agents/` | 4 | Role migration source | Medium | Preserve role identities |
| `usr/prompts/` | 4-6 | Tool invocation prompt updates | Medium | Update after adapter exists |
| `frontend/next.config.ts` | 5 | Runtime routing target | High | Endpoint compatibility |
| `frontend/src/lib/socket-client.ts` | 5 | Realtime/auth assumptions | High | Avoid until adapter ready |
| `docker-compose.dev.yml` | 5 | Add Hermes service/fallback | High | Dev workflow |
| `Dockerfile.agent-zero` | 5-6 | A0-specific image | High | Do not remove early |
| `nginx.dev.conf` | 5 | Route Hermes/A0 fallback | High | Chat/socket routing |

## 9. Files Not to Touch Yet

| File/Directory | Reason to avoid | When it can be touched |
|---|---|---|
| `carabiner/db/migrations/` | DB schema change is not needed for adapter planning | Only if audit/action requirements prove missing schema |
| `carabiner/db/models.py` | Core restaurant data model should remain stable | After a formal migration ADR |
| `carabiner/db/workspace_models.py` | Contains current audit/event/product models | Only if adapter tests prove missing fields |
| `frontend/src/app/*/page.tsx` | Module pages are product UI, not runtime boundary | Only if adapter contract requires new endpoint shape |
| `frontend/src/components/action-card*.tsx` | Action-card UX/payload shape must remain stable | After payload contract tests pass |
| `carabiner/cli/commands/*` | CLI is stable tool boundary | Only if wrapper tests expose needed change |
| `tests/test_action_card_tool.py` | Existing passing tests are baseline | Extend, do not rewrite casually |
| `tests/test_daily_brief_tool.py` | Existing passing tests are baseline | Extend, do not weaken |
| `tests/test_action_cards_handler.py` | Existing websocket baseline | Extend, do not weaken |
| `engine/agent-zero` | Active runtime/submodule | Only after Hermes parity and owner approval |

## 10. Validation Commands

Baseline every phase:

```bash
docker compose -f docker-compose.dev.yml config
python3 -m pytest tests/test_action_card_tool.py tests/test_daily_brief_tool.py tests/test_action_cards_handler.py -q
cd frontend && pnpm test -- --runInBand
cd frontend && pnpm lint
```

Phase 0 additions:

```bash
git submodule update --init --recursive
python3 -m pytest tests/test_mcp_type_coercion.py -q
```

Phase 1 additions:

```bash
python3 -m pytest tests/test_chat_runtime_adapter.py tests/test_tool_execution_adapter_read.py tests/test_tool_execution_adapter_write.py -q
python3 -m pytest tests/test_action_card_adapter.py tests/test_realtime_event_adapter.py tests/test_audit_log_adapter.py -q
```

Phase 2 additions:

```bash
python3 -m pytest tests/test_hermes_read_only_slice.py -q
```

Phase 3 additions:

```bash
python3 -m pytest tests/test_hermes_write_policy_audit_slice.py -q
```

Phase 5 additions:

```bash
docker compose -f docker-compose.dev.yml up --build
python3 -m pytest tests/test_nginx_proxy_routing.py -q
```

## 11. Rollback Strategy

- Add runtime selection through environment/config, for example `CARABINER_RUNTIME=agent_zero|hermes`.
- Default to `agent_zero` until Hermes passes contract tests.
- Keep Agent Zero service in Docker while Hermes service is introduced.
- Keep A0 endpoints and Socket.IO route names stable during early phases.
- Each adapter should support A0 and Hermes implementations behind the same interface.
- If a Hermes slice fails, switch that slice back to A0 in config without reverting unrelated phases.
- Keep test fixtures for A0 current behavior as rollback oracle.
- Do not remove `engine/agent-zero`, `Dockerfile.agent-zero`, A0 plugin startup, or A0 tool wrappers until full parity is documented and approved.

## 12. Risks and Unknowns

- Hermes code/runtime is missing from this repo.
- Hermes API/process/model assumptions are unclear.
- Frontend lint currently fails on `frontend/src/components/chat-composer.tsx:163`.
- Optional MCP dependency is unresolved in system Python.
- Prompt/tooling drift exists between `code_execution_tool` instructions and `carabiner_read`/`carabiner_write`.
- Audit trail is partial; models exist but end-to-end audit writes are not proven for every mutation.
- A0 Socket.IO coupling is strong in `socket-client.ts`, nginx, and websocket handlers.
- Docker is coupled to `agent0ai/agent-zero-base`.
- Submodule state is coupled to Agent Zero and `git submodule status` reports an unrelated missing mapping for pre-existing `rune-business`.
- Local secrets/dev config risks exist around `usr/settings.json`, ignored env files, and dev secrets in Docker compose.

## 13. Questions for Esteban

1. Should Hermes eventually replace Agent Zero entirely, or only own orchestration while selected A0 tools remain available behind adapters?
2. Should `carabiner/mcp/server.py` be kept as a supported interface during Hermes migration?
3. Should `.rune/`, `rune-business`, and `rune-pro` be restored, archived, or formally removed before implementation begins?

## 14. Recommended Implementation Order

1. Fix or explicitly document current lint failure.
2. Resolve Python dependency environment and optional MCP stance.
3. Add adapter contract tests for existing A0 behavior.
4. Add adapter interfaces with A0-backed implementations only.
5. Add config flag for runtime selection, defaulting to Agent Zero.
6. Route one read-only chat/data path through Hermes via `carabiner_read`.
7. Add audit/policy/action-card contract tests for one write path.
8. Route one narrow write path through Hermes with policy and audit logging.
9. Map role prompts to Hermes role execution while preserving GM/AGM/Executive Chef/Sous Chef/Marketing/Expo.
10. Add Hermes Docker service and route only selected endpoints to it.
11. Prove parity with tests and smoke checks.
12. Archive/remove Agent Zero-specific code only after owner approval.

## 15. Success Criteria

Hermes migration succeeds when:

- local dev still runs
- current tests pass or are intentionally updated with documented reason
- new adapter/contract tests pass
- at least one read-only flow works through Hermes
- at least one write flow works through Hermes with policy + audit
- action cards still work
- card commit/dismiss/message flows still work
- restaurant role model is preserved
- CLI/domain behavior remains stable
- Docker/nginx/frontend routing remains understandable
- Agent Zero can be removed or disabled only after verified parity and owner approval
