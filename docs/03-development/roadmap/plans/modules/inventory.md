# Inventory Module -- Functional Upgrade Plan

> Research-only document. No code changes.
> Date: 2026-03-24

---

## 1. Current State

The Inventory page (`frontend/src/app/inventory/page.tsx`) is a **read-only dashboard** that displays workspace inventory rows from the `workspace_inventory` table via `GET /api/inventory`.

### What the page does today

- Fetches all `WorkspaceInventory` rows through the `useWorkspace` hook.
- Displays three KPI cards: Total Items, Below Par, Above Par.
- Renders a variance distribution bar (red/grey/green) showing the ratio of below/at/above par items.
- Shows a searchable data table with columns: Item, On Hand, Par, Variance, Last Updated.
- Negative variance renders a destructive badge; positive variance renders green text.
- Empty state prompts the user to ask CarabinerOS to run an inventory count.
- No ability to create, edit, delete, start a count, log waste, or manage par levels from the UI.

### Backend support today

| Layer | What exists |
|---|---|
| **Workspace model** (`WorkspaceInventory`) | `item_name`, `on_hand`, `par`, `unit`, `variance`, `summary`, `detail_points`, `prompt` -- all strings, no FK to `items` table. |
| **Operational models** | `InventoryCount` (header), `InventoryCountLine` (per-item), `ParLevel` (per-item per-day), `WasteLog` (per-item), `Item` (master catalog). |
| **API route** | `GET /api/inventory` -- list only, optional `?location_id` filter. |
| **MCP tools** | `inventory_list`, `inventory_get`, `inventory_create`, `inventory_update`, `inventory_delete` -- CRUD on `WorkspaceInventory`. Also `db_query` and `db_mutate` generic tools. |
| **Pydantic schema** | `InventoryOut` -- mirrors workspace model fields. |

### Key observation

There is a **two-layer gap**: the operational models (`InventoryCount`, `ParLevel`, `WasteLog`) exist in the database schema but have **zero API routes, zero MCP tools, and zero frontend exposure**. The workspace model is a flat summary table that the AI agent populates, with no link back to the operational data.

---

## 2. Competitive Analysis

### MarketMan
- Real-time inventory tracking with live valuation.
- Dynamic PAR ordering -- predicts demand, auto-generates POs when stock dips below par.
- Food waste log with real-time cost of waste (updates with current prices).
- Customizable alerts (stock level, waste, theft) via text/email.
- POS integration for automatic depletion.
- Multi-location dashboard with drill-down.

### BlueCart
- Unlimited count sheets (walk-in, bar, dry storage, etc.) organized by storage area.
- Cross-references counts with orders, deliveries, and upcoming orders.
- Push notifications when stock hits minimum threshold.
- Auto-adds items and updates inventory on delivery check-in.
- Flags gaps between ordered and received quantities.
- Menu costing tied to inventory values.

### Toast (with xtraCHEF)
- Invoice processing and automatic price updates.
- Recipe costing with real-time ingredient costs.
- PMIX-driven variance reports (theoretical vs actual usage).
- Mobile stock counts with barcode scanning.
- Automated purchase orders.
- Multi-location dashboards.

### Lightspeed Restaurant
- Par levels per item with reorder point alerts.
- Notification rules for low stock.
- Real-time depletion as POS sales occur.
- Automatic replenishment on receiving.
- Stock counts with variance tracking.
- Supplier linking per item.

### Craftable
- Connects physical counts to recipes and theoretical usage.
- Spots margin loss before it hits the P&L.
- Auto-catches price discrepancies on invoices.
- 5% average reduction in COGS for customers.
- 50% reduction in inventory count time.
- Purchasing, inventory, AP, and financial reporting unified.

### Optimum Control
- 70+ report types across inventory, purchasing, and sales.
- Par level forecasting based on usage-per-day or sales volume.
- Recipe costing from case to prep/batch to plate.
- Inventory shrinkage tracking with portion-size monitoring.
- POS integration for theoretical depletion.
- Order forecasting with reminders.

---

## 3. Gap Analysis

| Capability | Competitors | CarabinerOS |
|---|---|---|
| **Start/complete inventory count** | All six | Not exposed -- model exists, no UI/API |
| **Count sheets by storage area** | BlueCart, MarketMan, Toast | `storage_area` field on `InventoryCountLine` but unused |
| **Par level management** | All six | `ParLevel` model exists, no UI/API; day-of-week par exists in schema |
| **Waste logging** | MarketMan, Optimum Control, Toast | `WasteLog` model exists, no UI/API |
| **Variance reports (actual vs theoretical)** | Toast/xtraCHEF, Craftable, Optimum Control | Variance shown as a number on the table -- no period-over-period, no theoretical comparison |
| **Low-stock alerts** | All six | No alert system |
| **POS depletion** | MarketMan, Lightspeed, Toast, Optimum Control | No POS integration for depletion |
| **Auto-generate PO from par** | MarketMan, Lightspeed, Optimum Control | `PurchaseOrder` model exists but not linked to par shortfall |
| **Invoice-to-inventory receiving** | Toast/xtraCHEF, Craftable, BlueCart | Invoice model exists but no receiving flow that updates inventory |
| **Item master catalog** | All six | `Item` table exists, not surfaced in inventory UI |
| **Multi-location comparison** | MarketMan, Toast, Lightspeed | Location filter exists, no side-by-side comparison |
| **Mobile count (barcode scan)** | Toast, BlueCart | None |
| **Cost valuation (inventory $)** | All six | `unit_cost` on count line, but no total valuation displayed |
| **Category/storage-area grouping** | All six | No grouping in UI |

---

## 4. Proposed Features (Prioritized)

### P0 -- Core (must-have for usable inventory)

1. **Inventory Count Flow** -- Start a count (full/spot/walk-in), enter quantities per item per storage area, complete the count. This is the bread and butter.
2. **Par Level Management** -- View/edit par levels per item, optionally per day-of-week. Show shortfall (on_hand - par) clearly.
3. **Waste Logging** -- Quick-log waste with reason (spoilage/overproduction/expired), quantity, notes. Running waste total visible on dashboard.
4. **Item Master Integration** -- Link workspace inventory rows to `items` table. Show category, default UOM, last known price.

### P1 -- Operational (high value)

5. **Variance Report** -- Period selector, actual counts vs prior counts, theoretical depletion from sales. Highlight items with biggest dollar variance.
6. **Low-Stock Alerts** -- Items below par generate action cards (using existing action card system). Configurable threshold (e.g., below 80% of par).
7. **Count Sheets by Storage Area** -- Group items by walk-in, dry storage, bar, freezer. Print-friendly view for clipboard counts.
8. **Inventory Valuation** -- Total dollar value of on-hand inventory using `unit_cost` from latest count line or `last_known_price` from items.

### P2 -- Integration (connects to other modules)

9. **Auto-PO from Par Shortfall** -- "Generate Order" button that creates a `PurchaseOrder` for items below par, grouped by vendor.
10. **Receiving Flow** -- When a PO or invoice arrives, update on-hand quantities. Bridge between invoices module and inventory.
11. **Recipe Depletion** -- Theoretical usage based on POS product mix x recipe ingredients. Compare to actual count for shrinkage.

### P3 -- Advanced

12. **Multi-Location Comparison** -- Side-by-side inventory levels across locations.
13. **Trend Charts** -- On-hand and waste trends over time per item/category.
14. **Mobile Count UX** -- Optimized mobile layout for walk-around counting with large tap targets.

---

## 5. Data Model

### Available fields (already in schema)

**`WorkspaceInventory`** (UI-facing flat table):
- `id`, `location_id`, `item_name`, `on_hand` (string), `par` (string), `unit`, `variance` (string), `summary`, `detail_points`, `prompt`

**`InventoryCount`** (operational):
- `id`, `location_id`, `count_date`, `count_type` (full/spot/walk_in), `status` (in_progress/completed)

**`InventoryCountLine`**:
- `id`, `count_id`, `item_id`, `quantity` (Decimal), `unit_cost` (Decimal), `storage_area`

**`ParLevel`**:
- `id`, `location_id`, `item_id`, `min_quantity` (Decimal), `day_of_week` (0-6 or null)

**`WasteLog`**:
- `id`, `location_id`, `item_id`, `quantity` (Decimal), `unit`, `reason` (spoilage/overproduction/expired), `notes`, `waste_date`

**`Item`** (master):
- `id`, `name`, `category`, `default_uom_id`, `gl_account_id`, `last_known_price`

### Missing fields (to add)

| Model | Field | Type | Purpose |
|---|---|---|---|
| `WorkspaceInventory` | `item_id` | UUID FK to `items` | Link to master catalog |
| `WorkspaceInventory` | `category` | String(100) | Item category for grouping/filtering |
| `WorkspaceInventory` | `storage_area` | String(100) | Walk-in, dry storage, bar, freezer |
| `WorkspaceInventory` | `unit_cost` | String(50) | Current cost per unit for valuation |
| `WorkspaceInventory` | `last_count_id` | UUID FK to `inventory_counts` | Link to most recent count |
| `InventoryCount` | `counted_by` | String(100) | Who performed the count |
| `InventoryCount` | `notes` | Text | Count-level notes |
| `InventoryCountLine` | `expected_quantity` | Decimal(12,4) | Par or prior count for variance calc |
| `WasteLog` | `estimated_cost` | Decimal(12,2) | Dollar value of waste |
| `ParLevel` | `max_quantity` | Decimal(12,4) | Upper bound for overstock alerts |
| `Item` | `storage_area` | String(100) | Default storage area for count sheets |
| `Item` | `is_active` | Boolean | Soft-delete/archive items |

---

## 6. MCP Tools

### Existing (operate on `WorkspaceInventory`)

| Tool | Description |
|---|---|
| `inventory_list` | List all workspace inventory rows |
| `inventory_get` | Get single row by UUID |
| `inventory_create` | Create workspace inventory row |
| `inventory_update` | Update workspace inventory row |
| `inventory_delete` | Delete workspace inventory row |
| `db_query(module="inventory")` | Generic query with filters |
| `db_mutate(module="inventory")` | Generic create/update/delete |

### Needed

| Tool | Description |
|---|---|
| `inventory_count_start` | Create an `InventoryCount` header (count_type, location_id) and return a count sheet (items grouped by storage area with par levels pre-filled) |
| `inventory_count_submit` | Receive line items for a count, create `InventoryCountLine` rows, update `WorkspaceInventory` on_hand/variance, mark count completed |
| `inventory_count_list` | List past inventory counts with summary stats |
| `par_level_set` | Create/update `ParLevel` for an item at a location (with optional day_of_week) |
| `par_level_list` | List par levels for a location, showing current on_hand vs par |
| `waste_log_create` | Create a `WasteLog` entry |
| `waste_log_list` | List waste logs with date range filter, total cost |
| `inventory_variance_report` | Compare two counts or a count vs theoretical (from POS mix), return item-level variance with dollar impact |
| `inventory_valuation` | Sum (on_hand * unit_cost) across all items for a location |
| `inventory_alerts` | Return items below par threshold, suitable for action card generation |

---

## 7. API Routes

### Existing

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory` | List `WorkspaceInventory` rows |

### Needed

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/inventory/counts` | List inventory counts (with line count, status) |
| `POST` | `/api/inventory/counts` | Start a new count |
| `GET` | `/api/inventory/counts/:id` | Get count detail with all lines |
| `PUT` | `/api/inventory/counts/:id` | Submit/update count lines, complete count |
| `GET` | `/api/inventory/par-levels` | List par levels for location |
| `PUT` | `/api/inventory/par-levels` | Bulk update par levels |
| `GET` | `/api/inventory/waste` | List waste logs (date range filter) |
| `POST` | `/api/inventory/waste` | Log a waste entry |
| `GET` | `/api/inventory/variance` | Variance report (query params: count_id, compare_to, date_range) |
| `GET` | `/api/inventory/valuation` | Current inventory dollar value |
| `GET` | `/api/inventory/alerts` | Items below par with shortfall amounts |
| `GET` | `/api/items` | Item master catalog (shared across modules) |
| `POST` | `/api/items` | Create a new item |
| `PUT` | `/api/items/:id` | Update an item |

---

## 8. UI Components

### Page Layout (tabbed sections within the inventory page)

```
+---------------------------------------------------------------+
| [Package icon] Inventory                    [Search] [+ Count] |
| Stock levels & par management                                  |
+---------------------------------------------------------------+
| [Overview] [Counts] [Par Levels] [Waste] [Variance]           |
+---------------------------------------------------------------+
```

### Tab: Overview (current page, enhanced)

- **KPI Row**: Total Items | Below Par | Above Par | Inventory Value ($)
- **Variance Bar**: existing, keep as-is
- **Alert Banner**: if items below par, show count + "Start Count" CTA
- **Data Table**: add columns for Category, Storage Area, Unit Cost
- **Row actions**: Quick-edit on_hand, log waste, view history
- **Filters**: category dropdown, storage area dropdown, status (below/at/above par)

### Tab: Counts

- **Count History Table**: date, type, status, item count, counted_by, total value
- **Start Count Button**: opens modal to select count_type and storage area filter
- **Active Count View**: checklist of items grouped by storage area, quantity input per item, running total, complete button
- **Count Detail**: click a past count to see all lines with variance from prior count

### Tab: Par Levels

- **Par Level Table**: item, current on_hand, par level, shortfall, day-of-week selector
- **Bulk Edit Mode**: inline editing of par quantities
- **Generate Order Button**: creates PO from items below par (links to orders module)
- **Visual indicators**: red for significant shortfall, yellow for approaching par

### Tab: Waste

- **Waste Log Table**: date, item, quantity, reason, estimated cost, notes
- **Quick Log Form**: inline form at top -- select item, enter qty, select reason, add notes
- **KPI Cards**: Total Waste (week), Total Waste ($), Top Waste Item, Waste Trend (up/down arrow)
- **Date range filter**: today, this week, this period, custom

### Tab: Variance

- **Period Selector**: compare two date ranges or two specific counts
- **Variance Table**: item, expected (theoretical or prior count), actual, variance qty, variance $, variance %
- **Sort by biggest dollar impact**
- **Highlight anomalies**: items with variance > configurable threshold
- **Export**: CSV download for accounting

### Shared Components (new)

| Component | Purpose |
|---|---|
| `inventory-count-modal.tsx` | Start new count flow |
| `inventory-count-sheet.tsx` | Active count entry form |
| `par-level-editor.tsx` | Inline par level editing |
| `waste-log-form.tsx` | Quick waste entry |
| `variance-report.tsx` | Period comparison table |
| `inventory-tabs.tsx` | Tab navigation wrapper |
| `storage-area-filter.tsx` | Dropdown filter for storage areas |
| `item-picker.tsx` | Searchable item selector (reusable) |

---

## 9. Implementation Plan (Revised — Chef-Approved)

> **Design principle:** Same as Orders — **chat-first**. Tabs display data; the inline chat modifies it. No form-heavy count sheets. Two operational modes serve different restaurant types.
>
> **Two modes:**
> 1. **Budget Tracking** (Roister pattern) — daily spend by vendor against weekly budget, cost % vs revenue. For conceptual/high-budget restaurants that track dollars, not items.
> 2. **Item Counts** (industry standard) — par levels, item-by-item counts, variance, shrinkage. For cost-conscious restaurants watching every tomato.
>
> Both feed the same weekly food cost %. Different inputs, same output.
>
> **Real-world reference:** `docs/res/roister-budget-checkbook-reference.xlsx` — 153 weeks of actual cost tracking at Roister (Michelin, Chicago). Columns = vendors, rows = days, bottom = budget/spend/revenue/cost%.

### Phase 1: Overview + Chat Interface (P0)
1. **Enhance Overview tab** — keep current KPI cards + table, add category/storage area grouping, add inventory valuation KPI
2. **Inline chat on inventory page** — same pattern as orders. User can say:
   - "Walk-in count: 3 cases tomatoes, 2 cases avocados, half case lemons"
   - "Set avocado par to 4 cases"
   - "Waste 3 lbs spinach, wilted"
   - "What am I low on?"
   - A0 handles all mutations via MCP tools
3. **Backend foundation** — migration for missing fields, repository functions for InventoryCount/ParLevel/WasteLog, API routes, MCP tools, Pydantic schemas
4. **Tabs structure** — Overview (current + enhanced), Counts, Par Levels, Waste. All read-only display; all edits through chat.

### Phase 2: Count Flow + Par Levels + Waste (P0)
5. **Counts tab** — count history table (date, type, status, item count, value). "Start Count" button sets context for chat ("Starting walk-in count..." then user talks through items)
6. **Par Levels tab** — table showing item, on-hand, par, shortfall. Edits via chat. "Generate Order" button creates a draft PO for items below par (links to orders module)
7. **Waste tab** — waste log table with date range filter, KPI cards (total waste $, top waste item). Logging via chat: "Waste 2 lbs salmon, overcooked"
8. **Low-stock alerts** — items below par emit action cards automatically

### Phase 3: Budget Tracking Mode (P1)
9. **Weekly budget view** — the Roister spreadsheet pattern: vendors as columns, days as rows, daily spend per vendor, weekly totals, budget vs actual, cost %
10. **Revenue input** — daily food revenue entry (or pulled from POS integration when available)
11. **Carryover tracking** — items carrying over to next week vs items discarded
12. **This is the food-cost bridge** — budget tracking feeds directly into the food cost module

### Deferred
- Variance reports (actual vs theoretical) — needs POS integration
- Multi-location comparison — needs multiple locations in use
- Mobile count UX — responsive improvements later
- Cross-module integration (auto-PO, receiving, recipe depletion) — after all modules functional

---

## 10. Files to Modify

### Backend

| File | Changes |
|---|---|
| `carabiner/db/models.py` | Add missing columns to `InventoryCount`, `Item` |
| `carabiner/db/workspace_models.py` | Add `item_id`, `category`, `storage_area`, `unit_cost`, `last_count_id` to `WorkspaceInventory` |
| `carabiner/db/migrations/` | New Alembic migration for schema changes |
| `carabiner/db/repositories.py` | Repository functions for counts, par levels, waste logs, valuation |
| `carabiner/api/flask_blueprint.py` | New routes: counts, par-levels, waste, valuation, alerts, items |
| `carabiner/api/schemas.py` | New schemas: CountOut, ParLevelOut, WasteLogOut, ValuationOut, ItemOut |
| `carabiner/mcp/server.py` | New tools: inventory_count_start/submit/list, par_level_set/list, waste_log_create/list, inventory_valuation, inventory_alerts |

### Frontend

| File | Changes |
|---|---|
| `frontend/src/app/inventory/page.tsx` | Refactor to tabbed layout with inline chat, enhanced KPIs |
| `frontend/src/app/inventory/components/` | `inventory-tabs.tsx`, `count-history.tsx`, `par-level-table.tsx`, `waste-log-table.tsx`, `budget-tracker.tsx`, `inventory-chat.tsx` |
| `frontend/src/lib/types.ts` | New types: InventoryCount, CountLine, ParLevel, WasteLogEntry |

### Notes
- Chat-first: tabs show data, chat modifies it. No inline editing forms.
- Budget tracking mode is a unique differentiator — no competitor has this pattern.
- Reference spreadsheet: `docs/res/roister-budget-checkbook-reference.xlsx`
