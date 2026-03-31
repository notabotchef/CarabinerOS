# Food Cost Module -- Functional Upgrade Plan

> Research-only plan. No code changes. Written 2026-03-24.

---

## 1. Current State

### Frontend (`frontend/src/app/food-cost/page.tsx`)

The page is a single flat component that shows:
- **3 KPI cards**: Overall Food Cost %, Items Above 30% Target, High Pressure Items
- **Filter tabs**: All / High / Medium / Low (by pressure level)
- **Data table**: Menu Item, Cost %, Pressure badge, Action text

The data source is `useWorkspace<FoodCostItem>("/api/food-cost")` which fetches from the `WorkspaceFoodCost` table. The page has no date selector, no trend visualization, no drill-down, no category breakdown, and no budget comparison. It is essentially a static list of per-item pressure flags.

### Backend

**WorkspaceFoodCost** (workspace_models.py) -- UI-facing table:
- Fields: `menu_item_name`, `pressure`, `current_cost_pct`, `action`, `summary`, `detail_points`, `prompt`
- This is a flat "summary card" model with string-typed cost percentage. No date dimension, no category, no dollar amounts.

**DailyFoodCost** (models.py) -- Operational table:
- Fields: `cost_date`, `beginning_inventory`, `purchases`, `ending_inventory`, `actual_food_cost`, `theoretical_food_cost`, `sales`, `food_cost_pct`
- Proper accounting model with the standard COGS formula: `beginning_inventory + purchases - ending_inventory = actual_food_cost`
- Has `theoretical_food_cost` for AvT variance analysis
- Unique per `(location_id, cost_date)` -- one row per day per location

**Supporting models already in the DB**:
- `DailyPL` -- daily P&L with `cogs`, `revenue`, `food_cost_pct`, `labor_cost`, `labor_pct`
- `BudgetPeriod` -- `target_food_cost_pct`, `target_labor_pct`, `target_revenue` per date range
- `PosSales` -- daily `total_sales`, `food_sales`, `beverage_sales`, `guest_count`
- `PosProductMix` -- per-item `quantity_sold`, `revenue` per day
- `PriceAlert` -- item-level price change tracking (`previous_price`, `new_price`, `pct_change`)
- `WasteLog` -- per-item waste with `reason` (spoilage/overproduction/expired) and dollar value
- `MenuItem` -- links to `Recipe` with `price`
- `Recipe` + `RecipeIngredient` -- full recipe costing tree with sub-recipes
- `Item` -- `last_known_price`, `category`
- `InvoiceLineItem` -- purchase history per item

**API layer** (`flask_blueprint.py`):
- `GET /api/food-cost` -- returns flat list from `WorkspaceFoodCost`
- `GET /api/reporting/daily-pl` -- returns last 90 days of DailyPL rows
- No endpoint for DailyFoodCost, PriceAlert, WasteLog, BudgetPeriod, or product-mix data

**MCP tools** (`carabiner/mcp/server.py`):
- CRUD for `food_cost` (WorkspaceFoodCost): `list_food_cost`, `get_food_cost`, `create_food_cost`, `update_food_cost`, `delete_food_cost`
- Generic `workspace_list` / `workspace_create` / `workspace_update` / `workspace_delete` tools
- No tools that query DailyFoodCost, compute AvT variance, or calculate plate costs

### Gap Summary

The page shows per-item "pressure" labels but has none of the data an owner actually needs: daily food cost tracking over time, actual vs. theoretical variance, category breakdowns, budget vs. actual, waste impact, plate-level profitability, or prime cost visibility. The operational tables (`DailyFoodCost`, `DailyPL`, `BudgetPeriod`, `WasteLog`, `PosProductMix`) exist in the DB but are not surfaced to the frontend.

---

## 2. Competitive Landscape

### xtraCHEF (Toast)
- Automated invoice processing feeds real-time food cost
- Actual vs. theoretical variance with PMIX integration
- Weekly food cost ratios by category down to invoice-level detail
- Price tracking with vendor comparison
- 8-12% food cost variance reduction reported within 60 days

### Restaurant365
- Real-time P&L with intraday polling
- Prime cost (food + labor) as a first-class metric
- Budget vs. actual reporting at the period level
- 70+ report types; deep GL integration
- Multi-location roll-up dashboards

### Craftable (formerly BevSpot)
- Real-time actual vs. theoretical with POS integration
- 3-way invoice auto-match with variance alerts
- Combined food cost, labor, and purchasing in one dashboard
- Trim yield and waste tracking baked into recipe costing

### MarginEdge
- Daily P&L updated in real-time from invoices + POS sales
- Theoretical usage reports from PMIX data
- Menu analysis comparing items within categories for profitability
- Price tracking with real-time ingredient cost updates
- Invoice processing within 24-48 hours

### Galley Solutions
- Recipe-first approach: connect vendors for real-time recipe costing
- Trim yield calculations automatically factored into costs
- Instant margin impact preview when editing recipes
- Strong for commissary and multi-unit production environments

### Optimum Control
- 70+ report types including actual vs. ideal per recipe
- Budget variance reporting in Excel/PDF/Word
- Par-level-driven ordering based on sales trends
- Multi-location visibility with cross-location reporting

### Common Patterns Across All Competitors

1. **Daily food cost %** as the hero metric (not weekly or monthly)
2. **Actual vs. Theoretical** variance as the core analysis tool
3. **Category breakdowns** (proteins, produce, dairy, dry goods)
4. **Budget/target comparison** with visual over/under indicators
5. **Price change alerts** surfaced inline with cost data
6. **Trend lines** over 7/14/30/90 day windows
7. **Drill-down**: period > category > item > invoice
8. **Prime cost** (food + labor) as a composite KPI
9. **Waste impact** quantified in dollars and as % of COGS

---

## 3. Target UX (Proposed Layout)

### Header Bar
- Module icon + "Food Cost" title
- Date range selector: Today / This Week / This Period / Custom
- Location picker (when multi-location)

### Hero KPI Strip (4 cards)
| Card | Source | Color Logic |
|------|--------|-------------|
| **Today's Food Cost %** | DailyFoodCost.food_cost_pct | Red if > target, green if under |
| **Period-to-Date Food Cost %** | Avg of DailyFoodCost rows in BudgetPeriod | Red/green vs. target |
| **AvT Variance** | actual_food_cost - theoretical_food_cost | Red if positive (over), green if negative |
| **Prime Cost %** | (food_cost_pct + labor_pct) from DailyPL | Red if > 60%, amber 55-60%, green < 55% |

### Trend Chart (Spark Area)
- 30-day line chart of daily `food_cost_pct`
- Horizontal dashed line for `BudgetPeriod.target_food_cost_pct`
- Shaded band showing target +/- 2pt tolerance
- Tooltip on hover: date, actual %, theoretical %, variance

### Category Breakdown (Horizontal Stacked Bar or Donut)
- Derived from `InvoiceLineItem` joined to `Item.category` for the period
- Categories: Proteins, Produce, Dairy, Dry Goods, Beverages, Paper/Chem, Other
- Each bar shows: $ amount, % of total purchases, vs. prior period delta

### Variance Drivers Table (replaces current table)
| Column | Source |
|--------|--------|
| Item / Category | Item.name, Item.category |
| Theoretical Usage $ | PosProductMix qty * recipe cost |
| Actual Usage $ | Beginning + Purchases - Ending per item |
| Variance $ | Actual - Theoretical |
| Variance % | Variance / Theoretical |
| Top Cause | Heuristic: price increase / waste / over-portioning |

Sorted by variance $ descending (biggest bleeders first). Expandable rows show:
- Recent price changes (PriceAlert)
- Waste logged (WasteLog)
- Purchase history trend

### Price Alerts Strip
- Horizontal scrollable chip list of recent PriceAlerts
- Each chip: item name, +X.X% change, vendor name
- Tap to see history

### Budget vs. Actual Card
- Side-by-side bars: Budget target % vs. actual period-to-date %
- Shows $ over/under budget
- Links to BudgetPeriod settings

---

## 4. Data Model Changes

### New columns on existing tables

None required. The operational tables already have the necessary fields. The upgrade is about *querying and surfacing* data that already exists.

### New models (if needed)

**FoodCostCategorySnapshot** (optional, for performance):
```
- id, location_id, cost_date
- category (String)
- purchase_total (Numeric)
- theoretical_usage (Numeric)
- actual_usage (Numeric)
- variance (Numeric)
```
This could be a materialized view or a nightly-computed summary table. Alternatively, compute on-the-fly from InvoiceLineItem + PosProductMix joins if data volume is small (likely < 1000 rows per location per month).

### WorkspaceFoodCost evolution

The existing `WorkspaceFoodCost` model can remain as-is for the agent to write AI-generated pressure summaries. The new frontend views will read from the operational tables directly. The two systems coexist: operational data for charts/tables, workspace data for AI commentary.

---

## 5. API Endpoints (New)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/food-cost/daily` | DailyFoodCost rows for date range. Params: `start`, `end`, `location_id` |
| GET | `/api/food-cost/summary` | Computed KPIs: today's %, period %, AvT variance, prime cost. Params: `location_id` |
| GET | `/api/food-cost/categories` | Category breakdown for date range. Joins InvoiceLineItem + Item. Params: `start`, `end`, `location_id` |
| GET | `/api/food-cost/variance` | Top variance drivers. Joins DailyFoodCost + PosProductMix + Recipe. Params: `start`, `end`, `location_id`, `limit` |
| GET | `/api/food-cost/price-alerts` | Recent PriceAlerts. Params: `location_id`, `days` (default 30) |
| GET | `/api/food-cost/budget` | Current BudgetPeriod + actual-to-date. Params: `location_id` |

All endpoints return `{"ok": true, "data": ...}` / `{"ok": false, "error": "..."}` per project convention. All are GET-only, registered on the Flask blueprint.

---

## 6. Frontend Components

### New files

| File | Purpose |
|------|---------|
| `app/food-cost/page.tsx` | Rewrite: layout shell, date selector, location picker, orchestrates sub-components |
| `app/food-cost/_components/kpi-strip.tsx` | 4 hero KPI cards with loading skeletons |
| `app/food-cost/_components/trend-chart.tsx` | 30-day food cost % line chart with target line |
| `app/food-cost/_components/category-breakdown.tsx` | Horizontal bar or donut chart of purchase categories |
| `app/food-cost/_components/variance-table.tsx` | Sortable table of top variance drivers with expandable rows |
| `app/food-cost/_components/price-alerts.tsx` | Horizontal scrollable chip strip |
| `app/food-cost/_components/budget-card.tsx` | Budget vs. actual comparison |

### Charting library

Use lightweight inline SVG or a minimal library already in the project. Check if recharts or similar is already a dependency. If not, Framer Motion can animate simple SVG paths for the trend sparkline. Avoid adding a heavy charting dependency.

### State management

- Each sub-component uses its own `useWorkspace` or `useSWR` hook with the appropriate endpoint
- Date range state lives in the page component, passed down as props
- No global store needed; URL search params can persist date range for shareability

---

## 7. MCP Tool Additions

New tools for the AI agent to query food cost data intelligently:

| Tool | Description |
|------|-------------|
| `daily_food_cost_list` | Query DailyFoodCost with date range and location filter |
| `food_cost_summary` | Compute today's %, period %, variance, prime cost for a location |
| `food_cost_variance_drivers` | Return top N items by variance $ for a date range |
| `price_alerts_list` | Recent price alerts with item and vendor details |
| `category_cost_breakdown` | Purchase totals by item category for a date range |

These enable the agent to answer questions like "Why is my food cost high this week?" by querying variance drivers and price alerts, then writing a natural language explanation into the WorkspaceFoodCost pressure cards.

---

## 8. Implementation Phases (Revised — Chef-Approved)

> **Design principle:** This page answers one question: "Am I making money or losing money?" Five numbers — same as the Roister budget spreadsheet. Chat for entry and questions.
>
> **Real-world context from chef:** At Roister, cost tracking was manual daily entry — item by item, vendor by vendor, into an Excel sheet. Revenue came from POS. Budget was $14K/week. The five numbers that mattered: Budget, Total Spend, Over/Under, Revenue, Cost %.
>
> **Two data paths:**
> 1. **Manual entry via chat** (day 1): "Today's spend: Sysco $2,100, CW $850. Revenue $8,200." A0 creates DailyFoodCost row.
> 2. **Auto-populated from invoices** (when invoice module works): invoice totals flow into daily vendor spend automatically. Revenue from POS integration (future).
>
> **Reference:** `docs/res/roister-budget-checkbook-reference.xlsx` — 153 weeks of real daily cost tracking.

### Phase 1: Hero KPIs + Budget View + Chat (P0)
1. New API endpoints: `/api/food-cost/daily`, `/api/food-cost/summary`, `/api/food-cost/budget`
2. **Hero KPI strip** — 4 cards:
   - Today's Food Cost % (red if > target, green if under)
   - Period-to-Date Food Cost %
   - Budget vs Actual (the -$2,834 number)
   - Prime Cost % (food + labor from DailyPL)
3. **30-day trend line** — daily food_cost_pct with target line (Recharts, already in project)
4. **Budget card** — weekly budget, total spend, remaining, over/under. The Roister spreadsheet view.
5. **Chat at bottom** — all entry and queries:
   - "Today's spend: Sysco $2,100, CW $850, Fortune $420"
   - "Revenue today was $8,200"
   - "Why is food cost up this week?"
   - "What did we spend on proteins this month?"
   - "Set my food cost target to 30%"
6. New MCP tools: `daily_food_cost_list`, `food_cost_summary`, `food_cost_create_daily` (for manual entry)
7. Keep existing pressure table below as AI commentary section

### Phase 2: Category Breakdown + Price Alerts (P1)
8. Category breakdown chart — from InvoiceLineItem joined to Item.category
9. Price alert strip — recent price changes from PriceAlert table
10. Date range selector in header
11. `/api/food-cost/categories`, `/api/food-cost/price-alerts` endpoints

### Phase 3: Variance Analysis (P2 — needs POS + recipes)
12. Actual vs Theoretical variance (needs PosProductMix + complete recipe costs)
13. Variance drivers table — top items by dollar variance
14. Drill-down: price changes, waste logged, purchase history per item

### Deferred
- AvT variance — needs POS integration (Toast/Square MCP)
- Item-level drill-down — needs complete invoice→item linking
- Multi-location roll-up — after multi-location is real
- Beverage cost separate view — single combined for v1

---

## 9. Open Questions (Resolved)

1. **Manual entry:** Yes, via chat. "Today's spend: Sysco $2,100, CW $850." A0 creates DailyFoodCost row. This is the day-1 path before invoice automation exists.
2. **Multi-location:** Require location pick for now.
3. **Period:** Follow BudgetPeriod boundaries, default to calendar month.
4. **Beverage:** Combined view for v1.
5. **Thresholds:** BudgetPeriod.target_food_cost_pct, overridable via chat.

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| "What's my food cost today?" | < 3 seconds (page load to KPI) |
| Daily data entry via chat | Under 30 seconds for full day's spend |
| Budget vs actual always visible | On the page, no drill-down needed |
| 30-day trend visible | At a glance, without scrolling |
| Auto-populated from invoices | When invoice module is live, daily spend fills itself |
