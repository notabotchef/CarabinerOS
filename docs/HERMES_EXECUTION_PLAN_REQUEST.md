# Hermes Execution Plan Request

> **SUPERSEDED — 2026-07-09.** This document was written blind to hermes-agent (NousResearch, v0.14.0). The facts it assumes ("Hermes not present as active code", "no concrete Hermes package/API is assumed") are wrong; the package is installed locally and pin-publishable as `hermes-agent==0.14.0`. The **adapter-boundary thinking** (chat/tools/cards/audit/policy/realtime; test-first; A0 fallback) is sound and is adopted in `docs/HERMES_BETA_MIGRATION_PLAN.md`. For the current plan, read **FABLE_REPO_REAUDIT.md** + **HERMES_REQUIREMENTS_AND_CAPABILITIES.md** + **HERMES_BETA_MIGRATION_PLAN.md** instead.

## Mission

Create a phased execution plan to migrate CarabinerOS from the current Agent Zero-centered orchestration/runtime toward Hermes while preserving current working product behavior.

This request is for planning only. Do not perform the Hermes migration yet.

## Current Facts

Use facts from `docs/CARABINEROS_CURRENT_STATE_AUDIT.md` only.

- Canonical repo is CarabinerOS at `/Users/estebannunez/Projects/carabiner-os`.
- GitHub remote is `https://github.com/notabotchef/CarabinerOS.git`.
- FreshcOS is not the current product base. It is mostly upstream Agent Zero plus stale or abandoned overlay remnants.
- Agent Zero is the active runtime/orchestration layer.
- Agent Zero submodule lives at `engine/agent-zero`.
- Hermes is not active code yet.
- No Rust executor was found.
- Frontend is Next.js 16, React 19, TypeScript, Tailwind CSS 4 in `frontend/`.
- Domain/API/CLI is Python in `carabiner/`.
- Database layer is PostgreSQL, SQLAlchemy async, Alembic in `carabiner/db/`.
- A0 overlays/tools/plugins/prompts live in `usr/agents`, `usr/tools`, `usr/plugins/carabiner`, `usr/prompts`, `python/tools`, and `python/websocket_handlers`.
- Docker dev stack is `docker-compose.dev.yml`, `Dockerfile.agent-zero`, and `nginx.dev.conf`.
- Policy gating currently exists mostly through tool allowlists, prompts, validators, and action-card contracts.
- Auditability exists partially through database models and action/event logs.

Known checks from audit:

- `docker compose -f docker-compose.dev.yml config` passed.
- `python3 -m pytest tests/test_action_card_tool.py tests/test_daily_brief_tool.py tests/test_action_cards_handler.py -q` passed.
- `cd frontend && pnpm test -- --runInBand` passed.
- `cd frontend && pnpm lint` failed on `frontend/src/components/chat-composer.tsx:163`.
- MCP test failed in system Python with `ModuleNotFoundError: No module named 'mcp'`.
- FreshcOS overlay tests failed because expected overlay/bridge files are missing.

## Required Plan Sections

1. Current architecture verification
2. Agent Zero dependency map
3. Hermes target architecture
4. Adapter boundary design
5. Test-first migration strategy
6. Phase 0 repo stabilization
7. Phase 1 read-only flow migration
8. Phase 2 write flow migration with audit/action-card verification
9. Phase 3 orchestration replacement
10. Phase 4 cleanup and documentation
11. Rollback strategy
12. Validation commands
13. Risks and unknowns
14. Files to touch
15. Files not to touch yet

## Non-Negotiables

- no secrets committed
- preserve local dev
- preserve auditability
- preserve policy gates
- preserve current restaurant workflows
- do not remove Agent Zero until Hermes path is verified
- do not rewrite frontend unnecessarily
- do not collapse agents into an untraceable generic agent
- document every migration decision

## Output Format

Produce a concrete execution plan with:

- ordered phases
- owner assumptions
- implementation slices
- tests to write before each slice
- exact files/modules likely touched
- exact validation commands
- rollback points
- risks and open questions

Use file paths. Distinguish fact from inference. Do not rely on ChatGPT memory.
