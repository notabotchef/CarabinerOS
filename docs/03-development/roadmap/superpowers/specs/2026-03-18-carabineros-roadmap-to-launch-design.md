# CarabinerOS v3 — Road to Launch: Full Product Spec

> **Vision:** A full AI restaurant manager delivered as a SaaS platform. Restaurants talk to CarabinerOS like they talk to their staff — voice-first, natural language, real-time. Replace a $65k/year ops manager with a monthly subscription.

> **Business model:** Two tiers — (1) one-time local installation with support + paid updates, (2) fully cloud-based SaaS subscription.

> **Competitive moat:** Domain expertise (built by a chef who codes), natural language operations (not forms), role-based AI agents, real-time team broadcast, vendor intelligence.

> **Target integrations:** Phase 1 — Google Suite, Square, 7shifts, Clover (self-service OAuth). Phase 2 — Toast POS (~120K US locations, partner certification required), OpenTable. Phase 3 — DoorDash, Uber Eats, Lightspeed. Vendor ordering (Sysco, Chef's Warehouse) via email ingestion — no public APIs exist.

---

## v3 Architecture

### The Restaurant Metaphor

| Role | System | Responsibility |
|------|--------|----------------|
| **Server** | User | Drops the ticket (sends a message) |
| **Expo** | Next.js UI | Sees everything, decides what to plate |
| **Back of House** | Agent Zero | Runs agents, tools, LLM — does the work |
| **Front of House** | Next.js UI | Beautiful experience, customer-facing |
| **Ticket Rail** | Socket.IO | Real-time communication between FOH and BOH |

### Repo Model

CarabinerOS is a **fork** of Agent Zero (MIT-licensed). Upstream updates via `git fetch upstream && git merge upstream/main`.

**Critical rule:** Never modify Agent Zero core files (`agent.py`, `python/`, `run_ui.py`, `initialize.py`, `webui/`). All customization lives in three zones:

- `usr/` — Agent overlay (tools, agent profiles, extensions, LLM config)
- `carabiner/` — Domain layer (API, database, protocols)
- `frontend/` — Next.js Expo Station UI

### Data Flow

```
User (voice/text)
  → Chat Composer
    → POST /message_async (REST)
      → Agent Zero main.py
        → GM agent
          → delegates to role agent
            → calls tool
              → PostgreSQL query/mutation
            → tool result (with `additional` payload)
          → formatted response
        → Socket.IO state_push events
      → useSocket hook receives snapshot
    → MessageList (response) + ExpoBar (status) + NotificationPanel (action cards)
```

### Two-State UI (The Expo Station)

**State 1 — Home ("The Welcome")**
- Welcome text: "Good morning, Chef"
- Ambient KPI summary in subtitle
- Chat composer centered
- Solitaire-style KPI cards fanned at the bottom
- User sends a prompt → transitions to chat state

**State 2 — Chat ("The Expo is Working")**
- Clean message list: user messages and CarabinerOS responses
- Expo bar sits above the composer — shows live BOH status
- Notification panel (hidden by default) slides from right when bell clicked
- Action cards accumulate in notification panel with badge count

### Tech Stack

- **BOH:** Agent Zero (Python/Flask/Socket.IO) on port 5000
- **FOH:** Next.js 16.2, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, Framer Motion on port 3000
- **Database:** PostgreSQL 16, async SQLAlchemy 2.0, Alembic migrations
- **Communication:** socket.io-client → Agent Zero `/state_sync` namespace (direct, no bridge)
- **LLM (dev):** Ollama with `ollama_chat` provider (`glm-4.7-flash`)
- **LLM (prod):** Cloud APIs (Claude, GPT, Codex/GPT-5.3) via litellm
- **Integrations:** MCP (Model Context Protocol) servers for database (40+ CRUD tools) and third-party platform integrations

---

## Current State (as of 2026-03-24)

### What's Built

**Engine (BOH) — feature-complete for demo**
- MCP database server with 40+ CRUD tools (replaced individual agent tools)
- Action card system: auto-emit extension on DB writes + proactive `action_card` tool
- Card chat wired to Agent Zero via `AgentContext.communicate()`
- Socket.IO action card events: `action_card`, `card_reply`, `card_commit`, `card_dismiss`, `card_message`
- MCP type coercion for asyncpg UUID/Decimal compatibility
- Auto-emit extension (`_30_action_card_emit.py`) for zero-token action cards on DB writes
- Agent hierarchy walk for Socket.IO access from subordinate agents
- System prompt extensions teaching A0 action card behavior
- Codex proxy plugin (GPT-5.3 brain for Agent Zero)
- 5 agent profiles (GM, AGM, Executive Chef, Sous Chef, Marketing)
- REST API endpoints for workspace CRUD, reporting, health
- 35+ database tables (operational + workspace schemas)
- 8 Alembic migrations run, realistic 1-month tapas restaurant seed data
- CI/CD via GitHub Actions (pytest + pnpm lint + Docker build)
- Security: auth on all endpoints, CVE patches, path traversal fix, Sentry error tracking

**Frontend (FOH) — demo-ready**
- Two-state UI fully working: HomeView (welcome + solitaire cards) ↔ ChatView with smooth Framer Motion transitions
- ExpoBar with live BOH status, ThoughtsStream for reasoning, ExpoTicket for step history
- Action cards: polaroid tactile design, 2-col grid, expand with chat, quick-action chips
- Chat: streaming responses, markdown tables (remark-gfm), conversation list with delete
- Reporting page with live Recharts charts, tab switcher, theme-aware
- Menu page with performance badges (Star/Puzzle/Plowhorse/Dog), live data
- Chat composer with rotating prompts, voice input ready (Web Speech API)
- Notification panel with bell badge, urgency banner
- Dark/light/system theme with Midnight Kitchen palette (oklch tokens)
- Sidebar with module nav + conversation list (unified scroll)
- All 11 module routes with page scaffolds
- Custom hooks: `useSocket`, `useChat`, `useExpoStream`, `useActionCards`

**Infrastructure — production-ready skeleton**
- Full Docker Compose: postgres + agent-zero + frontend + nginx on :8080
- GitHub Actions CI/CD (test + lint + build)
- Cloudflare tunnel tested (quick tunnels work)
- Docker image builds (note: image is currently ~15GB, optimization needed)

### What's Broken / Needs Polish
- Migration 009 not run in all environments
- Action cards not reliably reaching frontend from A0 in production (Socket.IO namespace routing bug)
- Expo bar filtering incomplete (some internal log types still leak through)
- Docker image bloat (~15GB — needs multi-stage build optimization)
- Recipe parsing/costing endpoints return mock data
- Email invoice webhook is a stub
- HQ metrics are hardcoded
- No multi-tenancy enforcement yet

### First E2E Success
User → chat → GM → call_subordinate("agm") → MCP tool → PostgreSQL → streamed response via Socket.IO → Expo Bar status → MessageList render → action card emitted to NotificationPanel. The full loop works.

---

## Phase 1: Chat Experience Polish

**Goal:** Make the chat experience premium and demo-worthy. The chat IS the product.

**Milestone:** Demo-ready — "Look what this does"

### 1.1 Response Cleaning & Formatting — PARTIAL

**Status:** Response cleaning extension exists and agent names are mapped to roles (Agent 0 → GM, etc.). Some artifacts still leak through in complex multi-agent chains.

**Current issues:** Agent Zero internal artifacts occasionally leak through — "§§include", raw tool output in edge cases.

**Remaining:**
- Comprehensive regex patterns to cover all Agent Zero internals
- Tool results formatted as structured data, not raw JSON dumps
- Test suite for response cleaning with edge cases

### 1.2 Expo Bar Enhancement — DONE

**Status:** Fully implemented. Live BOH status with delegation chain, ThoughtsStream for reasoning display, ExpoTicket for step history, smooth Framer Motion animations.

- Maps Agent Zero `state_push` log types to friendly text
- Shows delegation chain: "Asking the sous chef..." → "Checking inventory..." → "Heard."
- Animated states while active, completion indicator
- Quirky personality messages in rotation
- Smooth Framer Motion transitions between states

### 1.3 Action Card Pipeline — DONE

**Status:** Full pipeline implemented end-to-end.

- Auto-emit extension (`_30_action_card_emit.py`) fires action cards on every DB write — zero tokens required
- Proactive `action_card` tool for agent-initiated cards
- Card chat wired to Agent Zero via `AgentContext.communicate()`
- `useActionCards` hook receives cards via Socket.IO `action_card` event
- NotificationPanel renders cards with bell badge count and urgency banner
- Polaroid tactile card design, 2-col grid layout
- Quick-action chips on cards for common follow-up actions
- Card expand view with inline chat thread

**Socket.IO events:** `action_card`, `card_reply`, `card_commit`, `card_dismiss`, `card_message`

**Note:** Socket.IO namespace routing bug causes some cards to not reach the frontend in certain agent hierarchy configurations — under investigation.

### 1.4 Chat Message Rendering — DONE

**Status:** Fully implemented.

- Markdown renders correctly (headers, lists, bold, code blocks) via remark-gfm
- Data tables render as styled HTML tables, not raw text
- Assistant messages have subtle brand treatment (left border accent)
- User messages have clean bubble treatment
- Timestamps on messages
- Copy button on assistant responses

### 1.5 Chat History & Conversations — DONE

**Status:** Fully implemented.

- Conversations persist via Agent Zero's context system
- Sidebar shows conversation list with titles (auto-generated from first message)
- New conversation button (resets context)
- Conversations load with full message history on context switch
- Active conversation indicator
- Delete conversation from sidebar

### 1.6 Voice-to-Text Input — NOT STARTED

Busy chefs work with their hands. Voice input is essential.

**Architecture (planned):**
- Web Speech API (`SpeechRecognition`) for browser-native speech-to-text
- Microphone button in chat composer (next to send button)
- Recording indicator (pulsing red dot + "Recording..." label)
- Interim results shown in input field as user speaks
- On speech end, text populates the input — user can edit before sending
- Fallback: if Web Speech API unavailable, hide mic button gracefully

**Note:** Web Speech API hook is wired in the composer but not yet activated.

### 1.7 Notification System — MOSTLY DONE

**Status:** Action card notifications fully working. Toast notifications not yet implemented.

**Done:**
- Notification bell in TopBar with unread badge count
- Urgency banner for high-priority action cards
- Action cards in NotificationPanel slide-in panel
- Card types: urgent, action, update, info with priority levels

**Remaining:**
- Toast notifications (Sonner) for ephemeral real-time events
- Notification types: task completed, price alert, shortage warning, delivery update

### 1.8 Mobile-Responsive Chat — NOT STARTED

- Chat takes full screen on mobile
- Voice input prominent (primary input method on mobile)
- NotificationPanel as full-screen overlay on mobile
- Bottom navigation bar for module switching
- Solitaire cards stack vertically on mobile

---

## Phase 2: AI Backbone Reliability

**Goal:** Make agent delegation reliable, memory stable, and LLM performance fast. Parallel workstream with Phase 1.

**Milestone:** Demo-ready — chat works end-to-end with clean output

### 2.1 Agent Delegation Reliability — PARTIAL

**Status:** Core delegation works. GM delegates to AGM/sous chef, tools return results via MCP. Some reliability issues remain in complex multi-step chains.

**Done:**
- GM reliably delegates to subordinates for most queries
- MCP tools return structured results that bubble up through delegation chain
- Error handling improved — agents explain failures instead of silent errors

**Remaining:**
- Occasional wrong agent selection on ambiguous queries
- Timeout handling: graceful degradation when agent takes too long
- Multi-task parallel delegation not yet reliable

### 2.2 Memory & Context Persistence — NOT STARTED

**Status:** Still disabled. Agent Zero memory disabled due to consolidation timeout with local models.

**Target:**
- Re-enable memory with stable embedding model
- Conversation context persists across sessions
- Agent remembers: restaurant preferences, past orders, vendor relationships
- Location context switches cleanly when user changes active location

### 2.3 LLM Performance Tuning — PARTIAL

**Status:** Codex proxy plugin ships GPT-5.3 as the brain for Agent Zero. litellm provider switching works for local ↔ cloud.

**Done:**
- Codex proxy plugin (`usr/codex_provider.json`) wires GPT-5.3 as primary brain
- litellm provider switching working (local Ollama ↔ cloud APIs)
- Response times improved significantly with GPT-5.3

**Remaining:**
- Hybrid routing: local Ollama for on-prem tier, cloud for SaaS tier
- Response time target: < 5 seconds for simple queries, < 15 seconds for multi-agent delegation
- Benchmark suite to track regressions across model updates

### 2.4 Tool Quality Improvements — PARTIAL

**Status:** MCP server replaced individual Python tools for database access (40+ CRUD tools auto-generated). Shared parser not yet extracted.

**Done:**
- MCP database server provides 40+ CRUD tools covering all restaurant modules
- asyncpg UUID/Decimal type coercion handled in MCP layer
- All modules have create/read/update/delete via MCP

**Remaining:**
- **Extract shared JSON parser** — `recipe_tool._parse_response` and `invoice_tool._parse_extraction` are identical. Move to `carabiner/utils/llm_parsing.py`
- **Fix fragile string parsing** — `food_cost_tool` and `inventory_tool` parse percentage strings with `startswith`/`replace`. Add numeric columns alongside display strings
- **Normalize data access** — `reporting_tool` uses raw SQLAlchemy while other tools use repositories. Migrate to repo pattern

---

## Phase 3: Marketing Agent

**Goal:** Build the "pitch closer" — a marketing agent that generates real value immediately. This is the feature that makes investors say "I get it."

**Milestone:** Pitch-ready — "Here's why this is a company"

### 3.1 Restaurant Profile Builder

When the marketing agent first engages, it builds a profile through conversation.

**Data collected:**
- Restaurant name, location, neighborhood
- Cuisine type, price point, ambiance
- Target demographics
- Unique selling points (farm-to-table, tasting menu, craft cocktails, etc.)
- Social media handles
- Competitive landscape (nearby restaurants)
- Brand voice (playful, sophisticated, rustic, etc.)

**Storage:** New `RestaurantProfile` model in database, linked to Organization.

### 3.2 Social Trend Research

**Architecture:**
- Marketing agent uses web search tools (Agent Zero's built-in browser/search)
- Searches Instagram trends, food trends, seasonal ingredients, local events
- Aggregates into trend report: "Here's what's trending in [your neighborhood] this week"
- Identifies content opportunities

**Data sources:**
- Official APIs or approved trend aggregators (Sprout Social, Later, Brandwatch) — not direct scraping
- Google Trends for food/restaurant queries
- Local event calendars
- Seasonal ingredient calendars

### 3.3 Campaign Generator

**Conversational flow:**
1. User: "What should I post this week?"
2. Marketing agent: Reviews profile, checks trends, proposes 3-5 campaign ideas
3. User picks one or asks for modifications
4. Agent generates: caption, suggested photo direction, hashtags, posting time, target audience
5. Result stored as Campaign in workspace → action card in NotificationPanel

**Campaign types:**
- Social media posts (Instagram, Facebook, TikTok concepts)
- Email marketing (subject lines, body copy)
- Seasonal promotions (Valentine's dinner, Restaurant Week, holiday menus)
- Event marketing (wine dinners, chef's table, live music)
- UGC campaigns ("Share your dish for a chance to win")

### 3.4 Content Calendar

- Weekly/monthly view of planned content
- Auto-suggests optimal posting times based on restaurant type
- Tracks what's been posted vs planned
- Integrates with campaign status (Research → Drafting → Review → Live)

### 3.5 Performance Tracking

- Campaign status tracking (already built in workspace)
- Future: connect to Instagram/Facebook insights API for real engagement data
- ROI estimation based on campaign reach vs. covers

---

## Phase 4: Intelligence Layer

**Goal:** CarabinerOS proactively watches your business and alerts you to opportunities and threats. The "invisible advantage."

### 4.1 Email Ingestion

**Architecture:**
- Email forwarding: restaurant forwards vendor emails to a CarabinerOS inbox
- Email parsing service: extracts sender, subject, body, attachments
- Classification: price update, shortage alert, delivery confirmation, promotional offer, invoice
- Extracted data stored and linked to vendor/provider records

**Implementation:**
- IMAP polling for local tier, webhook for cloud tier
- LLM-based email classification and entity extraction
- Attachment processing (invoices → OCR pipeline via `invoice_tool`)

### 4.2 Price Change Detection

- Track item prices across invoices over time
- Alert when price changes exceed threshold (e.g., >10% increase)
- Historical price chart per item
- Proactive notification via action card: "Sysco raised avocado prices 15% since last month"

### 4.3 Cross-Vendor Comparison

- When same item available from multiple vendors, compare prices
- Proactive suggestion: "Chef's Warehouse has Hass avocados at $42/case vs Sysco's $48/case"
- Factor in: delivery schedule, minimum orders, quality differences
- Savings calculator: "Switching avocados to CW would save ~$120/month"

### 4.4 Shortage & Supply Alerts

- Parse vendor emails for shortage/allocation notices
- Cross-reference with menu items that use affected ingredients
- Proactive alert: "Sysco reports limited supply on king crab — your Crab Tower uses this"
- Link to prep/menu tools for immediate action

### 4.5 Invoice OCR Pipeline (Production)

**Current state:** `invoice_tool.py` has vision extraction via Agent Zero's multimodal LLM + PyMuPDF/Tesseract OCR fallback. Working but not battle-tested.

**Target:**
- End-to-end: upload PDF/photo → OCR → structured line items → match to inventory items → approve → update prices
- Support: Sysco invoices, Chef's Warehouse invoices, generic formats
- Confidence scoring on extracted fields
- Human review for low-confidence matches
- Auto-update item prices in system after approval

### 4.6 Proactive Notifications

All proactive events surface through the v3 notification system:
- Daily digest: "Here's what needs your attention today" (chat message on login)
- Price alerts → action cards in NotificationPanel
- Shortage warnings with suggested actions → action cards
- Delivery confirmations → toast notifications
- Budget variance alerts (food cost above target) → action cards
- Par level warnings (inventory below par) → action cards

---

## Phase 5: External Integrations

**Goal:** Connect CarabinerOS to the real world. Data flows in from POS, reservations, and vendors.

**Milestone:** Pilot-ready — "Let's run your restaurant on this"

### 5.1 Integration Architecture

Full architecture doc at `docs/plans/integration-architecture.md`.

**Pattern:** OAuth-based MCP servers — one per platform. Each integration is an MCP server that A0 can call as a tool suite.

**Database:** `restaurant_integrations` table with AES-256 encrypted OAuth tokens, per-location scoping.

**Settings UI:** `/settings/integrations` page — connect/disconnect each platform, token status, last-sync timestamp.

**MCP server template:**
- `carabiner/integrations/{platform}/mcp_server.py` — FastMCP server with OAuth2 refresh
- Tools follow same naming convention as DB MCP tools
- Platform errors surfaced as action cards (not silent failures)

### 5.2 Phase 1 Integrations — No Approval Gates

Self-service OAuth2, free developer access, no certification required.

**Google Suite MCP**
- Gmail (invoice email ingestion, vendor communications)
- Google Drive (menu PDFs, recipe docs)
- Google Calendar (events, private dining, staff schedule sync)
- Google Sheets (P&L export, budgets)

**Square MCP**
- Orders, menu, inventory, invoices, labor
- ~4M businesses, strong in independent restaurants
- Self-service OAuth2, sandbox available immediately

**7shifts MCP**
- Schedules, timecards, wages, labor reports
- Built for restaurants, ~50K restaurants on platform
- Self-service OAuth2, sandbox available

**Clover MCP**
- Orders, payments, inventory, customers, employees
- ~750K merchants, strong in independent restaurants
- Sandbox available for development

### 5.3 Phase 2 Integrations — Partner Approval Required

Formal partnership or certification process (4-8 weeks).

**Toast MCP**
- Daily sales, product mix, labor, menu data, real-time cover count
- ~120K US restaurant locations — the dominant independent restaurant POS
- Requires Toast partner certification before production API access
- Certification: submit integration, test in sandbox, code review by Toast team
- Priority: highest value integration for US market

**OpenTable MCP**
- Reservations, covers by time slot, guest profiles, special occasions
- Requires formal partnership with OpenTable (not self-service)
- Guest allergy and preference data — needs PII handling compliance

### 5.4 Phase 3 Integrations — Strategic / Gated

**DoorDash MCP**
- Delivery dispatch, order injection, menu sync
- Developer sandbox available now; production requires approval
- Revenue opportunity: restaurants can manage delivery from CarabinerOS

**Uber Eats MCP**
- Delivery marketplace, order management, menu push
- Written approval required for production access
- Similar pattern to DoorDash

**Lightspeed MCP**
- POS with strong presence in Canada and Europe
- Important for international expansion beyond US market

### 5.5 Vendor Intelligence (Sysco, Chef's Warehouse)

The vision of natural-language vendor ordering stands — but the implementation is email-first, not API-first.

**Reality check:** Sysco and Chef's Warehouse have NO public APIs. EDI access requires enterprise contracts.

**Strategy:**
- **Email ingestion** for invoice processing (Phase 4.1 + Google Suite MCP)
- **Browser automation** for order placement (Playwright headless — last resort)
- **Future:** Negotiate API partnerships from a position of traction (>100 restaurants using CarabinerOS)

**Proactive intelligence (still valid):**
- Parse Sysco/CW invoices via OCR pipeline
- Track price changes across invoice history
- Cross-vendor comparison from invoice data
- Alert: "Sysco raised avocado prices 15% since last month"

### 5.6 Live Team Broadcast

**Architecture:**
- Socket.IO rooms per location + per role
- When prep list updates, push to all connected devices in that location
- Mobile-optimized view for line cooks (read-only prep list)
- Role-based views: sous chef sees full prep, line cook sees their station
- Real-time 86 updates pushed instantly to FOH and BOH

**Access model (requires basic auth from Phase 6.1):**
- Basic JWT auth + role assignment (PIN or QR code for team members)
- Read-only view of their station/role
- No access to financial data, admin, or other locations
- Full RBAC, multi-tenancy, and billing remain in Phase 6

---

## Phase 6: SaaS Infrastructure

**Goal:** Production-ready platform that can onboard new restaurants, handle payments, and scale.

**Milestone:** Launch-ready — "Sign up at carabineros.com"

### 6.1 Authentication & Authorization

- Auth provider: Clerk, Auth0, or NextAuth.js
- Login methods: email/password, Google OAuth, magic link
- Role-based access control (RBAC):
  - **Owner:** Full access to all locations, billing, settings
  - **GM:** Full access to assigned locations, no billing
  - **Manager:** Operational access (orders, inventory, prep, menu)
  - **Staff:** Read-only station view (prep list, 86 board)
- API authentication: JWT tokens on all engine endpoints
- Session management

### 6.2 Multi-Tenancy

- Organization isolation: all queries scoped by org_id
- Location isolation: workspace data scoped by location_id
- Database: row-level security or application-level filtering
- No cross-org data leakage (critical for trust)
- Tenant-aware agent context: agent only sees data for active org/location

### 6.3 Deployment

**Cloud tier:**
- Container orchestration (Railway, Fly.io, or AWS ECS)
- Managed PostgreSQL (Neon, Supabase, or RDS)
- LLM: Claude API or cloud-hosted inference
- CDN for frontend (Vercel)
- Environment management: staging + production

**Local tier:**
- Docker Compose package (agent-zero + postgres + frontend + nginx)
- Local Ollama for LLM (no cloud dependency)
- Installer script or Electron wrapper
- Auto-update mechanism for paid updates
- License key validation

**Production Docker Compose:**
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

### 6.4 CI/CD Pipeline

- GitHub Actions
- On PR: lint + type-check + test (Python + TypeScript)
- On merge to main: build + deploy to staging
- Manual promotion: staging → production
- Database migration management in deploy pipeline

### 6.5 Billing & Subscription

- Stripe integration
- Plans: Local (one-time), Cloud Monthly, Cloud Annual
- Usage tracking (if needed: per-location pricing)
- Trial period
- Invoice generation

### 6.6 Admin Dashboard

- The `/admin` page (currently placeholder)
- Organization settings, location management
- User/role management
- Integration configuration (API keys for Toast, Resy, etc.)
- Billing management
- Usage analytics

### 6.7 Monitoring & Error Tracking

- Sentry for error tracking (frontend + backend)
- Application metrics (response times, agent success rate, tool usage)
- Uptime monitoring
- Log aggregation
- Alerting for critical errors

---

## Architecture Considerations

### Dual Deployment (Local + Cloud)

The same codebase supports both tiers:

- **LLM abstraction:** Agent Zero already supports multiple LLM backends via litellm. Local uses Ollama, cloud uses Claude/GPT API.
- **Database:** PostgreSQL in both. Local uses Docker Compose postgres. Cloud uses managed Postgres.
- **File storage:** Local disk for on-prem, S3/R2 for cloud (invoices, recipe photos).
- **Email ingestion:** IMAP polling for local, webhook for cloud.
- **Feature flags:** Some features cloud-only initially (social trend research requires internet).

### Agent Architecture

The overlay pattern is sound. Key additions needed:

- **Marketing agent profile** needs expansion (web search tools, content generation prompts)
- **Tool result schema** — standardized `additional` payload for action card rendering (already in place for most tools)
- **Shared utilities** — extract duplicated JSON parsing, move reporting to repository pattern
- **Agent memory** needs per-org/per-location scoping for multi-tenancy

### Security & Compliance

The platform handles sensitive data:

- **Financial data:** Invoices, food costs, P&L, vendor pricing, payroll
- **Guest data:** Resy profiles, allergies, dining preferences, visit history
- **Employee data:** Payroll integration, scheduling, role assignments

**Requirements:**
- TLS everywhere (HTTPS for all endpoints, WSS for Socket.IO)
- Database encryption at rest
- Tenant data isolation: org_id scoping + row-level security
- PII handling: guest allergy data is health-adjacent — minimize collection, encrypt at rest
- Email ingestion consent: restaurants must authorize email forwarding
- Data retention policy: configurable per-org, with deletion capabilities
- CCPA/GDPR: guest data deletion on request, data export capability
- PCI DSS: CarabinerOS does NOT process payments — Toast/Stripe handle PCI scope
- API key storage: vendor API keys encrypted at rest, never logged

**Local tier additional:**
- All data stays on-premise (selling point for privacy-conscious operators)
- No telemetry without opt-in

### Feature Availability Matrix

| Feature | Local (Offline) | Local (Online) | Cloud |
|---------|----------------|----------------|-------|
| Chat + AI agents | Yes (Ollama) | Yes (Ollama) | Yes (Claude API) |
| All workspace modules | Yes | Yes | Yes |
| Invoice OCR | Yes | Yes | Yes |
| Vendor ordering (API) | No | Yes | Yes |
| Social trend research | No | Yes | Yes |
| Email ingestion | No | Yes (IMAP) | Yes (webhook) |
| POS/Resy sync | No | Yes | Yes |
| Live team broadcast | LAN only | Yes | Yes |
| Auto-updates | No | Yes | Yes |

### Testing Strategy

- **Unit tests:** Tool logic, domain calculations, response cleaning (Pytest + Vitest)
- **Integration tests:** Agent → tool → database round trips
- **E2E tests:** Chat message → full pipeline → UI verification (Playwright)
- **Regression tests:** Known Agent Zero artifact patterns that should be cleaned
- **Load tests:** Simulate concurrent users per location (k6 or Locust)
- **Security tests:** OWASP ZAP scan, dependency audit, tenant isolation verification

---

## Success Criteria

**Phase 1-2 (Demo-ready):**
- [ ] Voice input works in chat composer
- [x] Action cards appear in NotificationPanel on tool completion
- [x] Expo bar shows live BOH status with friendly messages
- [ ] Clean responses with no Agent Zero artifacts (partial — some still leak)
- [x] Chat history persists across page refreshes
- [ ] All 10 tools return structured responses through the action card pipeline (Socket.IO namespace bug blocking)

**Phase 3 (Pitch-ready):**
- [ ] Marketing agent generates campaign ideas from trends
- [ ] Restaurant profile captured through conversation
- [ ] Content calendar visible in workspace

**Phase 4 (Intelligence-ready):**
- [ ] Email ingestion processing real vendor emails
- [ ] Price change alerts triggering on >10% delta
- [ ] At least one invoice OCR pipeline completing end-to-end on real documents
- [ ] Cross-vendor price comparison generating savings suggestions
- [ ] Proactive daily digest delivered to chat

**Phase 5 (Pilot-ready):**
- [ ] At least one Phase 1 integration live (Google Suite, Square, or 7shifts)
- [ ] POS data flowing (Square or Toast)
- [ ] Prep list broadcasts to team devices
- [ ] `/settings/integrations` UI live with connect/disconnect flow

**Phase 6 (Launch-ready):**
- [ ] New restaurant can sign up, configure, and start using within 30 minutes
- [ ] Multi-location org with proper data isolation
- [ ] Billing active
- [ ] 99.9% uptime target
