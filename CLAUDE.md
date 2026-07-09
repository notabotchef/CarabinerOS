# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Carabiner OS is a restaurant management dashboard with Hermes (NousResearch `hermes-agent` ≥ v0.18.2, see `docs/HERMES_REQUIREMENTS_AND_CAPABILITIES.md` for the version on the build host) as the backend intelligence. It combines a **Next.js 16 frontend** with a **Python bridge + Socket.IO backend** and a **PostgreSQL database** (via SQLAlchemy async).

> **SUPERSEDED — 2026-07-09.** The previous "Agent Zero / Flask / run_ui.py / .venv at root" framing in this file described the absent `engine/agent-zero` submodule and is no longer accurate. The beta runtime is the in-repo bridge under `carabiner/runtime/`. See `docs/FABLE_REPO_REAUDIT.md` for the audit trail and `docs/HERMES_BETA_MIGRATION_PLAN.md` for the current plan.

## Tech Stack
- **Frontend**: Next.js 16.2 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Framer Motion, shadcn/ui, Socket.IO client
- **Backend bridge**: `carabiner/runtime/` — FastAPI + python-socketio ASGI; `python -m carabiner.runtime.server`. Defaults `CARABINER_RUNTIME=echo` for hermetic dev; `hermes` for production.
- **Intelligence backend**: Hermes (`hermes-agent` ≥ v0.18.2) running as a separate gateway on `127.0.0.1:8642`. See `docs/HERMES_REQUIREMENTS_AND_CAPABILITIES.md`.
- **Database**: PostgreSQL 16, SQLAlchemy 2.0 async + asyncpg, Alembic migrations
- **Package Managers**: pnpm (frontend), pip + venv (backend bridge + hermes env)
- **Testing**: pytest with pytest-asyncio (backend, in `tests/`); bridge tests in `tests/runtime/`
- **Linting**: ESLint flat config (frontend), no Python linter configured
- **Python Environment**: venv (`.venv/` at project root)

## Design Tokens (MANDATORY)

**You MUST read `DESIGN_TOKENS.md` before writing or modifying any frontend component.** This is non-negotiable — it prevents the "5 different designers" problem where each agent invents its own micro-design-system.

Key rules (full spec in `DESIGN_TOKENS.md`):
- **Fonts**: DM Sans for text (no class needed), Geist Mono (`font-mono`) for ALL numbers/dates/prices
- **Colors**: Use Tailwind keywords (`amber-500`, `emerald-400`), never hardcoded hex in classNames
- **Radius**: ALL cards = `rounded-xl`. No `rounded-[13px]`, no `rounded-2xl`
- **Shadows**: `shadow-sm` at rest, `shadow-md` on hover. No `shadow-lg`, no custom shadows on cards
- **Padding**: Card body = `p-4`. Grid gap = `gap-4`. No exceptions
- **Opacity**: Only 6 levels: `/5`, `/10`, `/20`, `/40`, `/60`, `/85`
- **Charts**: Use `useChartTheme()` hook for dark/light colors. Hex values only in Recharts SVG context
- **No JS color objects**: Don't define `const COLORS = { urgent: "#hex" }`. Use Tailwind classes

## Delegation Rule: Reach-In vs Walk-In

**If a task requires more than ~30 lines of changes, delegate it to an agent.** Do not implement it inline.

- **Reach-in** (< 30 lines): Handle it yourself directly. Quick edits, small fixes, config changes.
- **Walk-in** (> 30 lines): Spawn an agent with `/rune:cook`. The agent works on a safe branch with full autonomy, completes the task, and reports back. You stay on the pass coordinating.

The agent MUST:
1. Use `/rune:cook` to run the full TDD cycle
2. Work on a feature branch (never main)
3. Report back with what was done, files changed, and branch name

This is non-negotiable. Think like an executive chef during service: if the chives are in the reach-in, grab them yourself. If they're in the walk-in, send someone.


## Development Commands

### Frontend (from `frontend/`)
```bash
pnpm dev          # Start Next.js dev server (proxies API to bridge at A0_URL, default http://localhost:8641)
pnpm build        # Production build
pnpm lint         # ESLint (flat config, next/core-web-vitals + typescript)
```

### Bridge backend (from project root)
```bash
pip install -r carabiner/runtime/requirements.txt   # bridge deps (fastapi, socketio, httpx, mcp==1.26.0)
python -m carabiner.runtime.server                  # bridge on :8641 (CARABINER_RUNTIME=echo by default)
CARABINER_RUNTIME=hermes HERMES_BASE_URL=http://127.0.0.1:8642 API_SERVER_KEY=... \
  python -m carabiner.runtime.server                # bridge with real hermes intelligence
```

### Hermes gateway (separate process, from project root)
```bash
pip install hermes-agent==0.18.2
hermes-agent gateway --config var/hermes-home/config.yaml    # binds 127.0.0.1:8642
```

### Local end-to-end (one script)
```bash
scripts/run_hermes_beta.sh   # renders var/hermes-home/, starts bridge + hermes, waits for /api/health
```

### Docker (full stack — Hermes beta)
```bash
docker compose -f docker-compose.hermes.yml up    # PostgreSQL + bridge + hermes + frontend + nginx on :8080
```

### Tests
```bash
pytest tests/                                   # all backend tests
pytest tests/runtime/ -q                        # bridge tests only
pytest tests/runtime/test_chat_flow.py -q       # one file
```

### Architecture

### Two-Layer System (beta)
1. **Hermes bridge** (`carabiner/runtime/`) — FastAPI + python-socketio. Owns the frontend contract verbatim (CSRF, `/message_async`, `/chats`, socket envelope). Delegates intelligence to either the pinned hermes gateway (`CARABINER_RUNTIME=hermes`) or a canned responder (`CARABINER_RUNTIME=echo`). Scoped 2-tool MCP surface mounted at `/mcp`. Host-side policy gate (`carabiner/runtime/policy.py`) enforces verb×resource allowlist before any mutation; AUDIT_REQUIRED fails closed.
2. **Carabiner domain** (`carabiner/` root) — restaurant-specific ORM models, repositories, MCP helpers (`carabiner/mcp/server.py` is the helper source — `_resolve_repo_fn`, `_coerce_types`, `_prepare_data`, `_MODULE_REGISTRY` with 8 modules). ActionLog model at `carabiner/db/workspace_models.py:388`.

### Bridge entry point (`carabiner/runtime/server.py`)
- FastAPI app wrapped via `socketio.ASGIApp` with `/ws` namespace; mounted at `/socket.io`; HTTP routes under `/api`
- `GET /csrf_token`, `POST /message_async`, `POST /chat_create`, `GET /chats`, `POST /chat_remove`, `POST /chat_load`, `GET /api/health`, plus 8 module read routes (`/api/orders`, `/api/inventory`, `/api/prep`, `/api/food-cost`, `/api/menu`, `/api/recipes`, `/api/invoices`, `/api/campaigns`)
- Socket handlers: `connect` (CSRF + handlers), `state_request` (always full snapshot), `card_commit` / `card_dismiss` / `card_message` (real lifecycle — replaces the A0-side no-ops)
- Mounts FastMCP `streamable_http_app()` at `/mcp` so hermes can register the scoped 2-tool surface

### Frontend (`frontend/`)
- **Next.js 16** App Router with **React 19**, **Tailwind CSS 4**, **Framer Motion**, **shadcn/ui**
- **IMPORTANT**: This uses Next.js 16 which has breaking changes from earlier versions. Always read `node_modules/next/dist/docs/` before writing Next.js code.
- Path alias: `@/*` maps to `./src/*`
- `next.config.ts` rewrites specific API paths (`/message`, `/chats`, `/chat_load`, etc.) to the backend
- Socket.IO client (`lib/socket-client.ts`) connects directly to the backend for real-time events
- Key hooks: `use-action-cards.ts` (card state + Socket.IO), `use-chat.ts`, `use-socket.ts`, `use-expo-stream.ts`
- Types defined in `lib/types.ts` — `ActionCard`, `A0LogEntry`, `A0Snapshot`, `ChatMessage`

### Database
- PostgreSQL 16 with SQLAlchemy 2.0 async + asyncpg
- 22 ORM models in `carabiner/db/models.py` (Location, Order, Inventory, Menu, Recipe, Invoice, Campaign, DailyPL, FoodCost, etc.)
- Workspace-scoped models in `carabiner/db/workspace_models.py`
- Alembic migrations in `carabiner/db/migrations/`
- Connection string via `DATABASE_URL` env var

### Action Cards System (current feature branch)
- Backend emits action cards via Socket.IO (`action_card` event)
- Card types: urgent, action, update, info — with priority, deadline, status tracking
- Frontend components: `action-card.tsx` (collapsed), `action-card-expanded.tsx` (expanded), `notification-panel.tsx`
- Socket events: `action_card`, `card_reply`, `card_commit`, `card_dismiss`, `card_message`

### Restaurant Modules
Orders, Inventory, Prep, Menu, Recipes, Invoices, Marketing, Reporting, Food Cost — each has a page under `frontend/src/app/[module]/` and a corresponding API endpoint.

## Conventions
- **Python naming**: snake_case functions/variables, PascalCase classes, `test_` prefix for test files
- **TypeScript naming**: PascalCase components, camelCase functions/handlers, kebab-case filenames
- **Python imports**: Absolute from project root (`from python.helpers import ...`, `from carabiner.db import ...`)
- **TypeScript imports**: Path alias `@/*` → `./src/*`
- **Python type hints**: Modern union syntax (`str | None`), full annotations on public APIs
- **API response format**: `{"ok": True, "data": ...}` / `{"ok": False, "error": "..."}`
- **API handler pattern**: Classes inheriting `ApiHandler` with `async def process(...)` method
- **Error handling**: try/except in Python API handlers; TypeScript uses type narrowing
- **Tests**: Function-based pytest (no test classes), `@pytest.mark.asyncio` for async tests, separate `tests/` directory

## Common Issues

### Frontend dev server returns 500 / connection refused on API calls
The Next.js dev server proxies all API requests to the bridge via `A0_URL` (default `http://localhost:8641`). If the bridge is not running, every `/api/*`, `/message`, `/chats`, etc. request will fail. Always start the bridge first:
```bash
python -m carabiner.runtime.server  # terminal 1 (from project root)
cd frontend && pnpm dev             # terminal 2
```

### Bridge falls back to echo when hermes is unreachable
If `HERMES_BASE_URL` is unreachable, `message_async` returns `{context}` and pushes an apology log instead of 500. The bridge stays up so the frontend never sees a hard failure. See `tests/runtime/test_chat_flow_hermes.py`.

### MCP surface vs legacy 63-tool server
The bridge exposes a **scoped 2-tool** FastMCP at `/mcp` (`carabiner_read`, `carabiner_propose_write`) — NOT the 63-tool legacy server. The hermes config points at it by URL (`mcp_servers.carabiner.url: "http://localhost:8641/mcp"` in local dev).

## Key Environment Variables
- `A0_URL` — Backend URL for Next.js rewrites (default: `http://localhost:5000`)
- `DATABASE_URL` — PostgreSQL connection string (asyncpg dialect)
- `WEB_UI_PORT` / `WEB_UI_HOST` — Backend bind config
- `A0_SET_*` — Override Agent Zero settings without modifying code
