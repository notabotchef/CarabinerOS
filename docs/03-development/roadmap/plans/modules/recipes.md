# Recipes Module -- Functional Upgrade Plan

> Research-only document. No code changes.
> Date: 2026-03-24

---

## 1. Current State

### Frontend (`frontend/src/app/recipes/page.tsx`)
- Single `page.tsx` file, ~310 lines, list-only view.
- Shows a card grid of recipes with: name, category, status (Active/Draft/Archived), estimated cost, yield (qty + unit), tags, and summary.
- Filtering by status tab and free-text search (name, category, tags).
- Two header buttons ("Scan Recipe", "New Recipe") are present but non-functional -- no detail view, no create/edit form, no drawer or modal.
- Uses `useWorkspace<Recipe>("/api/recipes")` -- a generic hook that fetches the flat list. No detail endpoint is called from the frontend.

### Backend -- Workspace Models (`carabiner/db/workspace_models.py`)
Four tables form the Modernist Cuisine recipe structure:

| Table | Key columns |
|---|---|
| `WorkspaceRecipe` | name, category, description, status, yield_quantity, yield_unit, total_weight_g, total_cost, cost_per_serving, image_url, source, equipment (JSONB), notes, tags (JSONB) |
| `RecipeComponent` | name, sort_order, yield_quantity, yield_unit. FK to recipe. |
| `RecipeComponentIngredient` | name, weight_g, percentage, unit_display, sort_order, notes. FK to component, optional FK to `items`. |
| `RecipeStep` | step_number, instruction, temperature, duration, technique. FK to component. |

Relationships are fully wired: `WorkspaceRecipe -> components -> [ingredients, steps]`.

### Backend -- Legacy Models (`carabiner/db/models.py`)
Older `Recipe` and `RecipeIngredient` tables exist with `is_sub_recipe` support and a `sub_recipe_id` FK on `RecipeIngredient`. These are not used by the workspace layer but contain the sub-recipe linking concept.

### API Layer
- **Flask blueprint** (`carabiner/api/flask_blueprint.py`): Single `GET /api/recipes` endpoint returning flat `RecipeOut` list (no nested components).
- **Pydantic schemas** (`carabiner/api/schemas.py`): `RecipeOut` (flat), `RecipeDetailOut` (includes nested `RecipeComponentOut` with ingredients + steps), plus full Create schemas.
- **MCP tools** (`carabiner/mcp/server.py`): `recipes_list`, `recipes_get`, `recipes_create`, `recipes_update`, `recipes_delete` -- full CRUD, nested component support on create/update.
- **Repository** (`carabiner/db/repositories.py`): `list_recipes` (with status/category/search filters), `get_recipe` (eager-loads components -> ingredients + steps), `create_recipe` (nested), `update_recipe` (replaces components), `delete_recipe`.

### Gaps Identified
1. No `GET /api/recipes/<id>` REST endpoint (only MCP has detail fetch).
2. No recipe detail view in the frontend.
3. No create/edit form UI.
4. No sub-recipe linking in workspace models (legacy models have it, workspace does not).
5. No cost-per-ingredient (no price field on `RecipeComponentIngredient`; cost is stored only at the recipe level as a manual total).
6. No scaling logic -- yield exists as a field but no backend function to compute scaled quantities.
7. No nutrition data anywhere.
8. No photo management beyond a single `image_url`.
9. No version history or recipe duplication.
10. No connection from recipe cost to menu item margin (WorkspaceMenu has `recipe_id` FK but no live cost flow).

---

## 2. Competitive Landscape

### Meez (getmeez.com)
- Purpose-built by chefs. Recipes are the central data object.
- One-click scaling with auto unit conversion and batch-size adjustment.
- Sub-recipe costing with prep-loss/yield tracking baked into every component.
- Photos and videos attached per step for training (claims 70% faster onboarding).
- Real-time cost updates flowing into Restaurant365 / purchasing systems.
- Version control on recipes; multi-location sync.
- Customers achieve $30k-$50k annual COGS reduction on average.

### Craftable (craftable.com)
- Back-office platform connecting purchasing, receiving, inventory, AP, and financial reporting.
- Recipes connect to physical counts and theoretical usage to spot margin loss.
- Strength is in tying recipe data to the full procurement cycle, not recipe authoring itself.

### Galley Solutions (galleysolutions.com)
- "Culinary Resource Planning" (CRP) platform -- recipes as the foundation of all ops.
- Real-time propagation: any recipe/ingredient change instantly reflects across all menus, locations, production schedules.
- Production scheduling + menu planning with budget, time, and allergen constraints.
- Vendor-connected real-time food costing; optimized purchase order generation.

### ChefTec (cheftec.com)
- Legacy desktop software (Basic/Plus/Ultra tiers).
- Unlimited recipe storage, scaling, and sizing with instant cost-per-portion analysis.
- Nutrition analysis: 1,300-1,700 ingredient database with full nutrient breakdown.
- Ultra tier adds production management, waste tracking, lot tracking, AI-generated recipe procedures.

### Apicbase (apicbase.com)
- Recipes, allergens, nutrition, costs, and yields in a single structured database.
- Plate cost breakdown: ingredient cost + wastage + personnel/production cost = full prime cost.
- Nutri-score and nutrition label calculation from ingredient data.
- AI recipe import: converts messy source material into structured recipes linked to ingredient DB.
- Negative-margin alerts as soon as they appear.

### ReciPal (recipal.com)
- Focused on nutrition label generation (FDA/CFIA compliant).
- 15,000+ ingredient database; AI Jumpstart for recipe parsing.
- Sub-recipes as ingredients with cost/nutrition/allergen flow-through.
- Cost tracking per package and per batch including labor, packaging, overhead.
- Barcode generation (UPC-A, EAN-13, Code128).

### Key Patterns Across Competitors
1. **Recipe = central data object** that drives costing, scaling, nutrition, and operations.
2. **Sub-recipes** (sauces, stocks, doughs) are first-class, with cost/yield propagating upward.
3. **Ingredient prices flow from purchasing/inventory** -- not manually entered on the recipe.
4. **Scaling is computed, not manual** -- change yield, all quantities recalculate.
5. **Nutrition is derived from ingredients**, not entered separately.
6. **Photos per step**, not just a single hero image.
7. **Version history** and recipe duplication for seasonal changes.
8. **Real-time margin alerts** when ingredient costs change.

---

## 3. Data Model Changes Required

### 3a. Modifications to Existing Tables

**`RecipeComponentIngredient`** -- add columns:
- `unit_cost` (Numeric 12,4) -- cost per unit_display at time of last sync
- `extended_cost` (Numeric 12,4) -- computed: weight_g * unit_cost / conversion
- `supplier_item_id` (UUID FK to future supplier catalog, nullable)

**`WorkspaceRecipe`** -- add columns:
- `parent_recipe_id` (UUID FK self-referential, nullable) -- for sub-recipe linking
- `is_sub_recipe` (Boolean, default false)
- `prep_loss_pct` (Numeric 5,2) -- yield loss percentage (trim, evaporation, etc.)
- `active_time_minutes` (Integer, nullable) -- hands-on time
- `passive_time_minutes` (Integer, nullable) -- resting, chilling, proofing
- `version` (Integer, default 1)
- `forked_from_id` (UUID FK self-referential, nullable) -- recipe duplication lineage
- `allergens` (JSONB, default []) -- derived or manual override
- `nutrition_per_serving` (JSONB, nullable) -- { calories, fat_g, protein_g, carbs_g, fiber_g, sodium_mg, ... }
- `menu_price` (Numeric 10,2, nullable) -- for quick plate-cost % calculation without joining menu items
- `food_cost_pct` (Numeric 5,2, nullable) -- computed: total_cost / menu_price * 100

**`RecipeStep`** -- add columns:
- `photo_url` (String 500, nullable)
- `video_url` (String 500, nullable)

### 3b. New Tables

**`recipe_photos`** -- multiple photos per recipe:
- `id` (UUID PK)
- `recipe_id` (UUID FK)
- `url` (String 500)
- `caption` (String 300, nullable)
- `sort_order` (Integer)
- `is_hero` (Boolean, default false)

**`recipe_versions`** -- version history:
- `id` (UUID PK)
- `recipe_id` (UUID FK)
- `version_number` (Integer)
- `snapshot` (JSONB) -- full recipe state at version time
- `changed_by` (String 200, nullable)
- `change_note` (String 500, nullable)
- `created_at` (DateTime)

---

## 4. API Endpoints Required

### New REST Endpoints (Flask blueprint)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/recipes/<id>` | Recipe detail with nested components, ingredients, steps |
| POST | `/api/recipes` | Create recipe (with nested components) |
| PUT | `/api/recipes/<id>` | Update recipe |
| DELETE | `/api/recipes/<id>` | Delete recipe (cascade) |
| POST | `/api/recipes/<id>/duplicate` | Duplicate recipe (new draft copy) |
| GET | `/api/recipes/<id>/scale?yield_qty=N` | Return scaled ingredient quantities for a target yield |
| GET | `/api/recipes/<id>/cost-breakdown` | Detailed cost breakdown by component and ingredient |
| GET | `/api/recipes/<id>/versions` | Version history |
| POST | `/api/recipes/<id>/photos` | Upload/attach photo |
| GET | `/api/recipes/categories` | Distinct category list for filtering |
| GET | `/api/recipes/sub-recipes` | List recipes flagged as sub-recipes (for linking UI) |

### MCP Tool Additions

- `recipes_scale(id, target_yield_qty)` -- return scaled recipe
- `recipes_duplicate(id)` -- create a copy as draft
- `recipes_cost_breakdown(id)` -- ingredient-level cost detail
- `recipes_link_sub_recipe(recipe_id, component_id, sub_recipe_id)` -- attach a sub-recipe to a component

---

## 5. Frontend Architecture

### New Pages / Routes

| Route | Component | Purpose |
|---|---|---|
| `/recipes` | `page.tsx` (existing, upgraded) | List view with enhanced filtering |
| `/recipes/[id]` | `page.tsx` (new) | Recipe detail view |
| `/recipes/new` | `page.tsx` (new) | Create recipe form |
| `/recipes/[id]/edit` | `page.tsx` (new) | Edit recipe form |

### New Components

| Component | Location | Purpose |
|---|---|---|
| `recipe-detail.tsx` | `components/recipes/` | Full recipe view: header, components, ingredients table, steps, photos |
| `recipe-form.tsx` | `components/recipes/` | Create/edit form with dynamic component/ingredient/step management |
| `recipe-cost-card.tsx` | `components/recipes/` | Cost breakdown panel: ingredient costs, component subtotals, plate cost, food cost % |
| `recipe-scale-dialog.tsx` | `components/recipes/` | Modal to enter target yield and preview scaled quantities |
| `recipe-ingredient-row.tsx` | `components/recipes/` | Single ingredient row with inline editing, weight, percentage, cost |
| `recipe-step-row.tsx` | `components/recipes/` | Step with instruction, time, temp, technique, photo thumbnail |
| `recipe-photo-gallery.tsx` | `components/recipes/` | Photo grid with hero selection and upload |
| `recipe-sub-recipe-picker.tsx` | `components/recipes/` | Search + select existing recipes to link as sub-recipe components |
| `recipe-version-timeline.tsx` | `components/recipes/` | Version history sidebar |
| `recipe-nutrition-panel.tsx` | `components/recipes/` | Nutrition facts display (calories, macros) |

### Hooks

| Hook | Purpose |
|---|---|
| `use-recipe-detail.ts` | Fetch single recipe with components (GET `/api/recipes/<id>`) |
| `use-recipe-mutations.ts` | Create, update, delete, duplicate operations |
| `use-recipe-scale.ts` | Fetch scaled quantities for a given yield |
| `use-recipe-cost.ts` | Fetch cost breakdown |

---

## 6. Scaling Logic

Scaling is a pure ratio calculation anchored on the recipe's base yield:

```
scale_factor = target_yield_qty / recipe.yield_quantity

For each component:
  For each ingredient:
    scaled_weight_g = ingredient.weight_g * scale_factor
    scaled_display  = convert(scaled_weight_g, ingredient.unit_display)
    scaled_cost     = ingredient.unit_cost * scaled_weight_g / base_conversion
```

Rules:
- Percentages within a component remain constant (baker's percentages).
- Equipment notes should flag when scaled quantity exceeds standard vessel sizes (e.g., "exceeds 20qt mixer capacity").
- Sub-recipes scale independently -- their own yield is the anchor.
- UI should show both original and scaled quantities side by side.

The scale endpoint returns a transient response (not persisted) unless the user explicitly saves as a new recipe variant.

---

## 7. Cost Calculation Logic

### Plate Cost
```
plate_cost = SUM(component_costs)
component_cost = SUM(ingredient.weight_g * ingredient.unit_cost / conversion_factor)
                 / (1 - recipe.prep_loss_pct / 100)   # adjust for yield loss
```

### Food Cost Percentage
```
food_cost_pct = (plate_cost / menu_price) * 100
```

Target ranges (industry standard):
- Green: < 28%
- Yellow: 28-32%
- Red: > 32%

### Cost Source Priority
1. **Linked inventory item** (`item_id` FK) -- pull latest purchase price from `items` table.
2. **Manual override** -- `unit_cost` on the ingredient row.
3. **Missing** -- flag as "uncosted" with a warning badge.

### Real-Time Cost Updates
When an invoice is processed or inventory prices change, a background job should:
1. Find all `RecipeComponentIngredient` rows linked to the affected `item_id`.
2. Recalculate `extended_cost` per ingredient.
3. Roll up to `RecipeComponent` subtotals.
4. Roll up to `WorkspaceRecipe.total_cost` and `cost_per_serving`.
5. Recalculate `food_cost_pct` if `menu_price` is set.
6. Emit a Socket.IO event if food_cost_pct crosses a threshold (action card).

---

## 8. Sub-Recipe Architecture

A sub-recipe is a `WorkspaceRecipe` with `is_sub_recipe = true`. Examples: chicken stock, mirepoix, pie dough, gastrique, compound butter.

### Linking
- A `RecipeComponentIngredient` can reference another recipe via a new `sub_recipe_id` FK (mirroring the legacy model pattern).
- When `sub_recipe_id` is set, `item_id` must be NULL (constraint: exactly one source).
- The ingredient's `weight_g` represents how much of the sub-recipe's yield is used.
- Cost is pulled from the sub-recipe's `cost_per_serving` * quantity used.

### Cascading Updates
- When a sub-recipe's cost changes, all parent recipes using it must recalculate.
- This is a DAG traversal: find all `RecipeComponentIngredient` rows where `sub_recipe_id = changed_recipe.id`, then recalculate their parent recipes.
- Circular dependencies must be prevented at write time (a recipe cannot be its own ancestor).

### UI
- The sub-recipe picker shows a searchable list of recipes flagged as sub-recipes.
- Inline, a sub-recipe ingredient row shows a link icon and the sub-recipe's name, cost, and yield.
- Clicking the link navigates to the sub-recipe's detail view.

---

## 9. Implementation Phases (Revised — Chef-Approved)

> **Design principle:** Recipes are the ONE module that gets a **full editor** — not chat-first. Recipes are documents that chefs read, edit, and hand to cooks. The editor follows the MEPAI Capture design language (built by the same chef).
>
> **Reference implementation:** `https://github.com/Nunezchef/mepai-capture.git` — the RecipeEditor component is the design spec. Port its patterns to CarabinerOS with dark theme adaptation.
>
> **Real recipe reference:** `docs/res/roister-budget-checkbook-reference.xlsx` project also has Roister's master recipe doc: ingredient-first, gram weights, grouped by component, real chef language.
>
> **Chat stays at the bottom** for AI-powered tasks:
> - "Generate steps for this recipe" → A0 writes the method
> - "What's the plate cost?" → A0 calculates from linked inventory prices
> - "Scale this to 5x" → faster than clicking scale buttons
> - "Add nutritional info" → A0 nutrition agent researches USDA data
> - "Scan this" + photo → A0 parses image into structured recipe

### Phase 1: Recipe Detail + Editor (P0)

**The editor IS the detail view.** No separate read-only page — you open a recipe and it's immediately editable, like the MEPAI editor.

1. Add `GET /api/recipes/<id>` REST endpoint (repository already supports it)
2. Add `POST /api/recipes`, `PUT /api/recipes/<id>`, `DELETE /api/recipes/<id>` REST endpoints
3. Build `/recipes/[id]/page.tsx` — the MEPAI-style recipe editor, adapted to CarabinerOS dark theme:
   - **Header:** editable title (editorial serif italic), yield field with confidence badge, scaling utility (0.5x–3x + target yield), unit toggle (Metric/US)
   - **Mise en Place section:** ingredient grid (Qty | Unit | Ingredient | notes | delete). Smart Add input — type `200g salt` and it parses. Paste multi-line ingredient lists for bulk add. Enter on last ingredient creates new row.
   - **Execution section:** numbered method steps. Enter creates next step. Backspace on empty deletes. Paste multi-line splits into steps. A0 can generate steps from ingredients via chat.
   - **Critical Controls section:** chef notes, temps, storage, technique warnings
   - **Chat composer at bottom** — inline chat scoped to this recipe's context
4. Wire recipe cards on list page to navigate to `/recipes/[id]`
5. Wire "New Recipe" button to `/recipes/new` (blank editor)
6. **Scan Recipe** — "Scan" button opens camera/file picker, sends image to A0, A0 parses into structured recipe and populates the editor (same as MEPAI Capture flow)
7. Port utilities from mepai-capture: `ingredientParser.ts`, `unitConversion.ts`, `scale.ts`, `yieldEstimator.ts`

### Phase 2: PDF Export + Nutrition Tab (P1)

8. **PDF export** — port `PdfSpec.tsx` from mepai-capture. Clean print layout: title, yield, mise en place table, execution steps, critical controls. A0 can also generate PDFs via chat ("export this as PDF").
9. **Nutrition tab** — A0 nutrition agent researches USDA FoodData Central for each ingredient, stores results in `nutrition_per_serving` JSONB. Displayed as a tab/panel within the recipe view. Chat-triggered: "add nutritional info to this recipe."

### Phase 3: Costing + Menu Link (P1)

10. Add `unit_cost` to `RecipeComponentIngredient`, link to inventory `Item` prices
11. Cost breakdown panel: ingredient costs, component subtotals, plate cost, food cost %
12. Color thresholds: green < 28%, yellow 28-32%, red > 32%
13. Wire to menu module: `WorkspaceMenu.recipe_id` → live plate cost flows into menu engineering

### Deferred
- Sub-recipes (DAG, cascading costs) — future phase
- Photo gallery per step — future (single image_url for now)
- Version history — future
- Live cost alerts / action cards — after costing engine works
- Multi-location recipe variants — after multi-location is real

---

## 10. Open Questions (Resolved)

1. **Nutrition:** A0 nutrition agent + USDA FoodData Central API. Phase 2, as a tab.
2. **Unit conversion:** Port mepai-capture's `unitConversion.ts` — full Metric/US toggle. Gram-canonical storage, display conversion.
3. **Multi-location:** Org-wide recipes. Location-specific costs come later.
4. **Permissions:** Skip for v1. Everyone edits.
5. **PDF export:** Yes, Phase 2. Port PdfSpec from mepai-capture.
6. **Prep integration:** Revisit after prep module brainstorm.
7. **Scan Recipe:** Phase 1. It's A0 + camera — send image, A0 parses, populates editor.
8. **Legacy models:** Ignore. Workspace models only.

## 11. Files to Port from mepai-capture

| Source (mepai-capture) | Target (CarabinerOS) | Purpose |
|---|---|---|
| `components/RecipeEditor.tsx` | `frontend/src/app/recipes/components/recipe-editor.tsx` | Full editor — adapt to dark theme, CarabinerOS design tokens |
| `components/PdfSpec.tsx` | `frontend/src/app/recipes/components/recipe-pdf.tsx` | PDF export layout |
| `utils/ingredientParser.ts` | `frontend/src/lib/ingredient-parser.ts` | Smart Add parsing ("200g salt" → {qty:200, unit:"g", name:"salt"}) |
| `utils/unitConversion.ts` | `frontend/src/lib/unit-conversion.ts` | Metric ↔ US conversion |
| `utils/scale.ts` | `frontend/src/lib/recipe-scale.ts` | Scale by factor + scale to target yield |
| `utils/yieldEstimator.ts` | `frontend/src/lib/yield-estimator.ts` | AI-estimated yield with confidence |
| `types/recipe.ts` | Merge into `frontend/src/lib/types.ts` | Recipe, Ingredient, YieldMeta types |

**Note:** These are ports, not copies. Adapt to CarabinerOS design system (dark theme, oklch colors, DM Sans/Geist Mono fonts, shadcn/ui components). The interaction patterns and data flow are what matter.
