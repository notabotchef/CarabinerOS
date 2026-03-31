# CarabinerOS v3 — The Expo Station Architecture

**Date:** 2026-03-18
**Status:** Approved
**Author:** Esteban + Claude

## Overview

CarabinerOS is an AI-powered restaurant operations platform. v3 is a ground-up rebuild on top of Agent Zero (MIT-licensed AI agent framework) with a React/Next.js frontend. The architecture follows the restaurant metaphor: Agent Zero is Back of House (the kitchen), Next.js is Front of House (the dining room), and the UI is the Expo Station — it sees everything and decides what to plate.

## Goals

- **Simplicity**: Restaurant workers aren't tech-savvy. The UI must feel like talking to a colleague, not using software. Two states: home and chat. No training manual.
- **Expo visibility**: During development, the UI shows all agent internals (delegations, tool calls, progress). In production, filter for end users.
- **No wrapper**: The frontend connects directly to Agent Zero's native Socket.IO protocol. No bridge, no middleware reimplementing events.
- **Upstream compatibility**: Never modify Agent Zero core files. All customization via `usr/` overlay, `carabiner/` domain layer, and `frontend/`.
- **Two deployment tiers**: Local installation (one-time purchase) and cloud SaaS (subscription).

## Architecture

### The Restaurant Metaphor

| Role | System | Responsibility |
|------|--------|----------------|
| **Server** | User | Drops the ticket (sends a message) |
| **Expo** | Next.js UI | Sees everything, decides what to plate |
| **Back of House** | Agent Zero | Runs agents, tools, LLM — does the work |
| **Front of House** | Next.js UI | Beautiful experience, customer-facing |
| **Ticket Rail** | Socket.IO | Real-time communication between FOH and BOH |

### Repo Model: Fork

CarabinerOS is a fork of Agent Zero (`https://github.com/agent0ai/agent-zero.git`). Agent Zero is MIT-licensed — free to modify, sell, sublicense. Upstream updates pulled via `git remote add upstream`.

**Rule: never modify Agent Zero core files.** This keeps upstream merges clean.

### Repo Structure

```
carabiner-os/                     ← Agent Zero fork
│
│── agent.py                      ← A0 core (don't touch)
│── python/                       ← A0 backend (don't touch)
│── webui/                        ← A0 native UI (keep for reference/debug)
│── run_ui.py                     ← A0 server entry (don't touch)
│── initialize.py                 ← A0 bootstrap (don't touch)
│
│── usr/                          ← CarabinerOS overlay
│   ├── tools/                    ←   10 restaurant tools
│   ├── agents/                   ←   5 role-based agent profiles
│   ├── extensions/               ←   3 execution hooks
│   └── .env                      ←   LLM config (ollama_chat provider)
│
│── carabiner/                    ← CarabinerOS domain layer
│   ├── api/                      ←   REST endpoints (workspace, chats, reporting)
│   ├── db/                       ←   Models, migrations, repositories
│   └── domain/                   ←   Action cards, status protocol, response cleaning
│
│── frontend/                     ← Next.js app (FOH)
│   ├── src/
│   │   ├── app/                  ←   Next.js app router
│   │   ├── components/           ←   React components
│   │   ├── hooks/                ←   useSocket, useChat, useExpoStream, useActionCards
│   │   └── lib/                  ←   Socket.IO client, utilities
│   ├── package.json
│   └── next.config.ts
│
│── tests/                        ← Test suite
│── docs/                         ← Specs, plans, handoff
│── docker/                       ← Docker configs
└── alembic.ini                   ← DB migration config
```

### Migration Strategy

1. Clone fresh Agent Zero from `https://github.com/agent0ai/agent-zero.git` into carabiner-os (preserving existing git history)
2. Copy `usr/` overlay from FreshcOS (tools, agents, extensions, .env) — one commit
3. Copy `carabiner/` domain layer from FreshcOS (api, db, domain) — one commit
4. Copy `tests/` and `docs/` from FreshcOS — one commit
5. Scaffold `frontend/` (Next.js + shadcn) — one commit
6. Docker compose for dev (Postgres) — one commit

Each step is a discrete, reviewable commit. No big bang migration.

**Migration notes:**
- `carabiner/domain/` includes `connectors.py` and `reporting.py` from FreshcOS — carry these forward
- FreshcOS has two migrations with `003_` prefix — verify Alembic revision chain or renumber during migration
- Next.js proxy config must cover: `/socket.io`, `/message_async`, `/message`, `/chats`, `/chat_load`, `/chat_create` (all Agent Zero REST routes)

## Frontend Design

### Two UI States

**State 1 — Home ("The Welcome")**
- Welcome text: "Good morning, Chef"
- Ambient KPI summary in subtitle: "3 orders pending · food cost at 28.4% · 142 covers projected"
- Chat composer centered
- Solitaire-style KPI cards fanned at the bottom (glanceable, not interactive)
- User sends a prompt → home clears, transitions to chat state

**State 2 — Chat ("The Expo is Working")**
- Clean message list: user messages and CarabinerOS responses. No logs, no noise.
- Expo bar sits directly above the composer — subtle, animated, elegant
- Expo streams live status text of what's happening in BOH
- Notification panel (hidden by default) slides from right when bell icon clicked
- Action cards accumulate in notification panel with badge count

### Expo Bar

The expo bar is a single-line status indicator directly above the chat composer. It streams what Agent Zero is doing in human-friendly language.

**Behavior:**
- Appears when Agent Zero is processing
- Disappears when response is complete
- Three-dot animation (amber) while active
- Green dot on completion
- Maps Agent Zero events to friendly text
- Occasionally quirky messages (1 in 5) for personality — context-aware humor, not forced

**Example messages:**
- "Querying vendor prices..." (tool call)
- "Asking the sous chef about tomorrow's prep..." (agent delegation)
- "Crunching the numbers on that produce order..." (food cost tool)
- "Checking if René Redzepi already paid the interns..." (quirky)
- "Heard." (completion — fine dining, not Denny's)

### Notification Panel (Action Cards)

- Hidden by default, triggered by bell icon in top bar
- Badge count shows unread cards
- Slides from right side
- Contains action cards generated by tool mutations
- Each card has: type label, timestamp, summary, action buttons
- Buttons trigger follow-up messages to Agent Zero or direct API calls

### Component Tree

```
<SocketProvider>                    — connects to Agent Zero Socket.IO
  <AppShell>
    <TopBar />                      — logo, location name, bell icon (notification count)
    <HomeView />                    — welcome + composer + solitaire cards
    <ChatView />                    — replaces home after first prompt
      <MessageList />               — clean Q&A messages
      <ExpoBar />                   — subtle status above composer
      <ChatComposer />              — text input (+ voice future)
    <NotificationPanel />           — slides from right, action cards
  </AppShell>
</SocketProvider>
```

### React Hooks

| Hook | Purpose |
|------|---------|
| `useSocket()` | Connect to Agent Zero Socket.IO, manage lifecycle, handle auth/CSRF |
| `useChat(contextId)` | Send messages via `POST /message_async`, receive streamed responses, manage message list |
| `useExpoStream()` | Subscribe to `state_update` events, map to human-friendly expo bar text |
| `useActionCards()` | Catch tool results with `additional` payloads, manage notification panel state |
| `useWorkspace(module)` | CRUD for workspace modules via CarabinerOS REST API |

## Socket.IO Event Flow

### Frontend → Agent Zero

Messages sent via REST:
```
POST /message_async  →  { text: "check food cost", context: "ctx-123" }
```
Fire-and-forget. Agent Zero processes in a worker thread.

### Agent Zero → Frontend

Agent Zero emits `state_update` events through its Socket.IO namespace system. The frontend subscribes and maps events:

| Agent Zero Event | Meaning | Frontend Target |
|---|---|---|
| `state_update` with `log_progress` | Agent is working | Expo bar text |
| `state_update` with `logs[]` type `tool` | Tool executing | Expo bar: tool-specific message |
| `state_update` with `logs[]` type `agent` | Delegating to sub-agent | Expo bar: delegation message |
| `state_update` with response content | Final answer | Chat message in MessageList |
| Tool result with `additional` payload | Mutation (order created, etc.) | Action card in NotificationPanel |

### Key Principle

Zero changes to Agent Zero's backend. The frontend listens to what Agent Zero already emits and renders it beautifully. Same protocol that Agent Zero's native Alpine.js UI uses.

## Dev Environment

### Development (daily workflow)

Three processes:
1. **Postgres**: `docker compose -f docker-compose.dev.yml up`
2. **Agent Zero (BOH)**: `python run_ui.py` — Flask + Socket.IO on port 5000
3. **Next.js (FOH)**: `cd frontend && pnpm dev` — dev server on port 3000

Next.js `next.config.ts` proxies `/socket.io` and Agent Zero API routes to port 5000. Browser only talks to `localhost:3000`.

### Production (Docker Compose)

```yaml
services:
  postgres:       # Database
  agent-zero:     # BOH — Python, port 5000 (internal only)
  frontend:       # FOH — Next.js, port 3000 (internal only)
  nginx:          # Reverse proxy, port 80 (public)
                  #   / → frontend
                  #   /socket.io → agent-zero
                  #   /api/a0/* → agent-zero
```

Single `docker compose up` runs everything. Nginx routes traffic — users hit one URL.

### Deployment Tiers

- **Local installation** (one-time purchase): Same Docker Compose on restaurant hardware. No cloud dependency.
- **Cloud SaaS** (subscription): Kubernetes or Railway/Fly.io. Same containers. Multi-tenant auth at Next.js layer.

## Agent Overlay (usr/)

### Tools (usr/tools/)

10 restaurant operations tools, each returns `Response(message, break_loop, additional)` where `additional` contains `{module, action, item_id, item}` for action card generation:

- `order_tool` — vendor order management
- `inventory_tool` — stock level tracking
- `prep_tool` — prep task management
- `recipe_tool` — recipe CRUD and analysis
- `food_cost_tool` — cost analysis and alerts
- `invoice_tool` — vendor invoice processing
- `menu_tool` — menu item management
- `marketing_tool` — campaign management
- `reporting_tool` — KPIs, covers, P&L
- `ping_tool` — health check

### Agent Profiles (usr/agents/)

Role-based agents with specialized system prompts and tool access:

- **GM** — orchestrator, delegates to specialists
- **AGM** — purchasing, inventory, vendor relations
- **Executive Chef** — food cost, menu, reporting
- **Sous Chef** — prep management
- **Marketing Manager** — campaigns, social media

### Extensions (usr/extensions/)

- `system_prompt/_25_restaurant_context.py` — injects location/org context
- `tool_execute_after/_25_workspace_sync.py` — syncs tool results to workspace DB
- `response_stream_chunk/_25_response_cleaning.py` — strips Agent Zero internals from responses

## Domain Layer (carabiner/)

### Database (carabiner/db/)

- PostgreSQL via async SQLAlchemy
- Alembic migrations with seed data (6 versions)
- Models: Organization, WorkspaceLocation, InboxItem, WorkspaceOrder, WorkspaceInventory, WorkspacePrep, WorkspaceFoodCost, WorkspaceInvoices, WorkspaceRecipe, WorkspaceMenu
- All models include `summary`, `detail_points`, `prompt` fields for AI context
- Multi-location support via `location_id` FK

### API (carabiner/api/)

REST endpoints for workspace CRUD, mounted alongside Agent Zero's Flask routes:
- `/api/workspace/*` — CRUD for all workspace modules
- `/api/chats` — chat management
- `/api/reporting` — KPI endpoints
- `/api/hq` — organization/location data
- `/api/health` — service health

### Domain (carabiner/domain/)

- `action_card_protocol.py` — converts tool results to frontend card payloads
- `status_protocol.py` — structured status events with factory functions
- `response_cleaning.py` — strips Agent Zero internals from user-facing text
- `connectors.py` — external service connectors
- `reporting.py` — reporting logic and KPI calculations

## LLM Configuration

Development uses local Ollama with `ollama_chat` provider (critical: NOT `ollama` — the async handler hangs):

```
A0_SET_chat_model_provider=ollama_chat
A0_SET_chat_model_name=glm-4.7-flash:latest
A0_SET_chat_model_api_base=http://localhost:11434
```

Production will use cloud LLM APIs (OpenAI, Anthropic, etc.) via litellm's provider system.

## What's NOT in This Spec

- Voice input (future phase)
- Workspace module pages (orders table, recipe editor, etc.) — separate specs per module
- Multi-tenant auth for SaaS tier
- POS/reservation integrations (Toast, Resy)
- Vendor integrations (Sysco, Chef's Warehouse)
- Live team broadcast
- Email intelligence / vendor monitoring
