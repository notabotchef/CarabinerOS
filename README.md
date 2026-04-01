# CarabinerOS

AI-powered restaurant management platform. Built on [Agent Zero](https://github.com/agent0ai/agent-zero).

CarabinerOS replaces the spreadsheet-and-gut-feeling ops stack with an AI general manager that reads your data, drafts orders, tracks food cost, and manages prep — all through natural conversation.

## Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion, shadcn/ui |
| **AI Engine** | Agent Zero v1.6 (git submodule), LiteLLM, multi-agent delegation |
| **Backend** | Python 3.12, Flask, Uvicorn (ASGI), Socket.IO AsyncServer |
| **Database** | PostgreSQL 16, SQLAlchemy 2.0 async, asyncpg |
| **CLI** | Typer + Rich — 8 resources, read/write commands |
| **Infra** | Docker Compose, nginx reverse proxy |

## Architecture

```
carabiner-os/
├── engine/agent-zero/     ← git submodule (A0 v1.6, read-only, never modified)
├── carabiner/             ← domain code
│   ├── cli/               ← Typer CLI (orders, inventory, prep, menu, recipes, invoices, food-cost, vendors)
│   ├── db/                ← SQLAlchemy models, repositories, seed data, migrations
│   └── api/               ← A0-compatible API handler factory
├── frontend/              ← Next.js 16 app
│   └── src/app/           ← Pages: orders, inventory, prep, food-cost, menu, recipes, invoices, marketing, reporting, settings, plugins
├── usr/                   ← A0 runtime config (plugins, extensions, agents)
│   ├── plugins/carabiner/ ← startup extension (DB init, API stub generation)
│   ├── agents/            ← agent profiles (GM, AGM, Executive Chef, Sous Chef, Marketing)
│   └── knowledge/         ← CLI reference docs for A0's RAG
├── docker-compose.dev.yml
├── Dockerfile.agent-zero  ← FROM agent0ai/agent-zero-base:latest + CarabinerOS layer
└── nginx.dev.conf
```

**Key principle**: Zero patches to Agent Zero. CarabinerOS is a pure overlay — plugins, extensions, and domain code only.

## Quick Start

```bash
# Full stack: PostgreSQL + Agent Zero + Frontend + nginx
docker compose -f docker-compose.dev.yml up

# Access points
# CarabinerOS:  http://localhost:8080
# Agent Zero:   http://localhost:5050
# A0 via nginx: http://localhost:8080/a0/
```

## Agent System

CarabinerOS uses a multi-agent architecture with kitchen-inspired roles:

| Agent | Role | Responsibilities |
|-------|------|-----------------|
| **GM** | Router | Receives all requests, delegates to specialists |
| **AGM** | Purchasing | Orders, inventory, invoices, vendor management |
| **Executive Chef** | Cost Control | Food cost, menu engineering, P&L, recipes |
| **Sous Chef** | Kitchen Ops | Prep lists, station readiness, shortage tracking |
| **Marketing** | Growth | Campaigns, competitive research, promotional briefs |

Agents query the database via the `carabiner` CLI (read) and write via CLI commands. All tool calls use A0's `code_execution_tool`.

## CLI

```bash
# Read
carabiner orders list --json
carabiner inventory list --json
carabiner food-cost list --json

# Write
carabiner orders create --location-id UUID --vendor "Coastal Produce" --channel Email --json
carabiner orders update UUID --status "Ready to send" --total 1240.00 --json
carabiner prep update UUID --readiness Ready --json
```

8 resources: `orders`, `inventory`, `prep`, `menu`, `recipes`, `invoices`, `food-cost`, `vendors`

## Development

```bash
# Frontend only (proxies API to backend)
cd frontend && pnpm dev

# Backend only (from project root)
python run_ui.py

# Full Docker stack
docker compose -f docker-compose.dev.yml up

# Seed database (3,037 records — Carabiner Tapas, March 2026)
docker compose exec agent-zero bash -c \
  'source /opt/venv-a0/bin/activate && PYTHONPATH=/cos python -m carabiner.db.seed_realistic --no-confirm'
```

## Database

37 tables covering: locations, orders, inventory, prep lists, menu items, recipes (modernist format with components/steps/ingredients), invoices, food cost, daily P&L, budget periods, campaigns, action logs, and more.

## License

Proprietary. All rights reserved.
