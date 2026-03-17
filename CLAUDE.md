# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure (v2)

CarabinerOS v2 is a Turborepo monorepo with three layers:

```
carabiner-os/
├── apps/web/                 # Next.js 15 frontend (Phase 2+)
├── packages/api-types/       # Shared TypeScript types
├── engine/
│   ├── agent-zero/           # Git submodule — NEVER modify directly
│   ├── carabiner/            # CarabinerOS domain layer
│   │   ├── api/              # FastAPI routers
│   │   ├── domain/           # Pydantic models + business logic
│   │   ├── db/               # SQLAlchemy models + Alembic migrations
│   │   └── agent_overlay/    # Non-invasive Agent Zero customization
│   │       ├── tools/        # Restaurant tools (discovered via usr/ symlinks)
│   │       ├── extensions/   # Extension hooks (system_prompt, tool_execute_after, etc.)
│   │       ├── prompts/      # Prompt overrides
│   │       └── profiles/     # Agent profiles
│   ├── bridge.py             # FastAPI <-> Agent Zero bridge
│   ├── main.py               # FastAPI + Agent Zero boot
│   └── tests/
├── docker/
│   ├── docker-compose.yml    # web + engine + postgres
│   ├── Dockerfile.engine
│   └── Dockerfile.web
├── AgentCarabinerOS/         # Legacy v1 (gitignored, kept for reference)
└── docs/
```

## Commands

```bash
# Run engine (from engine/)
python main.py

# Run tests (from engine/)
python3 -m pytest tests/ -v

# Docker (from docker/)
docker compose up --build

# Monorepo (from root)
pnpm install
pnpm dev
```

## Architecture

### Agent Zero Integration (Overlay Pattern)

Agent Zero is a git submodule at `engine/agent-zero/`. It is NEVER modified directly.

Customization uses the **overlay pattern**:
1. `bridge.py` creates symlinks from `agent-zero/usr/tools/` -> `carabiner/agent_overlay/tools/`
2. Same for `usr/extensions/` -> `carabiner/agent_overlay/extensions/`
3. Agent Zero's `subagents.get_paths()` discovers overlay files via the `usr/` search path
4. The `usr/` directory is gitignored in Agent Zero, so symlinks are non-invasive

### Engine (FastAPI)

**Entry point:** `engine/main.py` — FastAPI + Socket.IO ASGI app.

- `bridge.py` — `AgentBridge` class: bootstraps Agent Zero, registers overlay, exposes `communicate()`.
- `carabiner/api/` — REST endpoints (health, orders, inventory, etc.)
- `carabiner/domain/` — Pydantic models and business logic (connectors, data builders)
- `carabiner/db/` — SQLAlchemy 2.0 models + Alembic migrations (Phase 1+)

### Frontend (Next.js — Phase 2+)

- `apps/web/` — Next.js 15 + shadcn/ui + Tailwind
- `packages/api-types/` — Shared TypeScript types generated from FastAPI schemas

### Key Patterns

- **Tool discovery:** Agent Zero finds tools via `subagents.get_paths()` searching `usr/ -> python/` hierarchy
- **Extension hooks:** Extensions at `extensions/<hook_point>/<priority_name>.py` are called during agent lifecycle
- **Overlay symlinks:** Created at boot by `bridge.py`, non-invasive to submodule
- **Immutable domain models:** Pydantic `frozen=True` for all domain entities

## Carabiner Domain

Restaurant operations logic (ported from v1):
- `carabiner/domain/connectors.py` — Provider connectors (Coastal Produce, Prime Meats, Heritage Bakery)
- `carabiner/agent_overlay/tools/` — Restaurant tools (ping_tool for now, order/inventory/prep/etc in Phase 5)
- `carabiner/agent_overlay/extensions/system_prompt/` — Injects restaurant context into agent prompts

## Legacy v1

The original monolith lives in `AgentCarabinerOS/` (gitignored). Key reference files:
- `python/helpers/carabiner_connectors.py` — Original connector logic
- `python/helpers/carabiner_data.py` — HQ data builder
- `python/tools/restaurant_ops.py` — Monolithic restaurant tool
- `webui/components/carabiner/carabiner-store.js` — Frontend state (900+ lines, seed data)
