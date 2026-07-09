# Hermes Migration Checklist

## P0 Repo Stabilization

- [ ] Confirm `main` branch and remote `git@github.com:notabotchef/CarabinerOS.git`.
- [ ] Confirm `docs/CARABINEROS_CURRENT_STATE_AUDIT.md` is current.
- [ ] Confirm `engine/agent-zero` submodule checkout succeeds from fresh clone.
- [ ] Decide what to do with pre-existing `.rune/` deletions.
- [ ] Decide what to do with `rune-business`, `rune-pro`, and `rune.config.json`.
- [ ] Decide whether `.claude/.../project_north_star.md` belongs in repo or stays local.
- [ ] Run `docker compose -f docker-compose.dev.yml config`.
- [ ] Run selected Python tests.
- [ ] Run frontend tests.
- [ ] Fix or formally document `pnpm lint` failure at `frontend/src/components/chat-composer.tsx:163`.
- [ ] Verify Python environment for optional MCP tests.
- [ ] Decide whether `carabiner/mcp/server.py` remains supported during migration.
- [ ] Record baseline command output in migration notes.

## P1 Adapter Scaffolding

- [ ] Create `carabiner/runtime/` package.
- [ ] Add runtime config loader with default `agent_zero`.
- [ ] Add `OrchestrationAdapter` interface.
- [ ] Add `ChatRuntimeAdapter` interface.
- [ ] Add `ToolExecutionAdapter` interface.
- [ ] Add `ActionCardAdapter` interface.
- [ ] Add `AuditLogAdapter` interface.
- [ ] Add `PolicyGateAdapter` interface.
- [ ] Add `RealtimeEventAdapter` interface.
- [ ] Implement Agent Zero-backed adapter versions.
- [ ] Add tests for A0-backed adapter behavior.
- [ ] Keep all existing A0 files in place.
- [ ] Confirm no endpoint or payload behavior changed.
- [ ] Run baseline checks.

## P2 Read-Only Hermes Slice

- [ ] Identify concrete Hermes runtime/API or stub a fake Hermes implementation for tests.
- [ ] Add read-only Hermes implementation behind `ToolExecutionAdapter`.
- [ ] Keep `CARABINER_RUNTIME=agent_zero` default.
- [ ] Add flag for one read-only route or flow.
- [ ] Route one chat request for restaurant data through `carabiner_read`.
- [ ] Prohibit writes in this slice.
- [ ] Assert no DB schema changes.
- [ ] Assert fallback to Agent Zero works by config.
- [ ] Run read-only Hermes slice tests.
- [ ] Run baseline checks.

## P3 Write Flow with Policy/Audit

- [ ] Choose one narrow write flow, preferably prep status update.
- [ ] Add `PolicyGateAdapter` checks before mutation.
- [ ] Require valid resource/verb allowlist.
- [ ] Require real `location_id` for create flows.
- [ ] Execute mutation through `ToolExecutionAdapter`.
- [ ] Write `ActionLog` or existing event record.
- [ ] Emit action card through `ActionCardAdapter`.
- [ ] Verify action-card payload shape.
- [ ] Verify audit log can be queried.
- [ ] Preserve Agent Zero fallback path.
- [ ] Run write-flow contract tests.
- [ ] Run baseline checks.

## P4 Role Agent Migration

- [ ] Inventory role prompts under `usr/agents/`.
- [ ] Map GM to Hermes router role.
- [ ] Map AGM to orders/inventory/invoices/vendors.
- [ ] Map Executive Chef to food cost/menu/recipes/P&L.
- [ ] Map Sous Chef to prep/station readiness.
- [ ] Map Marketing to campaigns/research.
- [ ] Map Expo to action-card quality/urgency checks.
- [ ] Preserve role names and restaurant identity.
- [ ] Update prompt/tool invocation only after adapter tests pass.
- [ ] Add role routing tests.
- [ ] Prove no role collapsed into generic agent.

## P5 Runtime Replacement

- [ ] Add Hermes Docker service without removing `agent-zero`.
- [ ] Add route/config switch for Hermes chat path.
- [ ] Add route/config switch for Hermes realtime path.
- [ ] Move startup/bootstrap behind non-A0 path.
- [ ] Replace A0 API handler use only after equivalent route tests pass.
- [ ] Verify frontend works against selected Hermes paths.
- [ ] Verify nginx routing and Next rewrites remain understandable.
- [ ] Run full Docker smoke test.
- [ ] Keep rollback to Agent Zero available.
- [ ] Document parity evidence.

## P6 Cleanup/Docs

- [ ] Update `README.md`.
- [ ] Update `docs/ARCHITECTURE.md`.
- [ ] Update migration notes with every decision.
- [ ] Archive A0-specific docs only after owner approval.
- [ ] Remove A0-specific generated stubs only after tests pass.
- [ ] Remove `Dockerfile.agent-zero` only after replacement image proves stable.
- [ ] Remove `engine/agent-zero` submodule only after verified parity and owner approval.
- [ ] Clean dependency/config drift.
- [ ] Run full test/check suite.
- [ ] Tag or record migration milestone.

## Non-Negotiable Checks

- [ ] No secrets committed.
- [ ] Local dev still runs.
- [ ] Auditability preserved.
- [ ] Policy gates preserved.
- [ ] Restaurant workflows preserved.
- [ ] Agent Zero not removed before Hermes verified.
- [ ] Frontend not rewritten unnecessarily.
- [ ] Role model preserved.
- [ ] Action-card UX preserved.
- [ ] Current CLI/domain behavior preserved.
