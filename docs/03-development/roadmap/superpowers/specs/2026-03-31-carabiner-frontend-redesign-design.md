# CarabinerOS Frontend Redesign Spec

**Date:** 2026-03-31  
**Status:** Draft  
**Author:** Sisyphus (AI Agent)  
**Version:** 1.0

---

## 1. Vision

CarabinerOS is a restaurant management dashboard powered by Agent Zero. The current frontend suffers from a "generic AI dashboard" aesthetic — every page follows the same KPI+Table formula, the homepage is structurally identical to ChatGPT/Claude, and typography/fonts are inconsistently applied across modules.

**Goal:** Transform the frontend into a distinctive, intuitive, restaurant-native interface where:
- The **home page is chat-forward** — chat is the hero, not buried in a sidebar
- Every **module page** has a consistent shell: content area + right sidebar (AI co-pilot) + bottom chatbar
- **Typography is strictly enforced** — DM Sans for all text, Geist Mono for all numbers
- **Creative modules** (Menu, Recipes, Marketing) get custom layouts that break the mold
- The system **learns over time** — more usage = better AI-generated insights in the sidebar

---

## 2. Design Approach: Hybrid Core + Custom Wings

**Core modules** (Orders, Inventory, Prep, Invoices, Food Cost, Reporting) share the same layout pattern — content + sidebar + chatbar.

**Creative modules** (Menu, Recipes, Marketing) get custom, distinctive layouts optimized for their workflows.

All modules share:
- The same top bar
- The same bottom chatbar
- The same right sidebar co-pilot pattern
- The same typography system

---

## 3. Global Shell Architecture

### 3.1 The 3-Layer Shell (All Module Pages)

```
┌─────────────────────────────────────────────────────┐
│  TOP BAR (56px, glass morphism, always present)     │
│  [≡] CarabinerOS  ·  [Location]  ·  [🔔] [⚙️]     │
├──────────────────────────┬──────────────────────────┤
│                          │  RIGHT SIDEBAR           │
│  MAIN CONTENT AREA       │  (320px, slides in/out)  │
│  (module-specific)       │  - Item details          │
│  (scrolls independently) │  - AI suggestions        │
│                          │  - Quick actions         │
│                          │  - Useful context        │
├──────────────────────────┴──────────────────────────┤
│  BOTTOM CHATBAR (72px, persistent, always present)  │
│  [📎] Ask CarabinerOS...                    [→]    │
└─────────────────────────────────────────────────────┘
```

### 3.2 Shell Component Specifications

| Component | Height | Behavior | Notes |
|-----------|--------|----------|-------|
| Top Bar | 56px | Fixed, glass morphism | Brand, location, notifications, theme toggle |
| Main Content | Flexible | Scrolls independently | Module-specific layout |
| Right Sidebar | 320px | Slides in on item click, slides out on deselect | AI co-pilot panel |
| Bottom Chatbar | 72px | Fixed, always visible | Chat input with attachment support |

### 3.3 Home Page (Exception)

The home page breaks the shell — no sidebar, chat is the hero:

```
┌─────────────────────────────────────────────────────┐
│  TOP BAR                                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│         "Good morning, Chef"                        │
│         [Chat Composer - Large, centered]           │
│                                                     │
│         Daily Briefing Card                         │
│         KPI Cards (Solitaire)                       │
│                                                     │
├─────────────────────────────────────────────────────┤
│  BOTTOM CHATBAR                                     │
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- No right sidebar on home page
- Chat composer is large and centered (primary interaction)
- Daily Briefing card shows AI-generated insights
- KPI cards show real-time operational metrics
- Bottom chatbar provides quick access while browsing

---

## 4. Typography System (Strictly Enforced)

### 4.1 Font Assignment

| Role | Font | Tailwind Class | Use For |
|------|------|---------------|---------|
| All text | DM Sans | default (no class needed) | Headings, body, labels, descriptions, buttons |
| All numbers | Geist Mono | `font-mono` | Prices, percentages, dates, times, quantities, KPIs, axis labels, tabular data |

### 4.2 Typography Scale

| Size | Tailwind | Use For |
|------|----------|---------|
| 10px | `text-[10px]` | Timestamps, axis labels, micro-labels |
| 11px | `text-[11px]` | Badge text, secondary labels |
| 12px | `text-xs` | Body small, card descriptions |
| 13px | `text-[13px]` | Body default in dense contexts (tables) |
| 14px | `text-sm` | Standard body text |
| 16px | `text-base` | Card titles, section headers |
| 20px | `text-xl` | Page titles |
| 30px | `text-3xl` | KPI hero numbers |

### 4.3 Enforcement Strategy

1. **Audit all pages** for font violations (Inter, system fonts, arbitrary font-family)
2. **Replace violations** with `font-mono` (numbers) or default cascade (text)
3. **Add ESLint rule** to flag non-compliant font usage
4. **Update DESIGN_TOKENS.md** to explicitly list banned fonts and enforcement rules

---

## 5. Core Module Layouts

### 5.1 Orders Page

**Design direction:** Editorial pipeline — visual status tracking, not spreadsheet noise.

**Layout:**
- Header: "Orders" title + "New Order" button
- Pipeline KPI Strip: 6 stages (Drafting → Ready → Pending → Submitted → Confirmed → Delivered) with counts
- Toolbar: Search input + filter tabs with animated underline
- Data table: Vendor | Channel | Status | Total | ETA | Created
- Row click → opens right sidebar with order details

**Right Sidebar (on order click):**
- Order header: #, vendor, status, total
- AI Insights: "You ordered meat yesterday — are you sure?" with Accept/Modify/Dismiss
- Line items list with quantities and prices
- Context data: Cut-off time, ETA, delivery notes
- Quick actions: Submit Order, Add Item, Compare Prices, View History

**Current state:** Already has good pipeline design. Needs sidebar integration and chatbar.

---

### 5.2 Inventory Page

**Design direction:** Warehouse awareness — visual stock levels, not just numbers.

**Layout:**
- Header: "Inventory" + Tabs (Overview | Counts | Par Levels | Waste)
- KPI Cards: Total Items | Below Par | Above Par | Inventory Value
- Variance Distribution Bar: Visual below/at/above par breakdown
- Data table: Item | Category | Storage | On Hand | Par | Variance | Unit Cost | Last Updated
- Row click → opens right sidebar with item details

**Right Sidebar (on item click):**
- Item header: Name, category, storage area
- AI Insights: "Below par — order now? Coastal has it at $14/lb"
- Stock details: On hand, par, variance, unit cost
- Count history: Last 5 counts with dates
- Quick actions: Order Now, Adjust Count, Set Par Level, View Waste Log

**Current state:** Generic KPI+Table. Needs sidebar, chatbar, and warehouse visualization.

---

### 5.3 Prep Page

**Design direction:** Kanban board — visual workflow, not a list.

**Layout:**
- Header: "Prep" + Date selector
- 4-column Kanban: Not Started | In Progress | Ready | Blocked
- Cards in each column: Station, item, quantity, urgency indicator
- Card click → opens right sidebar with prep details

**Right Sidebar (on card click):**
- Prep item header: Name, station, quantity
- AI Insights: "This usually takes 45 min — start by 3 PM for dinner service"
- Details: Station assignment, estimated time, dependencies
- Quick actions: Mark Complete, Reassign, Add Note, View Recipe

**Current state:** Unknown (needs audit). Should be completely redesigned as Kanban.

---

### 5.4 Invoices Page

**Design direction:** Financial control — match invoices to POs, flag discrepancies.

**Layout:**
- Header: "Invoices" + Status filter + Search
- KPI Strip: Pending | Approved | Paid | Flagged
- Data table: Vendor | Invoice # | Amount | PO Match | Status | Date
- Row click → opens right sidebar with invoice details

**Right Sidebar (on invoice click):**
- Invoice header: #, vendor, amount, status
- AI Insights: "PO was $2,650 — this is $2,840 ($190 over). Flag?"
- Line items with PO comparison
- Match percentage and discrepancy details
- Quick actions: Approve, Flag, Request Revision, View PO

**Current state:** Unknown (needs audit). Needs sidebar, chatbar, and PO matching visualization.

---

### 5.5 Food Cost Page

**Design direction:** Analytics dashboard — trends, pressure items, actionable insights.

**Layout:**
- Header: "Food Cost" + Period selector + Location filter
- KPI Strip: Avg Cost % | Target | Variance | Top Spenders
- Trend Chart: Cost % over time with target line
- Category Breakdown: Bar chart by category
- Pressure Items: Items trending up in cost
- Data table: Item | Cost | Last Week | Trend | Pressure
- Row click → opens right sidebar with item analysis

**Right Sidebar (on item/dish click):**
- Item header: Name, category, current cost
- AI Insights: "Salmon up 15% from Coastal — Chef's Warehouse is 8% less"
- Price history: Last 4 weeks with trend line
- Supplier comparison: Same item across vendors
- Quick actions: Switch Supplier, Adjust Portion, View Recipe Impact, Set Alert

**Current state:** Has good chart structure. Needs sidebar integration and chatbar.

---

### 5.6 Reporting Page

**Design direction:** Financial overview — P&L clarity, period comparison.

**Layout:**
- Header: "Reporting" + Period toggle (Today | Week | Month)
- KPI Hero Cards: Revenue | COGS | Labor | Net Profit (with delta indicators)
- Hero Chart: Revenue trend with overlays
- P&L Breakdown Table: Category | Amount | % Rev | Budget | Variance
- Row click → opens right sidebar with category analysis

**Right Sidebar (on row click):**
- Category header: Name, amount, variance
- AI Insights: "Labor is 2% above target — check overtime from last weekend"
- Breakdown details with sub-categories
- Quick actions: View Details, Export, Set Budget Alert

**Current state:** Good structure. Needs sidebar integration and chatbar.

---

## 6. Custom Module Layouts

### 6.1 Menu Page — Menu Engineering Matrix

**Design direction:** Strategic analysis — 2×2 matrix, not a table.

**Layout:**
- Header: "Menu" + Period selector
- 2×2 Menu Engineering Matrix:
  - Y-axis: Profitability (Low → High)
  - X-axis: Popularity (Low → High)
  - Quadrants: ⭐ Stars | 🐎 Plowhorses | 🧩 Puzzles | 🐕 Dogs
  - Each dish plotted as a bubble (size = revenue)
- Below matrix: Dish list with sortable columns
- Dish click → opens right sidebar with dish analysis

**Right Sidebar (on dish click):**
- Dish header: Name, category, price
- AI Insights: "This is a Star — consider raising price by $2, demand is inelastic"
- Cost breakdown: Ingredients, labor, overhead
- Performance metrics: Popularity index, profitability, trend
- Quick actions: Adjust Price, View Recipe, Analyze Variants

**Current state:** Unknown (needs audit). Should be completely redesigned as matrix.

---

### 6.2 Recipes Page — Cookbook Layout

**Design direction:** Visual cookbook — recipe cards, not a spreadsheet.

**Layout:**
- Header: "Recipes" + Search + Category filter
- Grid of recipe cards (3-4 columns):
  - Card: Dish name, image placeholder, cost, margin %, category badge
  - Hover effect: Scale up, show quick actions
- Recipe click → opens right sidebar with full recipe

**Right Sidebar (on recipe click):**
- Recipe header: Name, category, yield
- AI Insights: "Salmon price up 15% — consider portion adjustment or substitute"
- Ingredients list with current costs
- Price trend history: Last 4 weeks
- Quick actions: Cost Out, Adjust Portion, View Menu Impact, Print

**Current state:** Unknown (needs audit). Should be completely redesigned as cookbook.

---

### 6.3 Marketing Page — Campaign Dashboard

**Design direction:** Campaign management — visual calendar, performance metrics.

**Layout:**
- Header: "Marketing" + "New Campaign" button
- KPI Strip: Active Campaigns | Reach | Engagement | ROI
- Two-column layout:
  - Left: Social Media campaigns + Email campaigns (card lists)
  - Right: Content Calendar (month view)
- Campaign click → opens right sidebar with campaign details

**Right Sidebar (on campaign click):**
- Campaign header: Name, type, status, dates
- AI Insights: "This post performed 40% above average — similar content for Friday?"
- Performance metrics: Reach, engagement, conversions, ROI
- Content preview with edit options
- Quick actions: Edit, Duplicate, Schedule, View Analytics

**Current state:** Unknown (needs audit). Should be completely redesigned as dashboard.

---

## 7. Sidebar Co-Pilot Architecture

### 7.1 Structure

The right sidebar is the AI co-pilot. Consistent structure across all modules:

```
┌─────────────────────────────────┐
│ [X] Close                       │
├─────────────────────────────────┤
│                                 │
│  📋 ITEM HEADER                 │
│  Order #4821 / Coastal Produce  │
│  Status: Drafting               │
│                                 │
├─────────────────────────────────┤
│                                 │
│  🤖 AI INSIGHTS                 │
│  "You ordered meat yesterday.   │
│   Are you sure you need more?"  │
│                                 │
│  [Accept] [Modify] [Dismiss]    │
│                                 │
├─────────────────────────────────┤
│                                 │
│  📊 CONTEXT DATA                │
│  Line Items: 12                 │
│  Total: $1,240                  │
│  Cut-off: 2:00 PM               │
│  ETA: Tomorrow 8:00 AM          │
│                                 │
├─────────────────────────────────┤
│                                 │
│  ⚡ QUICK ACTIONS               │
│  [Submit Order] [Add Item]      │
│  [Compare Prices] [View History]│
│                                 │
└─────────────────────────────────┘
```

### 7.2 Behavior

| Trigger | Action |
|---------|--------|
| Click item in module | Sidebar slides in from right (320px) |
| Click close button or deselect | Sidebar slides out |
| Navigate between modules | Sidebar updates to match new context |
| AI generates new insight | Notification badge on sidebar header |

### 7.3 Data Source

All sidebar content is generated by Agent 0 based on:
- Current module context
- Selected item details
- Historical usage patterns
- Real-time data from database

**Learning loop:** The more the user interacts, the more Agent 0 learns about preferences, patterns, and priorities — resulting in increasingly relevant insights.

---

## 8. Bottom Chatbar

### 8.1 Specifications

| Property | Value |
|----------|-------|
| Height | 72px |
| Position | Fixed at bottom of viewport |
| Visibility | Always present on all pages |
| Background | Glass morphism (blur + transparency) |
| Border | Top border only, subtle |

### 8.2 Components

- Attachment button (📎) — left side
- Chat input — center, placeholder rotates with context-aware prompts
- Send button (→) — right side, gradient primary color
- Queue indicator — shows pending messages when agent is busy

### 8.3 Context-Aware Prompts

The chatbar placeholder changes based on the current module:

| Module | Placeholder |
|--------|-------------|
| Home | "Ask CarabinerOS anything…" |
| Orders | "Ask about this order…" |
| Inventory | "Check inventory levels…" |
| Prep | "Update prep status…" |
| Invoices | "Process this invoice…" |
| Food Cost | "Why is food cost high?…" |
| Menu | "Analyze menu performance…" |
| Recipes | "Cost out a recipe…" |
| Marketing | "Generate a campaign…" |
| Reporting | "Run a P&L report…" |

---

## 9. Database Structure for AI-Generated Content

### 9.1 Sidebar Content Tables

The sidebar content is dynamically generated by Agent 0. We need a database structure to store:

1. **User Interaction History** — Track what the user clicks, views, and acts on
2. **AI Insights Cache** — Store generated insights with expiration
3. **Context Profiles** — Store learned preferences and patterns per user/location

### 9.2 Proposed Schema

```sql
-- User interaction tracking
CREATE TABLE user_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    location_id UUID,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,  -- 'view', 'click', 'dismiss', 'accept'
    target_type VARCHAR(50),      -- 'order', 'inventory_item', 'recipe', etc.
    target_id UUID,
    context JSONB,                -- Additional context data
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI insights cache
CREATE TABLE ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL,
    module VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID NOT NULL,
    insight_type VARCHAR(50) NOT NULL,  -- 'suggestion', 'alert', 'comparison'
    content TEXT NOT NULL,
    metadata JSONB,                     -- Structured data for rendering
    confidence DECIMAL(3,2),            -- 0.00 to 1.00
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    dismissed BOOLEAN DEFAULT FALSE
);

-- Context profiles (learned patterns)
CREATE TABLE context_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL,
    profile_type VARCHAR(50) NOT NULL,  -- 'ordering_pattern', 'cost_sensitivity', 'vendor_preference'
    data JSONB NOT NULL,
    confidence DECIMAL(3,2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(location_id, profile_type)
);
```

### 9.3 Agent 0 Integration

Agent 0 generates sidebar content through:
1. **Real-time analysis** — When user clicks an item, Agent 0 analyzes context and generates insights
2. **Scheduled analysis** — Periodic background jobs generate insights for frequently viewed items
3. **Event-driven triggers** — When data changes (e.g., price update), Agent 0 generates new insights

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create global shell components (TopBar, BottomChatbar, SidebarContainer)
- [ ] Enforce typography system across all pages
- [ ] Audit and fix font violations
- [ ] Update DESIGN_TOKENS.md with enforcement rules

### Phase 2: Home Page Redesign (Week 2-3)
- [ ] Redesign home page as chat-forward layout
- [ ] Implement Daily Briefing card
- [ ] Implement KPI Solitaire cards
- [ ] Add context-aware chat prompts

### Phase 3: Core Module Layouts (Week 3-5)
- [ ] Orders: Add sidebar integration, chatbar
- [ ] Inventory: Add sidebar, chatbar, warehouse visualization
- [ ] Prep: Redesign as Kanban board
- [ ] Invoices: Add sidebar, chatbar, PO matching
- [ ] Food Cost: Add sidebar, chatbar
- [ ] Reporting: Add sidebar, chatbar

### Phase 4: Custom Module Layouts (Week 5-7)
- [ ] Menu: Redesign as Menu Engineering Matrix
- [ ] Recipes: Redesign as Cookbook layout
- [ ] Marketing: Redesign as Campaign Dashboard

### Phase 5: AI Co-Pilot System (Week 7-9)
- [ ] Implement database schema for AI content
- [ ] Build sidebar co-pilot component
- [ ] Integrate Agent 0 for real-time insight generation
- [ ] Implement learning loop (interaction tracking → better insights)

### Phase 6: Polish & Testing (Week 9-10)
- [ ] Micro-interactions and animations
- [ ] Cross-browser testing
- [ ] Performance optimization
- [ ] Accessibility audit

---

## 11. Success Criteria

1. **No "AI dashboard" feel** — Each module has distinctive visual identity
2. **Chat-forward home page** — Chat is the hero, not buried
3. **Consistent typography** — DM Sans + Geist Mono enforced everywhere
4. **AI co-pilot sidebar** — Context-aware, learns over time
5. **Persistent bottom chatbar** — Always accessible, context-aware prompts
6. **Intuitive navigation** — Users can find what they need in 3 clicks or less

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent 0 latency for sidebar content | High | Cache insights, show loading states, fallback to static data |
| Complex layouts increase bundle size | Medium | Code-split modules, lazy-load custom layouts |
| Typography changes break existing designs | Low | Audit thoroughly, test each page individually |
| Sidebar overwhelms small screens | Medium | Responsive design: sidebar becomes full-screen overlay on mobile |

---

*End of spec.*
