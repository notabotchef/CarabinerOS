# Developer Guide: Carabiner OS

## What This Does
Restaurant management dashboard powered by Agent Zero (AI agent framework). Provides real-time order tracking, inventory, prep scheduling, menu management, invoicing, marketing, and financial reporting — with AI-driven action cards surfacing urgent items.

## Quick Setup

```bash
# 1. Activate Python virtual environment
source .venv/bin/activate

# 2. Install Python dependencies
pip install -r requirements.txt
playwright install chromium

# 3. Start backend (Flask + Socket.IO on port 5000)
python run_ui.py

# 4. In a separate terminal, start frontend
cd frontend
pnpm install
pnpm dev

# 5. Visit http://localhost:3000 (frontend proxies API calls to :5000)

# Alternative: full Docker stack (PostgreSQL + backend + frontend + nginx)
docker compose -f docker-compose.dev.yml up
# Visit http://localhost:8080

# Run tests
pytest tests/
```

## Key Files
- `run_ui.py` — Flask/Uvicorn entry point, Socket.IO server, session management
- `agent.py` — Agent context & execution engine (AgentContext, task framework)
- `models.py` — LiteLLM model configuration, multi-provider LLM support
- `initialize.py` — Bootstrap: agent config, MCP setup, DB migrations, preload
- `carabiner/db/models.py` — 22 SQLAlchemy ORM models (restaurant domain)
- `carabiner/api/flask_blueprint.py` — REST API routes (GET-only, JSON)
- `carabiner/api/schemas.py` — Pydantic v2 request/response schemas
- `frontend/src/lib/types.ts` — All TypeScript interfaces (ActionCard, A0Snapshot, etc.)
- `frontend/src/hooks/use-action-cards.ts` — Action card state + Socket.IO integration
- `frontend/src/components/shell.tsx` — Core UI layout with sidebar + workspace

## Common Issues
- **Backend won't start** — Virtual environment not activated. Run: `source .venv/bin/activate`
- **ModuleNotFoundError** — Dependencies outdated. Run: `pip install -r requirements.txt`
- **Frontend API calls fail (CORS/404)** — Backend must be running on port 5000 (or set `A0_URL` env var)
- **Database connection errors** — PostgreSQL must be running. Use Docker: `docker compose -f docker-compose.dev.yml up postgres`
- **Socket.IO disconnect** — Check that backend and frontend are using the same port; review `A0_URL` in `frontend/next.config.ts`
