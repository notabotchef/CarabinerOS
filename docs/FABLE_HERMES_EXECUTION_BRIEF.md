# Fable Hermes Execution Brief

> **SUPERSEDED — 2026-07-09.** This document was written blind to hermes-agent (NousResearch, v0.14.0). The facts it assumes ("Hermes not present as active code", "no concrete Hermes package/API is assumed") are wrong; the package is installed locally and pin-publishable as `hermes-agent==0.14.0`. The **adapter-boundary thinking** (chat/tools/cards/audit/policy/realtime; test-first; A0 fallback) is sound and is adopted in `docs/HERMES_BETA_MIGRATION_PLAN.md`. For the current plan, read **FABLE_REPO_REAUDIT.md** + **HERMES_REQUIREMENTS_AND_CAPABILITIES.md** + **HERMES_BETA_MIGRATION_PLAN.md** instead.

## 1. Purpose

Fable's job is to create a Hermes execution plan for CarabinerOS. This is planning work, not a blind coding sprint and not the Hermes migration itself.

Fable should use the completed audit, verify active files, identify the current Agent Zero boundary, and produce a phased execution plan that preserves current product behavior.

## 2. Current Source of Truth

Canonical source of truth: `/Users/estebannunez/Projects/carabiner-os`.

GitHub-bound repo: `https://github.com/notabotchef/CarabinerOS.git`.

Reference/non-canonical project: `/Users/estebannunez/Projects/FreshcOS`.

FreshcOS is not the current product base. It is mostly upstream Agent Zero plus stale or abandoned overlay remnants. It may contain newer upstream Agent Zero commits, but the current CarabinerOS product source is `carabiner-os`.

## 3. Current Architecture Summary

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4 in `frontend/`.
- Domain/API/CLI: Python restaurant code in `carabiner/`.
- Database: PostgreSQL, SQLAlchemy async, Alembic migrations in `carabiner/db/`.
- Runtime/orchestration: Agent Zero is active runtime today.
- Engine: Agent Zero submodule at `engine/agent-zero`.
- A0 overlays: `usr/agents`, `usr/tools`, `usr/plugins/carabiner`, `usr/prompts`, `python/tools`, `python/websocket_handlers`.
- Realtime: Socket.IO action-card and chat flow through Agent Zero assumptions.
- Docker dev stack: `docker-compose.dev.yml`, `Dockerfile.agent-zero`, `nginx.dev.conf`.
- Hermes: documentation/planning only. No active Hermes runtime exists yet.

## 4. Files Fable Must Read First

- `docs/CARABINEROS_CURRENT_STATE_AUDIT.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docker-compose.dev.yml`
- `Dockerfile.agent-zero`
- `nginx.dev.conf`
- `frontend/next.config.ts`
- `frontend/src/lib/socket-client.ts`
- `carabiner/api/_a0_handlers.py`
- `carabiner/api/chats.py`
- `usr/plugins/carabiner/extensions/python/startup_migration/_10_carabiner_init.py`
- `usr/tools/carabiner_read.py`
- `usr/tools/carabiner_write.py`
- `python/tools/action_card.py`
- `python/tools/daily_brief_tool.py`
- `python/websocket_handlers/state_sync_handler/action_cards_handler.py`
- `carabiner/db/models.py`
- `carabiner/db/workspace_models.py`
- `carabiner/db/repositories.py`

## 5. Current Orchestration Boundary

Agent Zero currently owns the runtime/orchestration boundary. It provides chat runtime, tool execution, subagent delegation, Socket.IO integration, API handler dispatch, model routing, and task/scheduler behavior.

Likely migration boundary:

- chat send/stream
- tool execution
- action-card emission
- websocket events
- policy-gated writes
- audit/action logging
- role prompts/agents
- Docker service wiring

## 6. Hermes Migration Surface

Likely needs to change:

- Agent Zero runtime boundary
- Agent Zero tool wrappers
- A0-specific API handlers
- A0 Socket.IO/event assumptions
- startup plugin registration
- Docker service shape
- prompt/tool invocation contracts

Likely should remain:

- restaurant domain models
- database schema/migrations
- CLI behavior where useful
- frontend module pages
- action-card payload contract
- audit/event models
- restaurant-role product identity

## 7. What Must Not Break

- current frontend tests
- action-card tests
- daily brief tests
- CLI read/write behavior
- database schema/migrations
- Docker dev route assumptions
- auditability
- policy-gated mutations
- restaurant workflows: orders, inventory, prep, invoices, recipes, menu, food cost, reporting

## 8. Required Fable Output

Fable must produce an execution plan before implementation.

Plan must include:

- phased migration plan
- adapter boundaries
- files/modules to touch
- files/modules not to touch yet
- tests to write first
- validation commands
- rollback strategy
- risk list
- open questions
- estimated execution order for Hermes

## 9. Recommended First 3 Hours for Fable

Hour 1:

- read audit and core files
- verify repo structure
- identify active Agent Zero integration points

Hour 2:

- design orchestration adapter boundary
- map A0 dependencies to Hermes equivalents
- list contract tests needed before code changes

Hour 3:

- write execution plan
- identify smallest first migration slice
- prepare implementation checklist

## 10. Prompt to Give Fable

You are Fable working on CarabinerOS. Your mission is to create a Hermes execution plan, not to start migration code immediately.

Use only file-based facts from this repo. Read `docs/CARABINEROS_CURRENT_STATE_AUDIT.md` first, then read the files listed in `docs/FABLE_HERMES_EXECUTION_BRIEF.md`.

Current facts:

- canonical repo is `/Users/estebannunez/Projects/carabiner-os` and GitHub remote is `https://github.com/notabotchef/CarabinerOS.git`
- FreshcOS is not the current product base
- Agent Zero is active runtime/orchestration today
- Hermes is not active code yet
- no Rust executor was found
- current stack is Next.js frontend, Python domain/API/CLI, PostgreSQL/SQLAlchemy/Alembic, Agent Zero overlays, Socket.IO action cards, Docker compose

Produce a phased Hermes execution plan that preserves current restaurant workflows and creates adapter boundaries before replacement. Do not remove Agent Zero until a Hermes path is verified. Do not rewrite the frontend unnecessarily. Do not bypass policy-gated writes or audit/action traces.

Your output must include:

- current architecture verification
- Agent Zero dependency map
- Hermes target architecture
- adapter boundary design
- test-first migration strategy
- Phase 0 repo stabilization
- Phase 1 read-only flow migration
- Phase 2 write flow migration with audit/action-card verification
- Phase 3 orchestration replacement
- Phase 4 cleanup and documentation
- rollback strategy
- validation commands
- risks and unknowns
- files to touch
- files not to touch yet
- open questions for Esteban

Report progress with files read, evidence found, decisions made, and checks run. Keep CarabinerOS restaurant-ops identity intact.
