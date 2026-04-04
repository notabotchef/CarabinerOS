# Prep Module -- Functional Upgrade Plan

Created: 2026-03-24
Status: Research complete, ready for implementation

---

## 1. Current State Assessment

### Frontend (`frontend/src/app/prep/page.tsx`)
- Single-page read-only view pulling from `/api/prep` via `useWorkspace` hook
- Displays prep items grouped by station (alphabetical sort)
- Service lane filter tabs: All, Lunch, Dinner, All Day
- Readiness ring visualization (donut chart) showing Ready/In Progress/At Risk/Not Started/Blocked
- Readiness badges per item with color coding
- Shortage indicators (AlertTriangle icon + text)
- No interactivity beyond filtering -- cannot mark items complete, assign cooks, add items, or edit anything
- No time estimates, no par-based calculations, no batch sizing, no recipe linking in the UI

### Backend -- WorkspacePrep model (`carabiner/db/workspace_models.py`)
- Flat summary model designed for UI display, not operational depth
- Fields: `service_lane`, `task`, `station`, `readiness`, `shortage`, `summary`, `detail_points`, `prompt`
- No link to recipes, no quantity fields, no assigned cook, no time estimates, no completion tracking

### Backend -- PrepList/PrepListItem models (`carabiner/db/models.py`)
- Operational models exist but are disconnected from the frontend
- `PrepList`: location-scoped, date-indexed, status (generated/in_progress/completed)
- `PrepListItem`: recipe_id FK, qty_needed, on_hand, to_prep, is_complete, completed_qty, completed_at
- These have the bones of a real prep system but nothing wires them to the workspace layer or UI

### MCP Tools (`carabiner/mcp/server.py`)
- Five tools marked `(legacy)`: prep_list, prep_get, prep_create, prep_update, prep_delete
- All operate on the WorkspacePrep table (the flat summary model)
- No tools for the operational PrepList/PrepListItem models
- No par-based generation, no batch calculation, no completion workflow

### API Route (`carabiner/api/flask_blueprint.py`)
- Single GET endpoint `/api/prep` returning all WorkspacePrep rows
- No date filtering, no POST/PATCH/DELETE endpoints
- No route for the operational PrepList/PrepListItem tables

### Gap Summary
The prep module has a display shell and operational table skeletons but zero functional depth. A sous chef opening at 6am would see a static list that cannot be marked off, cannot auto-calculate quantities, and has no connection to recipes, inventory, or expected covers.

---

## 2. Competitive Landscape

### Galley Solutions (galleysolutions.com)
- "Culinary Resource Planning" platform -- recipes are the single source of truth
- One-click prep list generation from recipes and menus
- Batch scaling tied to production plans per outlet
- Real-time food costing feeds into prep decisions
- Multi-location production calendars
- Strength: recipe-to-prep-to-order pipeline is seamless
- Weakness: enterprise pricing, heavy onboarding, overkill for single-unit

### meez (getmeez.com)
- Recipe management with built-in prep loss tracking and yield calculations
- Sub-recipe scaling: one click scales all components
- Photos and videos on every prep step (70% faster onboarding claim)
- Multilingual step translations for diverse kitchen teams
- POS integration for sales-volume-aware prep quantities
- Strength: chef-friendly UX, visual step-by-step, cost-aware
- Weakness: no real-time station assignment or kitchen-display-style tracking

### Apicbase (apicbase.com)
- Production planning calendar: drag-and-drop recipes into daily plans per outlet
- Task assignment to staff with progress monitoring
- Batch quantities calculated from actual demand (POS + forecasts)
- Purchase suggestions generated from production plans and stock levels
- Multi-unit consistency enforcement
- Strength: full demand-to-prep-to-purchase loop, multi-unit ready
- Weakness: complex setup, better suited for commissary/central kitchen ops

### KitchenCut (kitchencut.com)
- Recipe costing with real-time margin tracking
- Menu engineering (popularity vs profitability matrix)
- Inventory control with reorder alerts
- Allergen tracking baked into recipes
- Visual cooking instructions per station
- Strength: cost-focused, strong for chef-owners tracking margins
- Weakness: prep list functionality is secondary to costing

### Jolt (jolt.com)
- Digital checklists replacing paper prep lists, line checks, opening/closing lists
- Bluetooth temperature probe integration
- Label printing for prep dates, use-by dates
- Task accountability tracking (who completed what, when)
- 24/7 cooler/freezer monitoring with alerts
- Strength: accountability and food safety compliance, 15K+ customers
- Weakness: checklist-oriented, no recipe scaling or quantity intelligence

### FreshCheq (freshcheq.com)
- Prep logs with on-hand vs par comparison, auto-calculate what to prep
- Temperature logs with Bluetooth probe sync
- Cooling logs with timer alerts
- Food waste tracking with dollar values
- Push notifications when logs are not completed on time
- Strength: simple par-based prep calculation, compliance-first
- Weakness: no recipe linking, no batch scaling, no station assignment

### Competitive Positioning for CarabinerOS
The market splits into two camps: (1) recipe-centric platforms (Galley, meez, Apicbase) that generate prep from recipes but lack real-time kitchen-floor tracking, and (2) checklist platforms (Jolt, FreshCheq) that track completion but have no recipe intelligence. Nobody combines AI-driven prep generation with a kitchen-display-style live tracking UI. That is our lane.

---

## 3. Target User Experience

Think like a sous chef arriving at 6am. The prep page should answer these questions in under 5 seconds:

1. **What needs to be prepped today?** -- Full list by station, ordered by priority
2. **How much of each item?** -- Par-based quantities factoring on-hand inventory
3. **Who is doing what?** -- Station assignments with cook names
4. **What is done, what is behind?** -- Live completion tracking with time context
5. **Are we short on anything?** -- Shortage alerts tied to inventory, surfaced early
6. **What is the recipe?** -- One tap to see the full recipe for any prep item

### Daily Flow
- **5:30am**: AI auto-generates today's prep list from recipes + expected covers + on-hand inventory
- **6:00am**: Sous chef reviews the list, adjusts quantities, assigns cooks to stations
- **6:15am**: Cooks see their station's tasks on their device, start working through them
- **8:00am**: Sous chef checks progress -- 60% done, pantry is behind, grill is ahead
- **10:30am**: All lunch prep marked complete, dinner prep items auto-surface
- **2:00pm**: PM shift picks up remaining dinner prep with clear handoff

---

## 4. Data Model Changes

### 4a. Extend PrepListItem (operational model)
Add columns to `prep_list_items`:
- `station` (String 100) -- which station this task belongs to (Grill, Pantry, Garde Manger, etc.)
- `assigned_to` (String 100, nullable) -- cook name or initials
- `est_minutes` (Integer, nullable) -- estimated prep time in minutes
- `sort_order` (Integer, default 0) -- manual ordering within station
- `service_lane` (String 50) -- Lunch, Dinner, All Day
- `notes` (Text, nullable) -- free-form notes from sous chef

### 4b. Extend PrepList (operational model)
Add columns to `prep_lists`:
- `expected_covers` (Integer, nullable) -- forecasted guest count driving quantities
- `generated_by` (String 50, default "manual") -- "ai" or "manual"
- `approved_by` (String 100, nullable) -- sous chef who signed off
- `approved_at` (DateTime, nullable)

### 4c. Create PrepStation reference table
New table `prep_stations`:
- `id` (UUID PK)
- `location_id` (FK to locations)
- `name` (String 100) -- "Grill", "Pantry", "Garde Manger", "Pastry", "Saucier", etc.
- `sort_order` (Integer)
- `default_cook` (String 100, nullable) -- typical assignment
- Standard timestamps

### 4d. Deprecation path for WorkspacePrep
- Phase 1: Keep WorkspacePrep as a read cache, populate it from PrepList/PrepListItem via a sync function
- Phase 2: Frontend reads directly from new API endpoints returning PrepList/PrepListItem data
- Phase 3: Remove WorkspacePrep table and related MCP tools

---

## 5. API Endpoints

### New REST endpoints (Flask blueprint)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/prep/today` | Today's prep list with items, grouped by station |
| GET | `/api/prep/lists?date=YYYY-MM-DD` | Prep list for a specific date |
| GET | `/api/prep/lists/:id` | Single prep list with all items |
| POST | `/api/prep/lists/generate` | AI-generate a prep list for a date (covers, recipes, inventory) |
| PATCH | `/api/prep/lists/:id` | Update prep list (status, approved_by, expected_covers) |
| POST | `/api/prep/items` | Add a prep item to a list |
| PATCH | `/api/prep/items/:id` | Update a prep item (assigned_to, qty, station, notes) |
| PATCH | `/api/prep/items/:id/complete` | Mark item complete with completed_qty |
| DELETE | `/api/prep/items/:id` | Remove a prep item |
| GET | `/api/prep/stations` | List stations for a location |
| POST | `/api/prep/stations` | Create/update station definitions |

### MCP Tool Updates

| Tool | Description |
|------|-------------|
| `prep_generate_list` | Generate prep list from recipes + inventory + expected covers |
| `prep_assign_station` | Assign a cook to a station's tasks |
| `prep_mark_complete` | Mark item(s) complete with actual quantity |
| `prep_check_shortages` | Cross-reference prep needs against current inventory |
| `prep_adjust_quantities` | Recalculate prep quantities based on updated cover forecast |

---

## 6. Frontend Changes

### 6a. Header Enhancements
- Add expected covers display (e.g., "142 covers forecast")
- Add prep list status badge (Generated / In Progress / Completed)
- Add "Generate Prep List" button for AI generation
- Keep existing readiness ring, enhance with time-based context

### 6b. Station Groups (upgrade existing StationGroup component)
- Add assigned cook avatar/initials badge on station header
- Add station progress bar (X of Y complete)
- Add estimated time remaining per station
- Collapsible station groups (expand/collapse)

### 6c. Task Rows (upgrade existing task row rendering)
- Add checkbox for completion (tap to mark done)
- Add quantity display: "Prep 6 qt" with on-hand context "(2 qt on hand)"
- Add time estimate badge (e.g., "~20 min")
- Add recipe link icon (tap to navigate to recipe detail)
- Swipe-to-complete gesture for mobile
- Completed items move to bottom with strikethrough + timestamp

### 6d. New Components
- **PrepListGenerateModal**: Set date, expected covers, confirm AI generation
- **StationAssignmentSheet**: Bottom sheet to assign cooks to stations
- **PrepItemDetail**: Slide-over showing full recipe, quantity breakdown, notes
- **PrepCompletionSummary**: End-of-prep summary showing what was done, waste, time taken

### 6e. Real-time Updates
- Socket.IO events for prep item completion (multi-device sync)
- Live progress updates when another cook marks items complete
- Event: `prep_item_complete`, `prep_list_updated`, `prep_shortage_alert`

---

## 7. AI Integration Points

### 7a. Auto-Generation Logic
The AI prep list generator combines:
1. **Recipe explosion**: For each menu item expected to sell, walk the recipe tree to get raw prep needs
2. **Cover forecast**: Use historical POS data (day-of-week patterns) to estimate covers
3. **On-hand deduction**: Subtract current inventory / yesterday's remaining prep from needed quantities
4. **Par rounding**: Round up to practical batch sizes (you do not prep 2.3 qt of vinaigrette -- you prep 3 qt)
5. **Station assignment**: Default stations from recipe categories or prep_stations table
6. **Time estimation**: Based on recipe complexity, batch size, and historical completion times

### 7b. Shortage Detection
- Cross-reference prep quantities against inventory levels
- Fire `prep_shortage_alert` Socket.IO event when inventory cannot cover prep needs
- Auto-suggest purchase orders for missing items
- Surface shortages as action cards via the existing auto-emit extension

### 7c. Smart Adjustments
- "We just got a 40-top reservation for tonight" -- AI recalculates affected prep items
- "86 the halibut" -- AI removes halibut prep and suggests substitution
- "Move Carlos from grill to pantry" -- AI reassigns tasks and recalculates time estimates

---

## 8. Real-World Prep List References

> Four real prep list formats from the chef's career, saved as reference. Every restaurant does it differently — CarabinerOS must be flexible enough to support all patterns.

**Kama West Loop** (`PREP LIST K.W.L..xlsx`) — Most structured:
- Tabs per person/station: Chef Esteban Master Copy, Cold/Pastry/Expo, Chef Justo, Chef Henry, Chef Trey
- Format: Menu Item → Component → Par Level → Prep Y/N → Amount Needed
- Grouped by dish, then by component. The "master copy" pattern.

**Korean restaurant** (`Prep List .xlsx`) — Task-oriented:
- Columns by dish/station (Saute | Bibimbap | Spicy Calamari | Shared Mise | Banchan)
- Each column lists prep tasks. Cook fills in QTY as they work.

**Maybourne / Alinea R&D** (`Prep Projects Maybourne.xlsx`) — Production-scale:
- Dish → Item → Finished? → Portion → Unit → Total Amount
- Status: Done / Yes / In Progress / Not Done / Sent / Needs Adj / ?
- Massive quantities (500# Short Rib, 2400 portions)

**Celele (Colombia)** (`Ritual X Celele Check List.numbers`) — Bilingual tasting menu:
- Two columns (two courses side by side)
- "In Hand" + "Need To Prep" columns
- Spanish + English on separate sheets

### Common Thread Across All Formats
1. Item name + quantity needed + status (done/not done) — always present
2. Grouping varies: by dish, by station, by project, by course
3. Status is always simple: Done / Not Done / In Progress
4. Par levels in structured versions, absent in creative/event formats
5. The cook already knows what to do — the list is accountability, not instruction

---

## 9. Implementation Phases (Revised — Chef-Approved)

> **Design principle:** Checkboxes for marking items done (tap while walking the line). Chat for everything else (generating lists, assigning people, adjusting quantities). The Kama West Loop format is the default view — grouped by station/dish, par levels, status.
>
> **Key insight from chef:** End-of-service meeting covers tomorrow's needs. Each cook writes their own list based on covers + allergies. CarabinerOS should replicate this: A0 generates the list from covers + recipes + inventory, sous chef reviews, cooks see their station's tasks.

### Phase 1: Data + API Foundation (P0)
1. Alembic migration: add columns to prep_lists/prep_list_items, create prep_stations table
2. Repository functions for PrepList/PrepListItem/PrepStation CRUD
3. New API endpoints: `/api/prep/today`, `/api/prep/lists`, `/api/prep/items/:id/complete`, `/api/prep/stations`
4. New MCP tools: `prep_generate_list`, `prep_mark_complete`, `prep_check_shortages`
5. Pydantic schemas for serialization

### Phase 2: Frontend — Station View + Checkboxes (P0)
6. Upgrade PrepPage to consume `/api/prep/today` — station groups with progress bars
7. **Checkboxes on every item** — tap to mark done, optimistic UI, strikethrough + timestamp
8. Quantity display: "Prep 6 qt" with par context "(par: 8 qt, on hand: 2 qt)"
9. Recipe link on each item — tap to navigate to recipe detail
10. Collapsible station groups, completed items section at bottom
11. **Chat at bottom** — "Generate prep for tonight, 140 covers", "Assign Carlos to grill", "Add 2 batches of stock"

### Phase 3: AI Generation (P1)
12. "Generate Prep List" via chat or button — A0 explodes recipes × expected covers, deducts on-hand inventory, groups by station
13. Shortage detection → action cards ("Low on chicken stock — need 4 qt, only 1 qt on hand")
14. Cover forecast input — manual for now, POS integration later

### Deferred
- Socket.IO real-time multi-device sync — future (nice for kitchen-display mode)
- Smart adjustments ("86 the halibut", "we got a 40-top") — future
- Multi-day prep planning — future
- PDF/print prep sheets — future
- Swipe gestures — future

---

## 10. Dependencies and Risks

### Dependencies
- **Recipes must exist** for AI generation to work. 27 workspace recipes already seeded.
- **Inventory data** for on-hand deduction. Falls back to par-only if inventory not populated.
- **POS data** for cover forecasts. Manual input until Toast/Square MCP connected.

### Risks
- **AI hallucination on quantities**: Generation logic must be deterministic (SQL, not LLM guessing). A0 orchestrates the pipeline but math is hard-coded.
- **Migration**: Keep WorkspacePrep as read cache during transition, deprecate later.

### Real-World Reference Files
- `docs/res/` — copy relevant prep lists here for agent reference during implementation
- Kama West Loop prep list is the primary UI reference (station-grouped, par-based, status tracking)
- [Jolt -- Restaurant Checklists](https://www.jolt.com/lp/restaurant-checklists/)
- [FreshCheq -- How It Works](https://www.freshcheq.com/how-it-works)
