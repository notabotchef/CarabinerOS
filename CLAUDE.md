# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Carabiner OS is a restaurant management dashboard built on top of Agent Zero, an agentic AI framework. It combines a **Next.js 16 frontend** with a **Python/Flask + Socket.IO backend** and a **PostgreSQL database** (via SQLAlchemy async).

## Tech Stack
- **Frontend**: Next.js 16.2 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Framer Motion, shadcn/ui, Socket.IO client
- **Backend**: Python 3.10+, Flask 3.0, Uvicorn (ASGI), Socket.IO AsyncServer, LiteLLM
- **Database**: PostgreSQL 16, SQLAlchemy 2.0 async + asyncpg, Alembic migrations
- **Package Managers**: pnpm (frontend), pip + venv (backend)
- **Testing**: pytest with pytest-asyncio (backend only, in `tests/`)
- **Linting**: ESLint flat config (frontend), no Python linter configured
- **Python Environment**: venv (`.venv/` at project root)

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
pnpm dev          # Start Next.js dev server (proxies API to backend at A0_URL, default http://localhost:5000)
pnpm build        # Production build
pnpm lint         # ESLint (flat config, next/core-web-vitals + typescript)
```

### Backend (from project root)
```bash
pip install -r requirements.txt    # Install Python deps
playwright install chromium         # Browser automation binary
python run_ui.py                    # Start Flask/Uvicorn on port 5000
```

### Docker (full stack)
```bash
docker compose -f docker-compose.dev.yml up    # PostgreSQL + backend + frontend + nginx on :8080
```

### Tests
```bash
pytest tests/                       # Run all tests (pytest, in tests/ directory)
pytest tests/test_http_auth_csrf.py # Run a single test file
```

## Architecture

### Two-Layer System
1. **Agent Zero** (upstream framework) — `agent.py`, `models.py`, `run_ui.py`, `initialize.py`, `python/` directory. Provides the agentic runtime, LLM orchestration (via LiteLLM), tools, memory, and the Flask+Socket.IO server.
2. **Carabiner** (restaurant domain) — `carabiner/` directory. Adds restaurant-specific ORM models, API routes, and business logic on top of Agent Zero without modifying core files.

### Backend (`run_ui.py` entry point)
- Flask app wrapped in Starlette + Uvicorn with Socket.IO AsyncServer
- API endpoints in `python/api/` (75+ handlers) — chat, memory, settings, MCP, scheduler, notifications
- Carabiner REST routes registered via Flask blueprint (`carabiner/api/flask_blueprint.py`) — all GET-only, JSON responses, optional `?location_id=UUID` filtering
- Real-time communication via Socket.IO events (action cards, chat streaming, expo)

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
The Next.js dev server proxies all API requests to the backend via `A0_URL` (default `http://localhost:5000`). If the Flask/Uvicorn backend is not running, every `/api/*`, `/message`, `/chats`, etc. request will fail. Always start the backend first:
```bash
python run_ui.py        # terminal 1 (from project root)
cd frontend && pnpm dev # terminal 2
```

### MCP server "command not found"
The `mcp_servers` field in `usr/settings.json` uses `.venv/bin/python` (a relative path). This requires the backend to be started from the project root. If you need a machine-specific override, copy `usr/settings.local.json.example` to `usr/settings.local.json` and adjust paths there.

## Key Environment Variables
- `A0_URL` — Backend URL for Next.js rewrites (default: `http://localhost:5000`)
- `DATABASE_URL` — PostgreSQL connection string (asyncpg dialect)
- `WEB_UI_PORT` / `WEB_UI_HOST` — Backend bind config
- `A0_SET_*` — Override Agent Zero settings without modifying code
