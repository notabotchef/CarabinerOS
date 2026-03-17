# CarabinerOS v2 — Migration & Architecture Plan

## Context

CarabinerOS is a restaurant operations platform powered by an AI agent (Agent Zero). The current implementation (`AgentCarabinerOS/`) is a monolith where the agent framework, restaurant domain logic, and a vanilla JS frontend are all intertwined. This makes it hard to update Agent Zero from upstream, hard to scale the frontend, and impossible to persist real restaurant data. The goal is to rebuild as a clean three-layer architecture: **Next.js frontend** | **CarabinerOS API (FastAPI)** | **Agent Zero engine (git submodule)**.

---

## Repository Structure

```
carabiner-os/
├── turbo.json
├── pnpm-workspace.yaml
├── apps/
│   └── web/                          # Next.js 15 (App Router) + shadcn/ui
│       ├── src/app/                  # File-based routes
│       ├── src/components/           # React + shadcn
│       ├── src/hooks/                # Custom hooks
│       ├── src/stores/               # Zustand stores
│       ├── src/lib/                  # API client, utils
│       └── src/types/
├── packages/
│   └── api-types/                    # Shared TS types (restaurant, agent, websocket)
├── engine/
│   ├── agent-zero/                   # Git submodule (upstream, NEVER modified)
│   ├── carabiner/                    # Restaurant domain layer
│   │   ├── api/                      # FastAPI routers (orders, inventory, prep, etc.)
│   │   ├── domain/                   # Pydantic models + business logic + connectors
│   │   ├── db/                       # SQLAlchemy models + Alembic migrations
│   │   └── agent_overlay/            # Agent Zero integration (non-invasive)
│   │       ├── tools/                # Restaurant tools (discovered via search path)
│   │       ├── prompts/              # Prompt overrides
│   │       ├── extensions/           # Extension hooks
│   │       └── profiles/             # Agent profiles
│   ├── bridge.py                     # FastAPI <-> Agent Zero bridge
│   ├── main.py                       # FastAPI + Agent Zero boot
│   └── pyproject.toml
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.web
│   └── Dockerfile.engine
└── docs/
```

**Key decisions:**
- **Turborepo monorepo** — shared types, atomic commits, single CI
- **Git submodule for Agent Zero** — all customization through overlay pattern (tools, prompts, extensions registered via Agent Zero's `subagents.get_paths()` search hierarchy). Upstream updates = `git submodule update --remote` + test
- **FastAPI wraps Agent Zero** — not Flask. Native async, auto OpenAPI docs, Pydantic validation. Both coexist at ASGI level

---

## Frontend Architecture (Next.js + shadcn/ui)

### Stack
| Concern | Choice |
|---------|--------|
| Framework | Next.js 15 (App Router) |
| UI | shadcn/ui + Radix |
| Styling | Tailwind CSS 4 |
| UI State | Zustand |
| Server State | TanStack Query (React Query) |
| Real-time | socket.io-client |
| Tables | TanStack Table |
| Forms | React Hook Form + Zod |
| Markdown | react-markdown |

### Routes
```
src/app/
├── layout.tsx                        # Root: sidebar + main area
├── (workspace)/
│   ├── layout.tsx                    # Workspace: header + content + right rail
│   ├── home/page.tsx                 # Welcome: metrics + suggested prompts
│   ├── inbox/page.tsx                # Table: operational exceptions
│   ├── orders/page.tsx               # Table: vendor orders
│   ├── inventory/page.tsx            # Table: par/variance tracking
│   ├── prep/page.tsx                 # Board: prep tasks by lane (Kanban)
│   ├── food-cost/page.tsx            # Table: margin pressure analysis
│   ├── menu/page.tsx                 # Table: menu engineering (star/puzzle/plowhorse/dog)
│   ├── marketing/page.tsx            # Table: campaign management
│   ├── locations/page.tsx            # Table: multi-location overview
│   └── admin/page.tsx                # Settings & configuration
├── (chat)/c/[chatId]/page.tsx        # Full conversation view
└── api/                              # BFF proxy routes (optional)
```

### Component Migration Map
| Current (vanilla JS / Alpine.js) | New (React + shadcn) |
|----------------------------------|---------------------|
| `navigation.html` + `goToModule()` | `app-sidebar.tsx` (shadcn Sidebar) |
| `workspace-screen.html` table layout | `workspace-table.tsx` (TanStack Table + shadcn DataTable) |
| `workspace-screen.html` board layout | `workspace-board.tsx` (Kanban columns) |
| `workspace-screen.html` detail aside | `workspace-detail-panel.tsx` (shadcn Sheet) |
| `right-rail.html` | `right-rail.tsx` (Card components) |
| `conversation-screen.html` | `chat-message-list.tsx` + `chat-composer.tsx` |
| `welcome-screen.html` | `home/page.tsx` (metrics cards + prompt chips) |
| `carabiner-store.js` (900+ lines) | Split: Zustand (UI) + React Query (server data) |
| `workspaceSeedData` (hardcoded JS) | Fetched from REST API (`/api/orders`, `/api/inventory`, etc.) |

### State Split
- **Zustand** = pure UI: `activeModule`, `activeLocationId`, `selectedItemId`, `isChatOpen`
- **React Query** = server data: `useOrders(locationId)`, `useInventory(locationId)`, etc.
- **Socket.IO events** trigger React Query cache invalidation for real-time updates

---

## Backend Architecture

### Layer 1: Agent Zero (submodule, untouched)
- `agent.py`: AgentContext, Agent execution loop
- `models.py`: LiteLLM (unified LLM access)
- Extension system (50+ hook points)
- Plugin system (memory, code execution, text editor)
- Tool discovery via `subagents.get_paths()`

### Layer 2: CarabinerOS (overlay)
- FastAPI application wrapping Agent Zero
- PostgreSQL database for restaurant entities
- Typed API endpoints with Pydantic
- Restaurant-specific tools, prompts, extensions

### Bridge (`engine/bridge.py`)
1. Registers `carabiner/agent_overlay/` directories into Agent Zero's search paths
2. Boots AgentContext/AgentConfig from CarabinerOS settings
3. Exposes async methods for FastAPI to call `AgentContext.communicate()`
4. Forwards WebSocket events (log, stream, status) to Next.js frontend

### API Endpoints
```
GET  /api/health
GET  /api/hq                          # Full HQ payload (org, locations, metrics)
GET  /api/locations
GET  /api/locations/:id/metrics
GET  /api/inbox                       # Filterable by location
CRUD /api/orders
POST /api/orders/:id/send             # Execute via connector
GET  /api/inventory
POST /api/inventory/import
GET  /api/prep
POST /api/prep/generate               # Triggers agent
GET  /api/food-cost
POST /api/food-cost/analyze           # Triggers agent
GET  /api/menu
POST /api/menu/engineer               # Triggers agent
GET  /api/marketing
GET  /api/connectors
CRUD /api/chat/contexts
POST /api/chat/contexts/:id/message   # Send to agent
GET  /api/agent/settings
```

---

## Data Layer

### Database: PostgreSQL + SQLAlchemy 2.0 + Alembic

### Schema (key tables)
```sql
organizations    (id, name, slug)
locations        (id, org_id, slug, name, city, status, sales_delta, labor_delta)
connectors       (id, org_id, provider_id, provider_name, channels[], default_channel, config JSONB)
orders           (id, location_id, connector_id, vendor, channel, status, total, eta, line_items JSONB, summary, detail_points[], prompt)
inventory_items  (id, location_id, item_name, on_hand_qty, par_qty, variance, summary, detail_points[], prompt)
prep_tasks       (id, location_id, service_lane, task, station, readiness, shortage, summary, detail_points[], prompt)
food_cost_items  (id, location_id, menu_item_name, pressure, current_cost_pct, action, summary, detail_points[], prompt)
menu_items       (id, location_id, item_name, category, performance, margin_pct, recommendation, recipe JSONB, summary, detail_points[], prompt)
campaigns        (id, location_id, campaign_name, channel, stage, deliverable, summary, detail_points[], prompt)
inbox_items      (id, location_id, title, priority, owner, status, module, summary, detail_points[], prompt)
action_log       (id, org_id, location_id, provider_id, action_type, status, agent_context_id, metadata JSONB)
```

Current seed data from `carabiner-store.js` (3 locations, 3 items per module) becomes an Alembic seed migration. The `organizations` table enables future multi-tenant support.

---

## Agent Integration

### Tools (split from single `restaurant_ops.py`)
```
carabiner/agent_overlay/tools/
├── order_tool.py         # list, draft, review, send orders
├── inventory_tool.py     # check levels, import counts, flag variances
├── prep_tool.py          # generate prep plans, check readiness
├── food_cost_tool.py     # analyze margins, suggest actions
├── menu_tool.py          # engineering analysis, pricing recommendations
├── marketing_tool.py     # campaign research, brief generation
├── connector_tool.py     # test/execute provider connections
└── inbox_tool.py         # triage, resolve, escalate exceptions
```

Each inherits Agent Zero's `Tool` base class. Discovered automatically via overlay directory registration.

### Extension Hooks
1. **`system_prompt` (priority `_25`)** — injects restaurant context (active location, today's priorities, connector status)
2. **`tool_execute_after` (priority `_25`)** — syncs tool results to PostgreSQL + emits `workspace_update` WebSocket event
3. **`response_stream` (priority `_25`)** — cleans internal agent references (replaces "A0", "subordinate" with restaurant-appropriate language)

### Prompt Management
- CarabinerOS agent profile overrides `agent.system.main.role.md`
- Per-tool prompt files document arguments for the LLM
- Dynamic context injection via system_prompt extension

---

## WebSocket Events
```
Client -> Server:
  chat_message        { context_id, message, attachments? }
  subscribe_context   { context_id }

Server -> Client:
  response_stream     { context_id, chunk, full }
  status_update       { context_id, status }
  workspace_update    { module, action, item }
  inbox_alert         { item }
```

---

## Migration Phases

### Phase 0: Foundation (Week 1-2) -- COMPLETED 2026-03-17
- [x] Create monorepo structure (Turborepo + pnpm)
- [x] Add `agent-zero-official` as git submodule at `engine/agent-zero/`
- [x] Write `engine/main.py` (FastAPI boots Agent Zero from submodule)
- [x] Create overlay directory structure
- [x] Verify one test tool + one test extension are discovered
- [x] Docker Compose with PostgreSQL
- **Exit criteria:** Agent Zero runs from submodule and discovers overlay tools

### Phase 1: API + Database (Week 3-5)
- [ ] Pydantic models + SQLAlchemy models + Alembic migrations
- [ ] Seed data migration (from `carabiner-store.js` hardcoded data)
- [ ] Repository layer for all entities
- [ ] FastAPI routers for all CRUD endpoints
- [ ] `AgentBridge` connecting FastAPI to Agent Zero
- [ ] Socket.IO on FastAPI
- [ ] Port `carabiner_connectors.py` to `carabiner/domain/connectors.py`
- [ ] TypeScript types in `packages/api-types`
- **Exit criteria:** REST API serves restaurant data from PostgreSQL

### Phase 2: Next.js Shell (Week 6-8)
- [x] Next.js 15 + shadcn/ui + Tailwind
- [x] Sidebar navigation (modules + conversations)
- [ ] Location switcher
- [ ] Zustand stores + React Query setup
- [x] Home page (metrics + suggested prompts)
- [ ] Socket.IO client connection
- [ ] Port design language from `carabiner.css` to Tailwind theme
- **Exit criteria:** Navigable app shell with sidebar, home page, real-time connection

### Phase 3: Workspace Modules (Week 9-12)
- [ ] For each module: page + data fetching + TanStack Table/Board + KPI cards + detail panel
- [ ] "Ask CarabinerOS" wiring (workspace item -> chat)
- [ ] Admin page
- [ ] Right rail (metrics, action log, inbox)
- **Exit criteria:** All 10 workspace modules functional with real API data

### Phase 4: Chat Interface (Week 13-15)
- [ ] Composer with file upload
- [ ] Message list with markdown rendering + auto-scroll
- [ ] Response streaming via Socket.IO
- [ ] Status pill (agent state)
- [ ] Port rendering helpers (`deriveConversationStatus`, `mapInternalAgentToRestaurantRole`, `cleanOperationalCopy`)
- [ ] Conversation history + docked chat panel alongside workspace
- **Exit criteria:** Full streaming chat experience integrated with workspace

### Phase 5: Agent Tools + Prompts (Week 16-18)
- [ ] Split `restaurant_ops.py` into focused tools with DB access
- [ ] Tool prompt files
- [ ] Restaurant context extension (system_prompt)
- [ ] Workspace sync extension (tool_execute_after)
- [ ] Response cleaning extension (response_stream)
- [ ] CarabinerOS agent profile
- [ ] E2E test: prompt -> agent -> tool -> DB -> frontend update
- **Exit criteria:** Agent performs all restaurant operations with persistent, real-time results

### Phase 6: Production Polish (Week 19-22)
- [ ] Authentication (NextAuth.js)
- [ ] Error handling + loading states
- [ ] Mobile responsiveness
- [ ] Docker production builds
- [ ] CI/CD pipeline
- [ ] Monitoring + structured logging

---

## Docker Deployment

```yaml
services:
  web:
    build: { dockerfile: docker/Dockerfile.web }
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_ENGINE_URL: http://engine:8000
    depends_on: [engine]

  engine:
    build: { dockerfile: docker/Dockerfile.engine }
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://carabiner:carabiner@db:5432/carabiner
    volumes: [engine_data:/app/usr]
    depends_on: [db]

  db:
    image: postgres:16-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]
```

Production: Frontend on Vercel (or Cloud Run), Engine on Railway/Cloud Run, Database on Supabase (or Cloud SQL).

---

## Key Architecture Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Agent Zero integration | Git submodule (not fork) | Forces overlay-only customization, easy upstream updates |
| API framework | FastAPI (not Flask) | Native async, auto OpenAPI, Pydantic validation |
| Database | PostgreSQL (not SQLite/none) | Real CRUD, JSONB, future pgvector for embeddings |
| Frontend state | Zustand + React Query (not Redux) | Clean separation: server cache vs UI state |
| Customization pattern | Overlay via extension points | Zero modifications to Agent Zero source |

---

## Key Files Referenced

- `AgentCarabinerOS/agent.py` — Agent core, tool discovery, extension system
- `AgentCarabinerOS/run_ui.py` — Current server (Flask + Socket.IO + ASGI + Uvicorn)
- `AgentCarabinerOS/python/helpers/carabiner_data.py` — HQ builder (locations, modules, metrics)
- `AgentCarabinerOS/python/helpers/carabiner_connectors.py` — Provider connectors (3 providers, multi-channel)
- `AgentCarabinerOS/python/tools/restaurant_ops.py` — Current monolithic restaurant tool
- `AgentCarabinerOS/python/helpers/extension.py` — Extension discovery/execution
- `AgentCarabinerOS/webui/components/carabiner/carabiner-store.js` — 900+ lines: all workspace data, UI state, rendering
- `AgentCarabinerOS/webui/components/carabiner/workspace-screen.html` — Table + board views
- `AgentCarabinerOS/webui/components/carabiner/navigation.html` — Sidebar
- `agent-zero-official/agent.py` — Upstream agent loop
- `agent-zero-official/helpers/tool.py` — Tool base class
- `agent-zero-official/helpers/extension.py` — Extension system

---

## Verification

After each phase:
1. `docker compose up` — all services boot without errors
2. Phase 0: Agent Zero tool discovery test passes
3. Phase 1: `curl /api/orders` returns seeded data from PostgreSQL
4. Phase 2: Next.js app loads, sidebar navigates between modules
5. Phase 3: All workspace pages render with API data, detail panels open
6. Phase 4: Send a chat message, receive streaming response
7. Phase 5: Chat triggers tool -> DB write -> workspace auto-updates
8. Phase 6: Auth works, Docker builds are production-ready, CI passes
