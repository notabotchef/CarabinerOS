# CarabinerOS — Road to Launch: Full Product Spec

> **Vision:** A full AI restaurant manager delivered as a SaaS platform. Restaurants talk to CarabinerOS like they talk to their staff — voice-first, natural language, real-time. Replace a $65k/year ops manager with a monthly subscription.

> **Business model:** Two tiers — (1) one-time local installation with support + paid updates, (2) fully cloud-based SaaS subscription.

> **Competitive moat:** Domain expertise (built by a chef who codes), natural language operations (not forms), role-based AI agents, real-time team broadcast, vendor intelligence.

> **Target integrations:** Sysco, Chef's Warehouse, Toast (POS), Resy (reservations), payroll systems.

---

## Current State (as of 2026-03-18)

### What's Built

**Engine (Backend) — ~90% scaffolded**
- 10 agent tools (order, inventory, prep, food cost, menu, marketing, recipe, reporting, invoice, ping)
- 3 agent extensions (system prompt injection, workspace sync, response cleaning)
- 5 agent profiles (GM, AGM, Executive Chef, Sous Chef, Marketing)
- Full CRUD API — 40+ endpoints across 9 workspace modules
- 35+ database tables (operational + workspace schemas)
- 5 Alembic migrations with realistic seed data
- Agent Zero integration via overlay pattern (symlinks, non-invasive)
- Socket.IO real-time streaming

**Frontend — ~93% scaffolded**
- 14 routes (13 implemented, /admin placeholder)
- 70+ components (tables, kanban board, detail panels, charts, recipe editor)
- Real-time chat with WebSocket streaming
- Dark/light mode theming (warm hospitality palette)
- Command palette (Cmd+K), location switcher, conversation history
- TanStack Query + Zustand state management

**Infrastructure — Partial**
- Docker Compose (engine + postgres + web placeholder)
- 19 unit tests (discovery + tool structure)
- No CI/CD, no auth, no deployment config

### What's Broken / Stubbed
- Agent responses have formatting issues ("scoliosis backbone")
- Agent naming leaks ("Agent 0" visible in UI)
- Status streaming to UI pills incomplete
- Chat history doesn't persist across refreshes
- Recipe parsing/costing endpoints return mock data
- Email invoice webhook is a stub
- HQ metrics are hardcoded
- No authentication or multi-tenancy enforcement

### First E2E Success
User → chat → GM → call_subordinate("agm") → inventory_tool → PostgreSQL → streamed response. The core loop works but presentation needs significant polish.

---

## Phase 1: Chat UI Overhaul

**Goal:** Make the chat experience premium and demo-worthy. The chat IS the product.

**Milestone:** Demo-ready (with Phase 2) — "Look what this does"

> **Note:** Phases 1 and 2 are parallel workstreams, not sequential. Phase 1 builds the frontend shell; Phase 2 builds the backend pipeline that feeds it. Some Phase 1 features (action cards, status pills) need their Phase 2 counterparts to function end-to-end. Work both simultaneously.

### 1.1 Action Cards Rail

The right side of the chat displays interactive notification cards when the AI completes tasks.

**Architecture:**
- New `ActionCard` component rendered in a right-side rail alongside the chat
- Cards are produced by tool results — the `tool_execute_after` extension emits structured card data via Socket.IO `workspace_update` events
- Each card has: module badge (color-coded), title, key-value data grid, timestamp, clickable navigation to the relevant workspace module
- Cards stack chronologically, newest on top
- Cards animate in (Framer Motion slide + fade)

**Card types by module:**
- **Inventory:** item name, on-hand, par, variance, vendor
- **Orders:** item, quantity, vendor, status, delivery date
- **Prep:** item, station, status (ready/at-risk/blocked), quantity
- **Food Cost:** dish, plate cost, food cost %, target comparison
- **Recipe:** recipe name, category, status, component count, est. cost
- **Invoice:** vendor, total, line item count, match status
- **Marketing:** campaign name, channel, stage, reach/engagement

**Interaction:**
- Click card → navigate to module page with that item selected/highlighted
- Dismiss card (X button) → card fades out
- Cards persist in current session, clear on new conversation

### 1.2 Voice-to-Text Input

Busy chefs and managers work with their hands. Voice input is essential.

**Architecture:**
- Web Speech API (`SpeechRecognition`) for browser-native speech-to-text
- Microphone button in chat composer (next to send button)
- Recording indicator (pulsing red dot + "Recording..." label)
- Interim results shown in input field as user speaks
- On speech end, text populates the input — user can edit before sending or auto-send after 2s pause
- Fallback: if Web Speech API unavailable, hide mic button gracefully

**UX:**
- Press mic button to start, press again or pause to stop
- Visual waveform or pulse animation during recording
- "Listening..." state clearly visible
- Works on mobile browsers (Chrome, Safari)

### 1.3 Agent Status Pill Enhancement

Show the delegation chain in real-time as agents work.

**Current state:** Status pill exists but doesn't reliably show agent chain.

**Target state:**
- Pill shows: `GM → Sous Chef → inventory_tool` with animated transitions
- Each step appears as it happens (via Socket.IO status events from `main.py`)
- Color states: amber (thinking), blue (delegating), green (completed), red (error)
- Pill collapses to "Completed via inventory_tool" when done
- On error, pill shows red with brief error context

**Backend changes:**
- `main.py` status streaming must emit structured events: `{agent: "gm", action: "delegating", target: "sous_chef"}`
- Response cleaning extension must not strip these status markers before they reach the frontend

### 1.4 Chat Message Rendering

Clean, professional message rendering.

**Improvements:**
- Markdown renders correctly (headers, lists, bold, code blocks)
- Data tables render as styled HTML tables, not raw text
- Agent responses have a subtle brand treatment (left border accent, agent avatar)
- User messages have clean bubble treatment
- Timestamps on messages
- Copy button on agent responses
- Inline action cards when tool results are returned (not just right rail)

### 1.5 Chat History & Conversations

**Current issues:** Chat doesn't persist across refreshes, conversation management is incomplete.

**Target:**
- Conversations persist in database (not just Agent Zero's file system)
- Sidebar shows conversation list with titles (auto-generated from first message)
- New conversation button
- Delete conversation
- Conversations load with full message history on click
- Active conversation indicator

### 1.6 Notification System

**Architecture:**
- Toast notifications (Sonner) for real-time events
- Notification bell in header with unread count
- Notification types: task completed, price alert, shortage warning, delivery update
- Notifications link to relevant module/item
- Socket.IO channel for push notifications

### 1.7 Mobile-Responsive Chat

- Chat takes full screen on mobile
- Voice input prominent (primary input method on mobile)
- Action cards stack below chat on mobile (no right rail)
- Swipe gestures for card dismiss
- Bottom navigation bar for module switching

---

## Phase 2: AI Backbone Fix

**Goal:** Make the AI agent delegation reliable, responses clean, and the status pipeline accurate. Straighten the scoliosis.

**Milestone:** Demo-ready — chat works end-to-end with clean output

### 2.1 Response Cleaning & Formatting

**Current issues:** Agent Zero internal artifacts leak through — "Agent 0", "§§include", "from subordinate", raw tool output.

**Target:**
- `response_stream_chunk/_25_response_cleaning.py` catches ALL internal artifacts
- Comprehensive regex patterns for Agent Zero internals
- Tool results formatted as structured data, not raw JSON dumps
- Agent names mapped to restaurant roles consistently (Agent 0 → GM, etc.)
- Test suite for response cleaning with edge cases

### 2.2 Agent Delegation Reliability

**Current issues:** Delegation sometimes fails silently, wrong agent called, tool results not returned properly.

**Target:**
- GM reliably parses multi-task requests and delegates to correct subordinates
- Sous Chef/AGM/Marketing agents call correct tools
- Tool results bubble back up through delegation chain
- Error handling: if a tool fails, agent explains what happened instead of silent failure
- Timeout handling: if agent takes too long, graceful degradation

### 2.3 Status Streaming Pipeline

**Current issues:** Status pill doesn't reflect real-time agent activity.

**Architecture:**
- `main.py` polling loop emits structured status events via Socket.IO
- Events: `agent_thinking`, `agent_delegating`, `tool_calling`, `tool_complete`, `response_ready`
- Each event carries: `{agent_name, action, target, module, timestamp}`
- Frontend `useSocket` hook processes these into pill state transitions
- Status history preserved per message (expandable to see full chain)

### 2.4 Tool Result → Action Card Pipeline

Connect tool results to the action card system from Phase 1.

**Architecture:**
- `tool_execute_after/_25_workspace_sync.py` extension emits structured card payloads
- Card payload: `{module, action, item_id, title, fields: [{label, value}], status}`
- Socket.IO `action_card` event type (distinct from `workspace_update`)
- Frontend receives card event → renders ActionCard in right rail
- Card links to workspace module with item pre-selected

### 2.5 Memory & Context Persistence

**Current issues:** Agent Zero memory disabled due to consolidation timeout.

**Target:**
- Re-enable memory with stable embedding model
- Conversation context persists across sessions
- Agent remembers: restaurant preferences, past orders, vendor relationships
- Location context switches cleanly when user changes active location

### 2.6 LLM Performance Tuning

**Current state:** Running qwen3.5:9b locally on M4 Pro 48GB via Ollama.

**Considerations:**
- Test faster models (glm-4.7-flash, phi-4, llama-3.2)
- For cloud tier: option to use Claude API for superior reasoning
- Hybrid approach: local Ollama for on-prem tier, Claude/GPT API for cloud tier
- Response time target: < 5 seconds for simple queries, < 15 seconds for multi-agent delegation

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
- Identifies content opportunities: "Your competitors are posting about cherry blossom cocktails — you should too"

**Data sources:**
- Instagram/TikTok trends via Meta Business API or approved data partners (direct scraping is fragile and legally risky — prefer official API or third-party trend aggregators like Sprout Social, Later, or Brandwatch)
- Google Trends for food/restaurant queries
- Local event calendars
- Seasonal ingredient calendars
- Competitor social media activity

### 3.3 Campaign Generator

**Conversational flow:**
1. User: "What should I post this week?"
2. Marketing agent: Reviews profile, checks trends, proposes 3-5 campaign ideas
3. User picks one or asks for modifications
4. Agent generates: caption, suggested photo direction, hashtags, posting time, target audience
5. Result stored as Campaign in workspace

**Campaign types:**
- Social media posts (Instagram, Facebook, TikTok concepts)
- Email marketing (subject lines, body copy)
- Seasonal promotions (Valentine's dinner, Restaurant Week, holiday menus)
- Event marketing (wine dinners, chef's table, live music)
- User-generated content campaigns ("Share your dish for a chance to win")

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

**Goal:** CarabinerOS proactively watches your business and alerts you to opportunities and threats. This is the "invisible advantage" — things happening automatically that you didn't ask for.

### 4.1 Email Ingestion

**Architecture:**
- Email forwarding setup: restaurant forwards vendor emails to a CarabinerOS inbox
- Email parsing service: extracts sender, subject, body, attachments
- Classification: price update, shortage alert, delivery confirmation, promotional offer, invoice
- Extracted data stored and linked to vendor/provider records

**Implementation:**
- IMAP/webhook email receiver
- LLM-based email classification and entity extraction
- Attachment processing (invoices → OCR pipeline)

### 4.2 Price Change Detection

- Track item prices across invoices over time
- Alert when price changes exceed threshold (e.g., >10% increase)
- Historical price chart per item
- Notification: "Sysco raised avocado prices 15% since last month"

### 4.3 Cross-Vendor Comparison

- When same item available from multiple vendors, compare prices
- Proactive suggestion: "Chef's Warehouse has Hass avocados at $42/case vs Sysco's $48/case this week"
- Factor in: delivery schedule, minimum orders, quality differences
- Savings calculator: "Switching avocados to CW would save ~$120/month"

### 4.4 Shortage & Supply Alerts

- Parse vendor emails for shortage/allocation notices
- Cross-reference with menu items that use affected ingredients
- Proactive alert: "Sysco reports limited supply on king crab — your Crab Tower uses this. Consider menu adjustment or alternate vendor."
- Link to prep/menu tools for immediate action

### 4.5 Invoice OCR Pipeline (Production)

**Current state:** `invoice_tool.py` has vision extraction via Agent Zero's `document_query` but endpoint returns mock data.

**Target:**
- End-to-end: upload PDF/photo → OCR → structured line items → match to inventory items → approve → update prices
- Support: Sysco invoices, Chef's Warehouse invoices, generic formats
- Confidence scoring on extracted fields
- Human review for low-confidence matches
- Auto-update item prices in system after approval

### 4.6 Proactive Notifications

- Daily digest: "Here's what needs your attention today"
- Price alerts pushed to chat as notification cards
- Shortage warnings with suggested actions
- Delivery confirmations
- Budget variance alerts (food cost above target)
- Par level warnings (inventory below par)

---

## Phase 5: External Integrations

**Goal:** Connect CarabinerOS to the real world. Data flows in from POS, reservations, and vendors — not just from manual entry.

**Milestone:** Pilot-ready — "Let's run your restaurant on this"

### 5.1 Sysco API Connector

- Research Sysco's ordering API (Sysco Shop / EDI integration)
- Product catalog sync (items, prices, availability)
- Order placement via natural language → API call
- Delivery tracking
- Invoice auto-import
- Fallback: if no API, browser automation or email-based ordering

### 5.2 Chef's Warehouse API Connector

- Same pattern as Sysco
- Product catalog, ordering, price tracking
- Esteban has direct contacts — explore API partnership

### 5.3 Toast POS Integration

- Toast API: sales data, product mix, covers, revenue
- Real-time cover count for pre-shift briefings
- Product mix data for menu engineering (Stars/Puzzles/Plowhorses/Dogs)
- Sales trends for reporting
- Tip and labor data for P&L

### 5.4 Resy Reservation Sync

- Resy API: upcoming reservations, cover count by time slot
- Guest profiles: returning guests, preferences, allergies, special occasions
- Pre-shift briefing data: "2 returning tables, 5 allergy alerts"
- No-show tracking

### 5.5 Payroll System Integration

- Connect to payroll provider (ADP, Gusto, Square Payroll, etc.)
- Pull labor cost data for P&L reporting
- Scheduled labor vs actual
- Overtime alerts

### 5.6 Live Team Broadcast

**Architecture:**
- Socket.IO rooms per location + per role
- When prep list updates, push to all connected devices in that location
- Mobile-optimized view for line cooks (read-only prep list)
- Role-based views: sous chef sees full prep, line cook sees their station
- Real-time 86 updates pushed instantly to FOH and BOH
- Notification sounds/vibration for critical updates

**Access model (requires basic auth from Phase 6.1 — implement auth subset here):**
- Basic JWT auth + role assignment (PIN or QR code for team members)
- Read-only view of their station/role
- No access to financial data, admin, or other locations
- Note: Full RBAC, multi-tenancy, and billing remain in Phase 6. Phase 5.6 only needs lightweight team auth.

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
- Ollama/LLM: cloud-hosted inference (RunPod, Together.ai) or Claude API
- CDN for frontend (Vercel)
- Environment management: staging + production

**Local tier:**
- Docker Compose package (engine + postgres + web)
- Local Ollama for LLM (no cloud dependency)
- Installer script or Electron wrapper
- Auto-update mechanism for paid updates
- License key validation

### 6.4 CI/CD Pipeline

- GitHub Actions or similar
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

The same codebase must support both tiers. Key design decisions:

- **LLM abstraction layer:** Interface that wraps Ollama (local) or Claude API (cloud). Agent Zero already supports multiple LLM backends — leverage this.
- **Database:** PostgreSQL in both cases. Local uses Docker Compose postgres. Cloud uses managed Postgres.
- **File storage:** Local disk for on-prem, S3/R2 for cloud (invoices, recipe photos).
- **Email ingestion:** IMAP polling for local, webhook for cloud.
- **Feature flags:** Some features may be cloud-only initially (e.g., social trend research requires internet).

### Agent Architecture

The existing overlay pattern is sound. Key additions needed:

- **Marketing agent profile** needs significant expansion (web search tools, content generation prompts)
- **Tool result schema** needs standardization for action card rendering
- **Status event protocol** needs formalization for the streaming pipeline
- **Agent memory** needs per-org/per-location scoping for multi-tenancy

### Data Flow

```
User (voice/text)
  → Chat UI
    → Socket.IO
      → main.py
        → AgentBridge.communicate()
          → GM agent
            → delegates to role agent
              → calls tool
                → PostgreSQL query/mutation
              → tool result
            → formatted response
          → response + status events
        → Socket.IO emit
      → Chat message + Action Card + Status Pill
    → Notification (if proactive)
```

### Security & Compliance

The platform handles sensitive data across multiple categories:

- **Financial data:** Invoices, food costs, P&L, vendor pricing, payroll
- **Guest data:** Resy profiles, allergies, dining preferences, visit history
- **Employee data:** Payroll integration, scheduling, role assignments

**Requirements:**
- TLS everywhere (HTTPS for all endpoints, WSS for Socket.IO)
- Database encryption at rest (PostgreSQL TDE or managed provider encryption)
- Tenant data isolation: application-level org_id scoping + database row-level security
- PII handling: guest allergy data is health-adjacent — minimize collection, encrypt at rest
- Email ingestion consent: restaurants must authorize email forwarding; no third-party email access
- Data retention policy: configurable per-org, with deletion capabilities
- CCPA/GDPR: guest data deletion on request, data export capability
- PCI DSS: CarabinerOS does NOT process payments directly — Toast/Stripe handle PCI scope. Keep payment data out of our database.
- API key storage: vendor API keys (Sysco, Toast, Resy) encrypted at rest, never logged

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
- **Load tests:** Simulate concurrent users per location for 99.9% uptime target (k6 or Locust)
- **Security tests:** OWASP ZAP scan, dependency audit, tenant isolation verification

---

## Success Criteria

**Phase 1-2 (Demo-ready):**
- [ ] Voice input works in chat
- [ ] Action cards appear on tool completion
- [ ] Agent status pill shows real-time delegation chain
- [ ] Clean responses with no Agent Zero artifacts
- [ ] Chat history persists across page refreshes

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
- [ ] At least one vendor integration live (Sysco or CW)
- [ ] POS data flowing (Toast or Resy)
- [ ] Prep list broadcasts to team devices
- [ ] Invoice OCR working on real documents

**Phase 6 (Launch-ready):**
- [ ] New restaurant can sign up, configure, and start using within 30 minutes
- [ ] Multi-location org with proper data isolation
- [ ] Billing active
- [ ] 99.9% uptime target
