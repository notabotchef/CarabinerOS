# Menu Engineering Module -- Functional Upgrade Plan

Created: 2026-03-24
Status: Research complete, ready for implementation

---

## 1. Current State Assessment

### Frontend (`frontend/src/app/menu/page.tsx`)
- Read-only page displaying menu items fetched from `GET /api/menu`
- BCG matrix KPI cards (Star / Puzzle / Plowhorse / Dog counts)
- Category filter tabs: All, Appetizer, Entree, Dessert, Beverage
- Data table with columns: Item Name, Category, Performance badge, Margin %, Recommendation
- Uses `useWorkspace<MenuItem>` hook -- no create/update/delete capability
- Empty state acknowledges "Items will appear here once added"
- No item detail/expand view, no inline editing, no 86 status, no pricing data shown

### Backend Data Layer
**WorkspaceMenu** (workspace_models.py -- serves the UI):
- Fields: `id`, `location_id`, `item_name`, `category`, `performance`, `margin_pct`, `recommendation`, `recipe` (JSONB), `recipe_id` (FK to workspace_recipes), `summary`, `detail_points`, `prompt`
- Missing: `price`, `food_cost`, `is_active/is_86`, `popularity_rank`, `quantity_sold`, `contribution_margin`, `menu_section`, `seasonal_flag`, `available_start/end`

**MenuItem** (models.py -- operational):
- Fields: `id`, `location_id`, `recipe_id` (FK to recipes), `display_name`, `section`, `price`, `is_active`
- Missing: `food_cost_per_serving`, `contribution_margin`, `popularity_score`, `performance_quadrant`, `is_86`, `86_reason`, `86_at`

**MCP Tools** (server.py):
- Full CRUD: `menu_list`, `menu_get`, `menu_create`, `menu_update`, `menu_delete`
- Also available via generic `workspace_action(module="menu", action="create|update|delete")`
- No bulk operations, no 86 toggle, no price-change simulation

**API** (flask_blueprint.py):
- `GET /api/menu` -- read-only list, optional `?location_id=` filter
- No POST/PUT/DELETE routes (all writes go through MCP tools via the agent)

**Pydantic Schema** (schemas.py -- `MenuOut`):
- Serializes: id, location_id, item_name, category, performance, margin_pct, recommendation, recipe, recipe_id, summary, detail_points, prompt

### Related Tables Already in Place
- `PosProductMix` -- per-item daily sales data (quantity_sold, revenue) linked to menu_items
- `DailyFoodCost` -- actual vs theoretical food cost with food_cost_pct
- `WorkspaceRecipe` -- Modernist-format recipes with components, ingredients, steps, total_cost, cost_per_serving
- `WorkspaceFoodCost` -- pressure/action tracking per menu item

---

## 2. Competitive Landscape

### Toast POS Menu Management
- Centralized menu dashboard for multi-location; changes auto-sync to online ordering
- Real-time sales analytics: dish popularity, peak hours, covers
- Modifier complexity (size-dependent pricing)
- Menu quadrant reports inherited from their menu engineering blog content
- **Gap vs CarabinerOS**: Toast is POS-first; no AI-driven recommendations, no contribution margin visualization

### Apicbase
- Recipe-to-menu cost pipeline: ingredient price changes ripple to recipe costs to menu margins instantly
- Theoretical vs actual food cost variance reports
- Allergen, nutritional, and carbon footprint labeling per item
- Live menu matrix from POS integration with actual sales + food costs
- **Gap vs CarabinerOS**: Apicbase has deep supplier-price integration we lack; but no AI agent layer

### Lightspeed/Upserve
- "Menu Intelligence" feature: quadrant report classifying items as Stars/Puzzles/Plowhorses/Dogs
- Guest behavior analytics via payment data (return visits, spend patterns, item preferences)
- Real-time food costing integrated with inventory
- **Gap vs CarabinerOS**: Strong analytics but no conversational interface; no agent-generated recommendations

### MenuDrive
- Online ordering platform with built-in menu management
- Drag-and-drop menu builder, analytics on which items to promote
- Email/loyalty marketing tied to menu items
- **Gap vs CarabinerOS**: Consumer ordering focused, not BOH operations

### Pricing Solutions (MenuPriceOptimizer)
- AI-driven price optimization using demand elasticity modeling
- Simulates price changes before going live (impact on traffic + margin)
- Claims 2%+ bottom-line improvement across 30,000+ units
- **Gap vs CarabinerOS**: Pure pricing tool, no kitchen operations or recipe linkage

### CrunchTime / Datassential
- LTO lifecycle management: launch, track daily, adjust in real-time, teardown
- Execution compliance across locations (signage, stock, training)
- "Launches & Ratings" analytics for new item performance
- **Gap vs CarabinerOS**: Enterprise-only, no single-location story

### Key Differentiator for CarabinerOS
None of these competitors combine: (a) menu engineering matrix, (b) live recipe-linked food costing, (c) AI agent that proactively recommends actions, (d) real-time 86 board, and (e) price-change impact modeling -- all in one screen with a conversational interface. That is the target.

---

## 3. Menu Engineering Matrix -- Core Methodology

The BCG-derived menu engineering matrix plots every item on two axes:

| Axis | Metric | How to Calculate |
|---|---|---|
| **X -- Popularity** | Menu Mix % | `(qty sold of item / total qty sold) * 100`. Threshold: item is "popular" if its mix % >= `1 / N * 0.7` where N = number of items (the 70% rule). |
| **Y -- Profitability** | Contribution Margin | `menu_price - food_cost_per_serving`. Threshold: item is "profitable" if its CM >= the weighted average CM of all items. |

### Quadrant Classification

| Quadrant | Popularity | Profitability | GM Action |
|---|---|---|---|
| **Star** | High | High | Protect and feature prominently. Do not change recipe or price. |
| **Puzzle** | Low | High | Reposition on menu, rename, retrain servers to upsell, add description. |
| **Plowhorse** | Low margin | High volume | Re-engineer recipe to reduce cost, raise price cautiously, reduce portion. |
| **Dog** | Low | Low | Remove, replace with new item, or hide deep in menu. Seasonal rotation candidate. |

### Recalculation Cadence
- **Daily**: If POS product-mix data is flowing (via `PosProductMix` table)
- **Weekly**: If manual or batch import
- **On demand**: When agent runs analysis or user triggers from the UI

---

## 4. Data Model Changes

### WorkspaceMenu -- Add Columns

```
price              Numeric(10,2)   -- menu selling price
food_cost          Numeric(10,2)   -- cost to produce (from linked recipe or manual)
contribution_margin Numeric(10,2)  -- price minus food_cost (computed or stored)
food_cost_pct      Numeric(6,2)    -- (food_cost / price) * 100
quantity_sold      Integer          -- rolling period qty (default 30 days)
menu_mix_pct       Numeric(6,2)    -- item's share of total quantity sold
popularity_rank    Integer          -- 1 = most popular
is_86              Boolean          -- currently unavailable
eighty_six_reason  String(200)     -- why (ran out, supplier issue, quality)
eighty_six_at      DateTime(tz)    -- when it was 86'd
is_seasonal        Boolean          -- seasonal / LTO flag
available_start    Date            -- seasonal availability window start
available_end      Date            -- seasonal availability window end
menu_position      Integer          -- sort order within section for menu layout
```

### MenuItem (operational) -- Add Columns

```
food_cost_per_serving  Numeric(10,2)  -- pulled from recipe.cost_per_serving
contribution_margin    Numeric(10,2)  -- price - food_cost_per_serving
is_86                  Boolean
eighty_six_reason      String(200)
eighty_six_at          DateTime(tz)
```

### New Table: MenuItemHistory

Track price and cost changes over time for trend analysis and audit.

```
id                 UUID PK
menu_item_id       UUID FK -> workspace_menu.id
field_changed      String(50)    -- 'price', 'food_cost', 'performance'
old_value          String(100)
new_value          String(100)
changed_at         DateTime(tz)
changed_by         String(100)   -- 'agent', 'user', 'system'
```

### New Table: EightySixLog

Track 86/un-86 events for pattern analysis.

```
id                 UUID PK
menu_item_id       UUID FK -> workspace_menu.id
location_id        UUID FK
action             String(10)    -- '86' or '68' (back on)
reason             String(200)
logged_at          DateTime(tz)
resolved_at        DateTime(tz)  -- when item came back
```

---

## 5. API Endpoints

### New Routes (flask_blueprint.py)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/menu` | List all items (exists, enhance with new fields) |
| `GET` | `/api/menu/:id` | Single item detail with recipe, history, sales data |
| `GET` | `/api/menu/matrix` | Aggregated matrix data: counts per quadrant, avg CM, thresholds |
| `GET` | `/api/menu/86-board` | All currently-86'd items across locations |
| `GET` | `/api/menu/:id/history` | Price/cost change history for one item |
| `GET` | `/api/menu/price-simulation?item_id=X&new_price=Y` | What-if: show projected margin, food cost %, quadrant shift |

Write operations continue to flow through MCP tools (the agent handles mutations). No direct POST/PUT/DELETE on the blueprint -- this preserves the agent-mediated architecture.

### New MCP Tools

| Tool | Description |
|---|---|
| `menu_86` | Mark item as 86'd with reason. Emits action card to notify FOH. |
| `menu_un86` | Restore item (68). Emits action card. |
| `menu_bulk_update` | Update multiple items (e.g., batch price increase for a section). |
| `menu_recalculate_matrix` | Trigger matrix recalculation from current PosProductMix + recipe costs. |
| `menu_price_simulate` | Given item + proposed price, return projected CM, food cost %, quadrant. |
| `menu_seasonal_toggle` | Activate/deactivate seasonal items with date window. |

---

## 6. Frontend Components

### Page Layout (Revised)

```
+----------------------------------------------------------+
| Header: "Menu Engineering"  |  [86 Board (n)]  [+ Add]  |
| [All] [Appetizer] [Entree] [Dessert] [Beverage] [86'd]  |
+----------------------------------------------------------+
| KPI Row: 4 quadrant cards (Star/Puzzle/Plowhorse/Dog)    |
|   + Avg Food Cost %  |  Avg CM  |  Total Revenue (30d)   |
+----------------------------------------------------------+
| View Toggle: [Matrix View] [Table View] [Card View]      |
+----------------------------------------------------------+
| MAIN CONTENT AREA (varies by view)                       |
+----------------------------------------------------------+
```

### View Modes

**Matrix View** (new, default):
- Scatter plot with X = menu mix %, Y = contribution margin
- Each dot = menu item, sized by revenue, colored by quadrant
- Quadrant threshold lines drawn at weighted avg CM and 70% popularity rule
- Hover shows item name, price, food cost %, CM, qty sold
- Click opens item detail sheet

**Table View** (enhanced current):
- Add columns: Price, Food Cost, CM, Qty Sold (30d), Food Cost %
- Sortable columns
- Inline quick-actions: 86 toggle, expand to detail
- Row color coding by quadrant (subtle background)

**Card View** (new):
- Grid of item cards grouped by quadrant
- Each card: item name, price, CM, food cost %, mini sparkline (30d sales trend)
- Drag to reorder menu position within section

### Item Detail Sheet (slide-over or modal)

```
+------------------------------------------+
| [Item Name]                    [86 / 68] |
| Section: Entrees    Category: Entree     |
+------------------------------------------+
| Price: $24.00    Food Cost: $7.20        |
| CM: $16.80       Food Cost %: 30.0%     |
| Performance: Star                        |
| Qty Sold (30d): 342    Mix %: 8.2%      |
+------------------------------------------+
| Linked Recipe: [Grilled Branzino] ->     |
| (click to view Modernist recipe card)    |
+------------------------------------------+
| Recommendation:                          |
| "Protect this Star. Feature in window    |
|  menu and server verbal recommendations" |
+------------------------------------------+
| Price History (sparkline chart)           |
| Cost History (sparkline chart)            |
+------------------------------------------+
| [Simulate Price Change]                  |
| New price: [___]  -> shows projected     |
|   CM, food cost %, quadrant shift        |
+------------------------------------------+
| [Edit] [Delete] [Chat about this item]   |
+------------------------------------------+
```

### 86 Board (dedicated tab or overlay)

- List of all currently-86'd items
- Each row: item name, reason, 86'd at (duration), location
- One-click un-86 (68) button
- Historical 86 frequency badge (e.g., "86'd 3 times this month")
- Agent can proactively emit action cards when items are 86'd

### Price Simulation Panel

- Select item or batch of items
- Input new price
- Show side-by-side: current vs projected (CM, food cost %, quadrant)
- "What if food cost rises 10%?" slider for sensitivity analysis
- Apply button routes through agent (MCP tool call)

---

## 7. Agent Intelligence Layer

### Proactive Analysis (via scheduled or triggered runs)

1. **Daily Matrix Refresh**: Agent recalculates quadrant assignments when new PosProductMix data arrives. If any item changes quadrant, emit an action card:
   - "Grilled Salmon moved from Star to Plowhorse -- food cost rose 4% this week due to salmon price increase"

2. **Price Alert Cascade**: When a `PriceAlert` fires for an ingredient, agent traces it through `RecipeIngredient` -> `Recipe` -> `MenuItem` and calculates the new food cost %. If any item crosses the target threshold (e.g., 30%), emit an urgent action card.

3. **Dog Identification**: Monthly scan for persistent Dogs (low sales + low margin for 3+ consecutive periods). Agent recommends removal or replacement with specific alternatives.

4. **Puzzle Promotion**: Agent identifies Puzzles and generates marketing copy / server talking points. Can push to the Marketing module as a campaign draft.

5. **86 Pattern Detection**: If an item is 86'd more than N times in a period, agent flags it as a supply chain risk and suggests recipe modification, vendor change, or menu removal.

### Conversational Commands (natural language via chat)

- "Show me all items with food cost above 35%"
- "What happens if I raise the burger price by $2?"
- "86 the lobster bisque -- we ran out of lobster"
- "Which items should I cut from the menu?"
- "Create a summer seasonal menu with our highest-margin items"
- "Why did the salmon move from Star to Plowhorse?"

---

## 8. Recipe-Menu-Cost Pipeline

The data flow that makes menu engineering actually work:

```
Supplier Prices (Items.last_known_price)
        |
        v
Recipe Ingredients (RecipeComponentIngredient.weight_g * price/g)
        |
        v
Recipe Total Cost (WorkspaceRecipe.total_cost, .cost_per_serving)
        |
        v
Menu Item Food Cost (WorkspaceMenu.food_cost = recipe.cost_per_serving)
        |
        v
Contribution Margin (WorkspaceMenu.price - food_cost)
        |
        v
Matrix Classification (CM vs menu_mix_pct -> Star/Puzzle/Plowhorse/Dog)
```

**Critical dependency**: This pipeline requires that `WorkspaceRecipe.cost_per_serving` stays current. Two approaches:
1. **Pull on read**: When menu page loads or matrix recalculates, query linked recipe's cost_per_serving
2. **Push on change**: When any ingredient price or recipe composition changes, trigger a cascade update to all linked menu items

Recommendation: Use approach (2) for real-time accuracy, implemented as a database trigger or an agent-side post-update hook in the MCP `workspace_action` handler.

---

## 9. Implementation Phases (Revised — Chef-Approved)

> **Design principle:** Chat-first for all mutations. The menu page has tabs: Performance (matrix + table), Current Menu, Menu History, 86 Board. AI suggestions arrive as action cards.
>
> **Context from chef:** At Alinea Group, menus are printed fresh daily — any 86, new dish, or change triggers a reprint. Long-term vision: A0 generates print-ready menu files (InDesign/Canva integration via plugin architecture). Not for v1 but the data model must support it.
>
> **Chat handles:** "86 the lobster bisque — ran out", "What if I raise the burger to $26?", "Add a new appetizer at $18", "Which Dogs should I cut?", "Show me last Tuesday's menu"

### Phase 1: Data Foundation + Enhanced Table (P0)
1. Alembic migration: add price/food_cost/CM/is_86/quantity_sold/menu_mix_pct to `workspace_menu` and `menu_items`
2. Create `menu_item_history` and `eighty_six_log` tables
3. Update schemas, backfill existing items with price/food_cost from linked recipes
4. New MCP tools: `menu_86`, `menu_un86`, `menu_recalculate_matrix`
5. New API endpoints: `/api/menu/:id`, `/api/menu/86-board`
6. **Frontend tabs:** Performance | Current Menu | History | 86 Board
7. Enhanced table on Performance tab: add Price, Food Cost, CM, Qty Sold, Food Cost % columns
8. 86 Board tab: currently-86'd items with reason, duration, un-86 action via chat
9. **Chat at bottom** for all mutations

### Phase 2: Item Detail + Matrix View (P1)
10. Item detail slide-over: price, cost, CM, food cost %, performance badge, linked recipe, recommendation
11. Matrix scatter plot (Recharts): X = menu mix %, Y = CM, dots colored by quadrant, hover details
12. View toggle: Matrix / Table on Performance tab
13. Menu History tab: past menus by date (what was on the menu last Tuesday?)

### Phase 3: Agent Intelligence + Price Simulation (P2)
14. Matrix recalculation from PosProductMix + recipe costs
15. Price simulation: "What if I raise the burger to $26?" → projected CM, food cost %, quadrant shift
16. Action cards for quadrant changes, persistent Dogs, 86 patterns
17. Puzzle promotion → push to Marketing module as campaign draft

### Deferred — Future Vision
- **Print-ready menu generation** — A0 generates Canva/InDesign files from current menu data. Plugin architecture makes this possible (A0 creates a `mcp_canva` plugin, manifest defines "Generate Tonight's Menu" as an action card). Months away.
- Seasonal/LTO management with date windows
- Card view with drag-to-reorder menu position

---

## 10. Success Metrics

| Metric | Target |
|---|---|
| Every active item shows food cost % | 100% coverage |
| 86 reflected in UI within 5 seconds | Via chat → MCP → action card |
| Matrix quadrants match manual analysis | Validated against test data |

---

## Appendix: Competitive Research Sources

- [Toast: Menu Engineering Matrix Guide](https://pos.toasttab.com/blog/on-the-line/menu-engineering-matrix)
- [Apicbase: Menu Engineering Software](https://get.apicbase.com/menu-engineering/)
- [Apicbase: Food Costing Software](https://get.apicbase.com/food-costing-software/)
- [Lightspeed/Upserve: Menu Intelligence](https://www.lightspeedhq.com/upserve/)
- [MenuDrive: Features](https://www.menudrive.com/features/)
- [Pricing Solutions: MenuPriceOptimizer](https://www.pricingsolutions.com/priceoptimizer/)
- [RMS: Price Studio AI-Powered Pricing](https://www.revenuemanage.com/price-studio/)
- [SpotOn: Menu Engineering Guide](https://www.spoton.com/blog/menu-engineering/)
- [MarginEdge: Menu Performance Types](https://www.marginedge.com/blog/2021/08/29/how-to-tackle-4-types-of-menu-performance)
- [CrunchTime: LTO & Seasonal Menus](https://www.crunchtime.com/blog/blog/seasonal-menu-restaurant-innovation)
- [Square: Restaurant POS with Auto-86](https://squareup.com/us/en/point-of-sale/restaurants)
- [Restaurant Peers: Menu Engineering Matrix Strategies](https://restaurantpeers.com/menu-engineering-matrix/)
- [Menubly: Menu Engineering Matrix](https://www.menubly.com/blog/menu-engineering-matrix/)
- [SynergySuite: Menu Engineering](https://www.synergysuite.com/blog/restaurant-menu-engineering/)
