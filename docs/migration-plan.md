# CarabinerOS v2 — Migration & Architecture Plan

## Context

CarabinerOS is a restaurant operations platform powered by an AI agent (Agent Zero). The current implementation (`AgentCarabinerOS/`) is a monolith where the agent framework, restaurant domain logic, and a vanilla JS frontend are all intertwined. This makes it hard to update Agent Zero from upstream, hard to scale the frontend, and impossible to persist real restaurant data. The goal is to rebuild as a clean three-layer architecture: **Next.js frontend** | **CarabinerOS API (FastAPI)** | **Agent Zero engine (git submodule)**.

### Competitive Positioning

CarabinerOS competes with MarginEdge ($330/mo), Restaurant365 (enterprise), and xtraCHEF (by Toast). All three are **form-based CRUD tools** — operators click through screens to enter invoices, check inventory, build orders.

**CarabinerOS is natural language first.** Every feature these competitors offer through forms, CarabinerOS delivers through conversation with an AI agent. The same data, the same operations, but the interface is "Build today's produce order" instead of navigating 15 screens.

Core feature parity targets (Phases 6-10):
- **Invoice processing & AP automation** — "Process these invoices" (MarginEdge, R365, xtraCHEF core)
- **Daily P&L & reporting** — "What's my food cost this week?" (all three)
- **POS integration & sales** — "How did River North do last night?" (MarginEdge, R365)
- **Recipe management & costing** — "Cost out the new menu" (all three)
- **Budgets & forecasting** — "Are we hitting our numbers?" (R365, xtraCHEF)

See `docs/competitive-analysis.md` for the full feature mapping.

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

### Phase 0: Foundation — COMPLETED 2026-03-17
- [x] Turborepo monorepo + pnpm workspaces
- [x] Agent Zero as git submodule at `engine/agent-zero/`
- [x] FastAPI engine with overlay symlinks into `usr/`
- [x] Test tool (ping_tool) + test extension (restaurant_context)
- [x] Docker Compose with PostgreSQL 16
- [x] Domain connectors ported to Pydantic
- **Exit criteria:** Agent Zero discovers overlay tools from submodule

### Phase 1: API + Database — COMPLETED 2026-03-17
- [x] 10 workspace SQLAlchemy models + Alembic migration 002
- [x] Seed data (21 records across 3 locations, 7 modules)
- [x] Async repository layer (generic CRUD)
- [x] FastAPI CRUD routers for all workspace modules
- [x] `/api/hq` aggregated endpoint
- [x] Database init/close wired into FastAPI lifespan
- **Exit criteria:** `curl /api/orders` returns seeded data from PostgreSQL

### Phase 2: Next.js Shell — COMPLETED 2026-03-17
- [x] Next.js 15 + shadcn/ui + Tailwind
- [x] Sidebar navigation with location switcher (Zustand)
- [x] Carabiner warm palette ported to Tailwind CSS tokens
- [x] React Query hooks for all workspace modules
- [x] Socket.IO client with cache invalidation
- [x] Home page fetching from live API with fallbacks
- **Exit criteria:** Navigable app shell with sidebar, home page, real-time connection

### Phase 3: Workspace Modules (Week 9-12) — COMPLETED 2026-03-17
- [x] For each module: page + data fetching + TanStack Table/Board + KPI cards + detail panel
- [x] "Ask CarabinerOS" wiring (workspace item -> docked chat panel with pre-filled prompt)
- [x] Admin page (placeholder) + Locations page (read-only table)
- [x] ChatDock (docked right sidebar, replaces right rail — cross-module metrics stay on Home dashboard)
- **Exit criteria:** All 10 workspace modules functional with real API data

### Phase 3b: Workspace Interactivity (after Phase 5)
> *Current modules are read-only data displays. This phase makes them feel like real operational tools.*
- [ ] **Orders**: Send/approve buttons, status transitions (Drafting → Ready → Sent), inline line-item editing
- [ ] **Inbox**: Resolve/dismiss/escalate actions, priority reassignment, bulk actions
- [ ] **Inventory**: Inline count editing, variance highlighting with thresholds, import counts from CSV/scan
- [ ] **Prep**: Drag-and-drop card reordering, mark tasks complete, readiness toggle
- [ ] **Food Cost**: Action execution buttons (reprice, source swap, retrain), link to menu item
- [ ] **Menu**: Performance badge editing, price adjustment inline, recipe link
- [ ] **Marketing**: Stage transitions (Research → Drafting → Review → Live), deliverable upload
- [ ] **Locations**: Status editing, add/remove locations
- [ ] **Cross-module**: Table sorting, column filtering, search, date range pickers
- [ ] **Error states**: Toast notifications with retry, optimistic updates on mutations
- **Exit criteria:** All modules support CRUD actions, status transitions, and filtering — not just read-only display

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
- [ ] Tool prompt files for each tool
- [ ] Restaurant context extension (system_prompt) — inject active location, priorities, connector status
- [ ] Workspace sync extension (tool_execute_after) — write results to DB, emit WebSocket events
- [ ] Response cleaning extension (response_stream) — replace internal agent language
- [ ] CarabinerOS agent profile
- [ ] E2E test: prompt -> agent -> tool -> DB -> frontend update
- **Exit criteria:** Agent performs all restaurant operations with persistent, real-time results

### Phase 6: Invoice Processing & AP Automation (Week 19-22)
> *Competitive parity: MarginEdge, R365, xtraCHEF all have this as core*
- [ ] Invoice upload endpoint (PDF/image)
- [ ] OCR/extraction pipeline (agent-driven: "Process this invoice")
- [ ] Invoice line item matching to items/vendors
- [ ] PO matching and variance flagging
- [ ] GL account auto-categorization
- [ ] Invoice approval workflow (agent can draft, human approves)
- [ ] Agent tool: `invoice_tool.py` — process, match, approve, dispute
- [ ] Frontend: Invoice list page + detail panel + upload dropzone
- **Exit criteria:** "Process these invoices" → agent extracts, matches, categorizes, flags variances

### Phase 7: Reporting & Daily P&L (Week 23-25)
> *Competitive parity: all three competitors offer real-time P&L*
- [ ] Daily P&L calculation engine (beginning inventory + purchases - ending inventory = COGS)
- [ ] Theoretical vs. actual food cost comparison
- [ ] Cost trend dashboards (recharts)
- [ ] Budget vs. actual variance reporting
- [ ] Agent tool: `reporting_tool.py` — "What's my food cost this week?" / "Show me the P&L for West Loop"
- [ ] Frontend: Reporting page with date range picker, location filter, exportable tables
- **Exit criteria:** "What's driving food cost up?" → agent queries P&L data, identifies top variances

### Phase 8: POS Integration & Sales Data (Week 26-28)
> *Competitive parity: MarginEdge + R365 pull POS data automatically*
- [ ] POS adapter interface (abstract connector for Square, Toast, Clover, etc.)
- [ ] Sales import pipeline (daily totals, product mix, guest counts)
- [ ] Product mix analysis tied to menu engineering
- [ ] Sales forecasting (trend-based, used by prep + ordering tools)
- [ ] Agent tool: `sales_tool.py` — "How did River North do last night?" / "Forecast covers for Friday"
- [ ] Frontend: Sales dashboard, product mix table, forecast visualization
- **Exit criteria:** POS data flows in automatically, agent can forecast and answer sales questions

### Phase 9: Recipe Management & Costing (Week 29-31)
> *Competitive parity: all three competitors have recipe costing*
- [ ] Recipe builder with sub-recipes and yield tracking
- [ ] Real-time ingredient costing (pulled from latest invoice prices)
- [ ] Plate cost calculation + menu price recommendations
- [ ] Recipe scaling for prep quantities
- [ ] Agent tool: `recipe_tool.py` — "What does the short rib pappardelle cost to make?" / "Scale the brunch prep for 200 covers"
- [ ] Frontend: Recipe editor page, cost breakdown panel, scaling calculator
- **Exit criteria:** "Cost out the new menu" → agent calculates plate costs using real ingredient prices

### Phase 10: Budgets, Forecasting & Advanced Analytics (Week 32-34)
> *Competitive parity: R365 + xtraCHEF*
- [ ] Budget creation by period/location (revenue, food cost %, labor %)
- [ ] Forecast engine using historical sales + seasonality
- [ ] Variance alerts (budget vs. actual) feeding into inbox
- [ ] Agent tool: `budget_tool.py` — "Am I on track for March food cost target?" / "Build next quarter's budget"
- [ ] Frontend: Budget planning page, variance heatmap, forecast charts
- **Exit criteria:** "Are we hitting our numbers?" → agent compares actuals to budget, surfaces risks

### Phase 11: Production Polish (Week 35-38)
- [ ] Authentication (NextAuth.js)
- [ ] Role-based access (owner, manager, chef, viewer)
- [ ] Error handling + loading states across all pages
- [ ] Mobile responsiveness
- [ ] Docker production builds
- [ ] CI/CD pipeline
- [ ] Monitoring + structured logging
- [ ] Onboarding flow for new organizations

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
