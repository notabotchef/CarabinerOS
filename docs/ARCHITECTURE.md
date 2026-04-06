# CarabinerOS Architecture

AI-native restaurant management platform. Built on Agent Zero, a multi-agent AI framework that reads your data, drafts orders, tracks food cost, and manages prep through natural conversation.

## System Overview

CarabinerOS is a two-layer system:

```
┌─────────────────────────────────────────────────────┐
│                    CarabinerOS                       │
│  (domain code — orders, inventory, prep, agents)     │
├─────────────────────────────────────────────────────┤
│                    Agent Zero                         │
│  (framework — agentic runtime, LLM orchestration,    │
│   tool system, memory, Flask+Socket.IO server)       │
└─────────────────────────────────────────────────────┘
```

**Zero patches to Agent Zero.** CarabinerOS runs entirely as an overlay using plugins, extensions, and domain code. Agent Zero is a git submodule we consume but never modify.

## Directory Structure

```
carabiner-os/
├── .claude/                   # Agent configuration (skills, prompts)
├── .rune/                     # Rune workflow plans and decisions
├── carabiner/                 # Domain code
│   ├── api/                   # Flask blueprint + API handlers
│   │   ├── flask_blueprint.py # REST routes (GET-only, JSON)
│   │   └── handlers/          # Resource-specific endpoints
│   ├── cli/                   # Typer + Rich CLI
│   │   ├── __main__.py        # CLI entry point
│   │   └── commands/          # orders, inventory, prep, menu, recipes,
│   │                          # invoices, food-cost, vendors
│   ├── db/                    # Data layer
│   │   ├── models.py          # 22 SQLAlchemy ORM models
│   │   ├── workspace_models.py# Workspace-scoped models
│   │   ├── repositories/      # Query abstractions
│   │   ├── seed_realistic.py  # 3,037 records seed (Carabiner Tapas)
│   │   └── migrations/        # Alembic migrations
│   ├── plugins/               # A0 plugin registration
│   │   └── carabiner/         # Auto-init plugin (DB + API stubs)
│   ├── services/              # Business logic
│   ├── agents/                # Agent profiles & prompts
│   │   ├── gm.yaml            # General Manager (router)
│   │   ├── agm.yaml           # Assistant GM (purchasing)
│   │   ├── executive_chef.yaml# Cost control
│   │   ├── sous_chef.yaml     # Kitchen ops
│   │   └── marketing.yaml     # Campaigns & growth
│   └── knowledge/             # CLI reference docs for A0's RAG
├── frontend/                  # Next.js 16 app
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   │   ├── orders/
│   │   │   ├── inventory/
│   │   │   ├── prep/
│   │   │   ├── food-cost/
│   │   │   ├── menu/
│   │   │   ├── recipes/
│   │   │   ├── invoices/
│   │   │   ├── marketing/
│   │   │   ├── reporting/
│   │   │   ├── settings/
│   │   │   └── plugins/
│   │   ├── components/        # Reusable UI components
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── use-action-cards.ts
│   │   │   ├── use-chat.ts
│   │   │   ├── use-socket.ts
│   │   │   └── use-expo-stream.ts
│   │   ├── lib/               # Utilities
│   │   │   ├── socket-client.ts
│   │   │   └── types.ts       # ActionCard, A0LogEntry, ChatMessage
│   │   └── styles/            # Tailwind CSS 4 config
│   ├── public/                # Static assets
│   └── next.config.ts         # API rewrites to backend
├── engine/agent-zero/         # Git submodule (read-only)
├── tests/                     # Backend test suite (pytest)
├── docs/                      # Project documentation
│   ├── CLAUDE.md              # AI agent instructions
│   ├── DESIGN_TOKENS.md       # Frontend design system
│   └── README.md              # This file's sibling
├── docker-compose.dev.yml     # Full stack orchestration
├── Dockerfile.agent-zero      # Build from A0 base + CarabinerOS layer
├── nginx.dev.conf             # Reverse proxy config
├── run_ui.py                  # Flask+Starlette+Uvicorn+Socket.IO entry
├── requirements.txt           # Python dependencies
└── usr/                       # A0 runtime config
    ├── settings.json          # LLM providers, MCP servers
    ├── plugins/               # Plugin activation
    ├── agents/                # Agent configurations
    └── knowledge/             # RAG knowledge base
```

## Component Architecture

### Request Flow

```
User ──> Browser ──> nginx:8080 ──┬──> Next.js:3000 (static + SSR)
                                  └──> Flask:5000 (API + Socket.IO)
                                                    │
                                    ┌───────────────┼──────────────┐
                                    ▼               ▼              ▼
                              Agent Zero      Carabiner       PostgreSQL
                              (LLM chain)     (REST/CLI)     (SQLAlchemy)
```

### Layer 1: Agent Zero (Framework)

**Entry point:** `run_ui.py`

Flask app wrapped in Starlette, served by Uvicorn (ASGI), with Socket.IO AsyncServer for real-time events. Agent Zero provides:

- **Agentic runtime** — multi-agent delegation, task planning, tool execution
- **LLM orchestration** — LiteLLM integration for model routing
- **Tool system** — code_execution, memory, web search, MCP server bridge
- **Memory** — vector store, conversation history, knowledge retrieval
- **Chat interface** — WebSocket streaming via Socket.IO

**Key files:**
- `agent.py` — main agent loop
- `models.py` — agent and message data models
- `initialize.py` — startup configuration
- `python/api/` — 75+ API handlers (chat, memory, settings, MCP, scheduler)

### Layer 2: Carabiner (Domain)

**Registration:** `carabiner/plugins/carabiner/` (A0 plugin auto-loaded at startup)

CarabinerOS extends Agent Zero through:

1. **Database initialization** — creates tables, runs seed data on first boot
2. **API stub generation** — registers REST routes via Flask blueprint
3. **Agent profiles** — injects kitchen-inspired agent prompts into A0
4. **CLI integration** — agents and humans both use `carabiner` CLI

#### Database Layer

**Stack:** PostgreSQL 16 → SQLAlchemy 2.0 async → asyncpg

**Models (22 core + workspace-scoped):**
- `Location` — restaurant locations
- `Order` — vendor orders with line items
- `InventoryItem`, `InventoryTransaction` — stock tracking
- `MenuItem`, `MenuCategory` — menu definitions
- `Recipe`, `RecipeIngredient` — recipes with cost breakdown
- `Invoice` — vendor invoices
- `Campaign` — marketing campaigns
- `DailyPL` — daily profit & loss records
- `FoodCost` — theoretical vs actual food cost
- `PrepItem` — prep station readiness
- `Vendor` — supplier information
- `ChatContext` — conversation linkage

**Migrations:** Alembic in `carabiner/db/migrations/`

#### API Layer (REST)

**Registration:** Flask blueprint at `/api`

- All endpoints are GET-only, returning JSON
- Optional `?location_id=UUID` filtering on all list endpoints
- Response format: `{"ok": True, "data": ...}` or `{"ok": False, "error": "..."}`
- Blueprint: `carabiner/api/flask_blueprint.py`

#### Real-Time Layer

**Protocol:** Socket.IO (AsyncServer)

**Events Carabiner listens to:**
- `action_card` — card creation/updates from backend
- `card_reply` — user replies to cards
- `card_commit` — card commitment events
- `card_dismiss` — card dismissal
- `card_message` — side chat messages for cards

**Events Carabiner emits:**
- Card state changes (priority, deadline, status)

#### CLI Layer

**Stack:** Typer + Rich → JSON output

**8 resources, 20+ commands:**

| Resource | Read | Write |
|----------|------|-------|
| orders | list, get | create, update |
| inventory | list, get | — |
| prep | list, get | update |
| menu | list, get | — |
| recipes | list, get | — |
| invoices | list, get | — |
| food-cost | list, daily | — |
| vendors | list, get | — |

**Usage:** Both agents (via A0's `code_execution_tool`) and humans.

### Frontend Architecture

**Stack:** Next.js 16 App Router → React 19 → Tailwind CSS 4

**API Proxy:** `next.config.ts` rewrites `/message`, `/chats`, `/chat_load`, and other paths to the Flask backend. Next.js dev server reads `A0_URL` env var (default `http://localhost:5000`).

**Real-time:** Socket.IO client connects directly to Flask:5000 for action cards, chat streaming, and expo events.

**Key hooks:**
- `use-action-cards.ts` — card state management + Socket.IO binding
- `use-chat.ts` — chat streaming and message persistence
- `use-socket.ts` — raw Socket.IO connection management
- `use-expo-stream.ts` — LLM reasoning stream display

## Agent System

Multi-agent architecture with kitchen-inspired roles. The GM acts as router, delegating to specialists.

| Agent | Role | Domain | Tools |
|-------|------|--------|-------|
| **GM** | Router | All requests | Delegates to specialists |
| **AGM** | Purchasing | Orders, inventory, vendors | `carabiner orders`, `carabiner inventory`, `carabiner vendors` |
| **Executive Chef** | Cost Control | Food cost, recipes, P&L | `carabiner food-cost`, `carabiner recipes` |
| **Sous Chef** | Kitchen Ops | Prep, station readiness | `carabiner prep` |
| **Marketing** | Growth | Campaigns, competitive research | `carabiner marketing` |

**Agent communication:** Agents use A0's `code_execution_tool` to invoke CLI commands or make HTTP requests to the REST API.

## Action Cards System

Real-time notification system that surfaces work items to operators.

**Backend:** Socket.IO events (`action_card`, `card_reply`, `card_commit`, `card_dismiss`, `card_message`)

**Frontend:** 
- `action-card.tsx` — collapsed view
- `action-card-expanded.tsx` — expanded view with details
- `notification-panel.tsx` — card container

**Card types:** urgent, action, update, info — with priority, deadline, status tracking

**Workflow:** Backend detects condition → emits card → frontend displays → operator acts → card commits/dismisses

## Infrastructure

### Docker Compose

**Services (docker-compose.dev.yml):**
- `agent-zero` — Backend (Python/Flask/Uvicorn on port 5000, exposed via nginx)
- `frontend` — Next.js dev server (port 3000)
- `db` — PostgreSQL 16
- `nginx` — Reverse proxy (port 8080)

**Network:** Docker bridge network. Frontend proxies API requests to backend, nginx proxies both to port 8080.

## Development Workflow

1. **Feature branch** — never commit to main directly
2. **TDD cycle** — write tests, implement, verify
3. **Documentation** — update CLAUDE.md, ARCHITECTURE.md, CHANGELOG.md alongside code
4. **Review** — code review via `/review`, QA via `/qa`
5. **Ship** — sync main, open PR, merge, deploy

## Design Decisions

### Why Two-Layer Architecture

**Agent Zero as framework, Carabiner as domain.** This separation means:
- We can upgrade Agent Zero independently without breaking domain code
- Domain code is isolated and testable
- Plugins and extensions can be hot-swapped
- Clear ownership boundaries when onboarding contributors

### Why CLI for Agents

Agents use `code_execution_tool` to run CLI commands rather than calling REST directly because:
- CLI commands are self-documenting (Typer generates help text)
- Commands provide structured JSON output that agents can parse
- No CORS, auth, or network complexity for agent-to-database communication
- Humans and agents use the same interface

### Why Socket.IO Over REST for Real-Time

Action cards and chat streaming need server-initiated communication. HTTP polling is wasteful. WebSocket is low-level. Socket.IO gives us auto-reconnect, room-based broadcasting, and fallback transport.
