# CarabinerOS

AI-powered restaurant operations platform built on Agent Zero.

## Architecture

- **Back of House (BOH):** Agent Zero — Flask + Socket.IO on port 5000. Runs AI agents, tools, LLM.
- **Front of House (FOH):** Next.js — React app on port 3000. The Expo Station UI.
- **Database:** PostgreSQL via async SQLAlchemy + Alembic migrations.

## Critical Rule

**Never modify Agent Zero core files** (`agent.py`, `python/`, `run_ui.py`, `initialize.py`, `webui/`).
All customization goes in:
- `usr/` — Agent overlay (tools, agent profiles, extensions)
- `carabiner/` — Domain layer (API, database, protocols)
- `frontend/` — Next.js app

## How to Run

Terminal 1 — Postgres:
    docker compose -f docker-compose.dev.yml up

Terminal 2 — Agent Zero (BOH):
    python run_ui.py

Terminal 3 — Next.js (FOH):
    cd frontend && pnpm dev

Visit http://localhost:3000

## LLM Configuration

In `usr/.env` — MUST use `ollama_chat` provider (not `ollama` — the async handler hangs):

    A0_SET_chat_model_provider=ollama_chat
    A0_SET_chat_model_name=glm-4.7-flash:latest
    A0_SET_chat_model_api_base=http://localhost:11434

## Tech Stack

- Agent Zero (Python/Flask/Socket.IO) — MIT licensed
- Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
- PostgreSQL 16, SQLAlchemy (async), Alembic
- socket.io-client for frontend ↔ Agent Zero communication
- Ollama (dev) / Cloud LLM APIs (prod) via litellm

## Upstream Updates

    git fetch upstream
    git merge upstream/main
