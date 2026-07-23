# DB-007 — Workspace-Model Future Decision

**Cycle:** 2 (Phase 2)
**Owner:** software-architect (agency-router delegated, leaf-fallback inline)
**Status:** Accepted — pending Phase 8 / Phase 9 execution
**Source input:** `/root/carabineros/docs/DATA_OWNERSHIP.md` (Cycle 1)
**Update:** `/root/carabineros/docs/DATA_OWNERSHIP.md` — new "DB-007 Final Decisions" section appended

---

## Executive Summary

The bridge (`carabiner/runtime/` + `carabiner/mcp/server.py` — the only path hermes uses) reads and writes the `workspace_*` family for **every one of the 8 modules** exposed in `carabiner/mcp/server.py:_MODULE_REGISTRY` (orders, inventory, prep, food_cost, menu, recipes, invoices, campaigns). The legacy `carabiner/db/models.py` operational tables are **not** on the bridge path except in three places: (a) inventory counts/par/waste feeding `WorkspaceInventory` summaries, (b) `DailyFoodCost`/`BudgetPeriod`/`DailyPL` feeding `WorkspaceFoodCost` and the KPI/timeseries MCP tools, and (c) `Item` / `Vendor` referenced only by unused CRUD helpers and the legacy CLI.

**The headline decision is "Option 1 — canonical workspace_*" for 6 of 8 modules, with two targeted "Option 2 — projection" exceptions for inventory and food_cost** (where operational tables are still the source of truth for the numeric event stream and the time-series). Full consolidation onto `workspace_*` is scheduled for Phase 9 once the bridge owns the inventory-count and food-cost ingestion paths.

---

## Per-Table Decision Matrix

Legend — **Decision**:
- **canonical** — workspace_* is the source of truth; the operational table is deprecated and on the removal list.
- **projection** — operational is canonical; workspace_* is a derived/aggregated read view kept fresh by ingest code.
- **demo-only** — workspace_* is a UI/demo surface; production data lives elsewhere.
- **transitional** — both kept in parallel; consolidation planned in a later phase.
- **migration** — explicit plan to move workspace_* → operational in a named future phase.

| # | Workspace table | Operational counterpart(s) | Bridge read/write evidence | Data overlap | Decision | Rationale |
|---|---|---|---|---|---|---|
| 1 | `workspace_orders` | `orders` (models.py) — unused on bridge path | `repositories.py:147-184`; `mcp/server.py:153-159` (`list/get/create/update/delete_order` → `WorkspaceOrder`) | None — operational `orders` has no MCP module, no CLI, no repo helper outside legacy API | **canonical** (Option 1) | Bridge has exclusive ownership. Deprecate `orders`. |
| 2 | `workspace_inventory` | `inventory_counts`, `inventory_count_lines`, `par_levels`, `waste_logs`, `items` | `repositories.py:187-201` (workspace CRUD); `440-754` (`InventoryCount`/`ParLevel`/`WasteLog` feeds summary); `mcp/server.py:566-754` (`inventory_count_submit`, `par_level_set`, `waste_log_create`, `inventory_valuation`) | Workspace aggregates par/waste/valuation from operational, but holds its own summary fields (`item_name`, `on_hand`, `variance`, `summary`, `detail_points`) | **projection** (Option 2) | Operational `inventory_counts`/`par_levels`/`waste_logs` are the event log; `workspace_inventory` is the chat-facing summary. Phase 9 plan: introduce workspace-side count event tables so workspace becomes canonical and operational counts are projected. |
| 3 | `workspace_prep` | `prep_lists`, `prep_list_items`, `prep_stations` | `repositories.py:203-216`; `mcp/server.py:160-166` (full CRUD on `WorkspacePrep`). Operational `PrepList` only read by legacy `api/_a0_handlers.py:697` and `api/prep_routes.py` (full Flask REST surface). | Workspace `WorkspacePrep` is a row-per-task; operational `PrepList`/`PrepListItem` is a structured prep-list with station/assigned_to/est_minutes/sort_order. Different shapes — not overlap. | **canonical** (Option 1) | Bridge owns prep through MCP; legacy Flask REST surface for `PrepList` is dead UI. Deprecate `prep_lists`/`prep_list_items`/`prep_stations`. |
| 4 | `workspace_food_cost` | `daily_food_cost`, `budget_periods`, `daily_pl`, `pos_sales`, `pos_product_mix`, `price_alerts` | `repositories.py:219-232` (workspace CRUD); `mcp/server.py:1428-1525` (`daily_food_cost_list`, `food_cost_summary_kpis` read `DailyFoodCost`/`BudgetPeriod`/`DailyPL` from operational) | Workspace is per-menu-item pressure/snapshot; operational is the daily time-series. Distinct shapes; workspace is derived. | **projection** (Option 2) | The KPI/timeseries tools are the only consumer of operational `DailyFoodCost`/`BudgetPeriod`/`DailyPL`. Workspace cannot become canonical until it can ingest POS sales directly. Phase 9 plan: add `workspace_daily_food_cost` mirror table, write from connector, then deprecate operational time-series. |
| 5 | `workspace_menu` | `menu_items` (operational) — no bridge code touches it | `repositories.py:235-249`, `304` (`get_menu_items_by_recipe` → `WorkspaceMenu`); `mcp/server.py:181-200`, `1111-1143` (`menu_86` writes `WorkspaceMenu` + `EightySixLog`) | Operational `menu_items` is unreferenced in bridge path. `WorkspaceMenu` has its own engineering fields (`price`, `food_cost`, `quantity_sold`, `is_86`, etc., added in migration `010_menu_engineering_phase1`). | **canonical** (Option 1) | Operational `menu_items` is orphaned. Deprecate. |
| 6 | `workspace_campaigns` | `campaigns` (operational) — does not exist as a separate model | `repositories.py:251-262`; `mcp/server.py:195-201`. No operational counterpart in current schema. | None — no overlap. | **canonical** (Option 1) by default. No operational table exists to be canonical. | Future marketing-analytics may need a time-series projection; not blocking. |
| 7 | `workspace_invoices` + `invoice_events` | `invoices`, `invoice_line_items` (operational) — no bridge code touches them | `repositories.py:284-301`; `mcp/server.py:167-173, 1866-1915` (`invoices_upload`, `invoices_approve` write `WorkspaceInvoice` + `InvoiceEvent`) | Operational `invoices`/`invoice_line_items` has its own schema (per migration `008_align_invoices_with_orm`) but no MCP bridge code reads or writes it. `WorkspaceInvoice.line_items` is a JSONB blob, `InvoiceEvent` is a separate child table — different shapes. | **canonical** (Option 1) | Bridge has exclusive ownership. Deprecate `invoices`/`invoice_line_items`. |
| 8 | `workspace_recipes` + `recipe_components` + `recipe_component_ingredients` + `recipe_steps` | `recipes`, `recipe_ingredients` (operational, models.py:215/232) — no bridge code touches them | `repositories.py:323-433` (full CRUD on `WorkspaceRecipe` + nested components/ingredients/steps). Migration `004_modernist_recipes` created the four workspace recipe tables and seeded them; no migration dropped the operational `recipes` table. | Completely different shapes: workspace is Modernist Cuisine (components → ingredients + steps); operational is flat ingredients. Migration 004 effectively superseded operational `recipes`. | **canonical** (Option 1) | Operational `recipes`/`recipe_ingredients` are superseded and orphaned. Deprecate. |
| 9 | `workspace_locations` + `organizations` | `locations` (operational, models.py:33) — no bridge code touches it | `repositories.py:109-127, 271-281`; `mcp/server.py:11-114` (location resolution helper `_default_location_id`). Workspace has FK `workspace_*.location_id → workspace_locations.id`. | None — workspace has its own schema with `org_id` multi-tenancy hook. | **canonical** (Option 1) | Operational `locations` is orphaned. Deprecate. |
| 10 | `inbox_items` | none | `repositories.py:131-145`; not in `_MODULE_REGISTRY` (UI-only); used internally for action inbox | None | **canonical** (Option 1) | UI-only inbox. No operational counterpart. |
| 11 | `action_log` | none | `runtime/audit.py` + `runtime/mcp_surface.py:243-255` + `repositories.py:22` | None | **canonical** (Option 1) | Append-only audit trail. No operational counterpart. Already in workspace_models. |
| 12 | `menu_item_history` | none | `mcp/server.py:1240, 1307` (history row written on `performance` change) | None | **canonical** (Option 1) | Audit trail for menu engineering recalcs. |
| 13 | `eighty_six_log` | none | `mcp/server.py:1142-1143` (written on `menu_86`) | None | **canonical** (Option 1) | Event log for 86/68 pattern analysis. |
| 14 | `Item` (operational) | referenced by `recipe_component_ingredients.item_id` (FK → `items.id`) | `repositories.py:719-748` (`get_item`/`create_item`/`update_item`). No MCP tool or bridge code calls these. | `items` is the master catalog; `WorkspaceInventory.item_id` and `RecipeComponentIngredient.item_id` reference it. So it IS a real schema-level dependency of two workspace tables. | **operational** (keep for now) — but **transitional** at the surface layer | `items` is the master catalog FK target. Repositories that touch it are unused. Two paths: (a) make it workspace (`workspace_items`) and migrate FKs in Phase 8, or (b) keep it and document as cross-context shared reference. Recommend (a) in Phase 9 alongside the food_cost projection consolidation. |
| 15 | `Vendor` (operational, models.py:52) | none | `cli/commands/vendors.py:36,51` only. No bridge / MCP / Flask API code. | None on bridge path. Legacy CLI uses it for vendor CRUD. | **transitional** → migrate to workspace in Phase 8 | The workspace `WorkspaceOrder.vendor` is a free-text string; there's no workspace vendors table. Phase 8: add `workspace_vendors` and migrate FK from `WorkspaceOrder.vendor` text to UUID. |

---

## ADR-001: Workspace-* Models Are the Canonical Source for the Bridge

**Status:** Accepted — 2026-07-23

### Context

Carabiner OS has two parallel ORM schemas:

- `carabiner/db/models.py` — the original operational schema (27 tables: locations, items, vendors, units_of_measure, invoices, inventory_counts, par_levels, waste_logs, recipes, recipe_ingredients, menu_items, prep_lists, prep_list_items, prep_stations, daily_food_cost, price_alerts, order_guides, purchase_orders, pos_sales, pos_product_mix, daily_pl, budget_periods, gl_accounts).
- `carabiner/db/workspace_models.py` — a newer chat-driven schema (18 tables: organizations, workspace_locations, inbox_items, workspace_orders, workspace_inventory, workspace_prep, workspace_food_cost, workspace_menu, workspace_campaigns, workspace_invoices, invoice_events, workspace_recipes, recipe_components, recipe_component_ingredients, recipe_steps, action_log, menu_item_history, eighty_six_log).

MASTER_PROMPT.md Phase 2 DB-007 explicitly requires the team to declare, per table, which of five states it occupies: **canonical / projection / demo-only / transitional / scheduled for migration**. This document records that declaration, grounded in code evidence (file:line citations above).

### Decision

**For 6 of 8 bridge modules, workspace_* is canonical and the operational counterpart is deprecated.** The two exceptions — inventory and food_cost — keep their operational tables because they are the only place where time-series and event-log data is captured, and the bridge does not yet own the ingestion path for those events. Those two are kept as **projections** until Phase 9 ingestion is in place.

The bridge's _MODULE_REGISTRY (`carabiner/mcp/server.py:145-202`) maps 8 modules (inventory, orders, prep, invoices, recipes, menu, food_cost, campaigns). All 8 resolve to `workspace_*` models via `repositories.py`. The only operational tables the bridge actually reads are `InventoryCount`/`InventoryCountLine`/`ParLevel`/`WasteLog`/`Item` (inventory projection) and `DailyFoodCost`/`BudgetPeriod`/`DailyPL` (food_cost projection). The rest of the operational schema is dead in the bridge path.

### Consequences

**Positive:**
- One mental model for hermes: all `carabiner_read` / `carabiner_propose_write` traffic flows through `workspace_*`. New agents can be onboarded without learning the dual-schema history.
- Smaller blast radius for changes — the chat-driven card lifecycle, action_log, and chat_context_id are all already in `workspace_*` (added by migration `011_add_chat_context_id`).
- Phase 8 (modularity) can drop 5 operational tables with no code change in the bridge: `orders`, `invoices`, `invoice_line_items`, `menu_items`, `recipes`, `recipe_ingredients`, `locations`.
- Phase 9 (product) gets a clean slate — multi-tenant org_id, cross-location queries, and consolidation all operate on `workspace_*`.

**Negative / Trade-offs:**
- Keeping the dual schema through Phase 8 means **two writes per inventory count** (one to `inventory_counts`/`par_levels`, one to `workspace_inventory` summary). Risk of inconsistency: if the workspace summary update fails after the operational write commits, the dashboard will lie about on-hand. The mitigation (DB-007 risk #2 below) is a single Alembic transaction wrapping both writes, plus a nightly reconciler job.
- Two operational tables (`items`, `Vendor`) remain as **transitional** because `recipe_component_ingredients.item_id` and the legacy CLI vendor CRUD still depend on them. This keeps the cross-context coupling alive — we accept it for Phase 8 and explicitly schedule the migration in Phase 9.
- The "demo-only" option was not chosen for any table — every workspace_* table that exists has a real read or write in the bridge or in a non-legacy UI path. There is no purely-demo data.

**Reversibility:** All decisions are reversible at the repository layer until a Phase-8 migration drops the operational tables. After that, an operational table resurrection requires a re-migration with backfill, which is non-trivial.

**Dependency direction:** The workspace_* schema must not import from `models.py` operational classes. (Verified: `workspace_models.py` has no `from .models import`.) When projections need operational data (food_cost time-series), they cross the boundary only through repositories, not through ORM joins — preserving the anti-corruption layer the specialist template requires.

---

## Migration Order

Sequenced to minimize risk. Each phase assumes Phase 8 has already validated drop paths on staging.

### Phase 8a — "Deprecate but don't drop" (no data movement)

This is what we are committing to **right now**:

1. Add `# DEPRECATED — see state/carabineros/DB-007_MODEL_DECISION.md` to: `orders`, `invoices`, `invoice_line_items`, `menu_items`, `recipes`, `recipe_ingredients`, `locations`.
2. Update `DATA_OWNERSHIP.md` (this document + the appended section).
3. Add a CI check that no new code references the deprecated tables.

**Effort:** <1 day. **Risk:** zero (no data movement).

### Phase 8b — "Move vendor to workspace" (low-risk migration)

4. Create `workspace_vendors` table.
5. Backfill from `vendors` (one-shot SQL).
6. Add `WorkspaceOrder.vendor_id` UUID column, backfill by name match.
7. Switch CLI to workspace vendors.
8. Drop `vendors`.

**Effort:** 2-3 days. **Risk:** low. Backfill by name match is fuzzy but the vendor list is short (5-20 vendors). **Mitigation:** keep `vendors` read-only for 30 days post-cutover.

### Phase 8c — "Move items to workspace" (medium-risk migration)

9. Create `workspace_items` table (copy schema of `items`).
10. Migrate `RecipeComponentIngredient.item_id` FK and `WorkspaceInventory.item_id` FK to `workspace_items.id`.
11. Backfill `workspace_items` from `items`.
12. Drop `items`.

**Effort:** 3-5 days. **Risk:** medium — FK migration requires `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT` and backfill must be transactional. **Mitigation:** run the migration in a single Alembic transaction with explicit `IF EXISTS` guards; gate behind a feature flag.

### Phase 9a — "Inventory consolidation" (projection → canonical)

13. Add `workspace_inventory_counts`, `workspace_par_levels`, `workspace_waste_logs` to mirror operational.
14. Route the MCP `inventory_count_submit`, `par_level_set`, `waste_log_create` tools through workspace-only writes (operational tables become derived views or get dropped).
15. Update `WorkspaceInventory` summary read to source from workspace tables.
16. Backfill from operational.
17. Drop `inventory_counts`, `inventory_count_lines`, `par_levels`, `waste_logs`.

**Effort:** 1-2 weeks. **Risk:** medium-high — daily operational data is captured here; backfill correctness must be validated row-by-row. **Mitigation:** dual-write under feature flag for 2 weeks; nightly reconciler alerts on count mismatches.

### Phase 9b — "Food-cost consolidation" (projection → canonical)

18. Add `workspace_daily_food_cost` mirror table.
19. Wire the POS ingest path to write workspace instead of (or in addition to) operational.
20. Backfill.
21. Drop `daily_food_cost`, `budget_periods`, `daily_pl`.

**Effort:** 1-2 weeks. **Risk:** high — this is the financial ledger. **Mitigation:** dual-write for 4 weeks (one full month-end cycle), reconciliation report must match to the cent.

### Phase 9c — "Last cleanup" (drop remaining operational)

22. Drop `locations`, `units_of_measure`, `gl_accounts` (all confirmed orphaned).

**Effort:** 1 day. **Risk:** zero (no references found).

---

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Dual-write inconsistency between `workspace_inventory` summary and `inventory_counts`/`par_levels` event log | Medium | High — dashboard on-hand figure drifts from truth | Single transaction wrapping both writes (`repositories.create_inventory_count`); nightly reconciler comparing `workspace_inventory.on_hand` against `SUM(inventory_count_lines.quantity)` |
| R2 | Data loss during Phase 9 food-cost migration (financials) | Low | Critical | Dual-write for 4 weeks; reconciliation report comparing operational and workspace row-for-row with cent-level match before drop; pre-migration backup retained 90 days |
| R3 | Backfill breakage for `items` and `vendors` (FK cascade) | Medium | Medium | Phase 8c runs `ALTER TABLE ... DROP CONSTRAINT` + `ADD CONSTRAINT` in single Alembic transaction; staging dry-run before prod; feature flag for rollback |
| R4 | Legacy Flask UI (`api/_a0_handlers.py`, `api/prep_routes.py`) breaks when `prep_lists` is dropped in Phase 8 | High | High — legacy UI is end-user visible | Confirm legacy UI is dormant in production before dropping. `PrepList` is referenced by `_a0_handlers.py:697` and `prep_routes.py:34`. If the legacy UI is still served, do NOT drop `prep_lists` in Phase 8 — schedule for Phase 10 once legacy UI is decommissioned. (See **open question Q1** below.) |
| R5 | Tests cover both schemas, hiding consolidation bugs | Medium | Medium | Add an integration test that fails if both schemas are written in a single transaction outside the explicit projection helpers |
| R6 | `Item` and `Vendor` transitional state confuses new engineers | High | Low | Document inline in `models.py` and in `DATA_OWNERSHIP.md`; CI lint that flags new `from carabiner.db.models import Item/Vendor` |
| R7 | Migration 004 (`modernist_recipes`) silently orphaned `recipes`/`recipe_ingredients` — Phase 8 drop might surface long-broken foreign-key references nobody noticed | Low | Medium | Run `pg_dump --schema-only` against staging and grep for any reference to `recipes` or `recipe_ingredients` before issuing DROP TABLE |
| R8 | `WorkspaceRecipe` → `RecipeComponentIngredient.item_id` → `items.id` FK is not enforced by SQLAlchemy (it's a UUID column without an explicit ForeignKey constraint in workspace_models) | Medium | Low | Verified at workspace_models.py:355 — FK is declared. Risk is closed. Listed here for completeness of the audit. |
| R9 | `_MODULE_REGISTRY` resource mapping silently breaks if a Phase 9 table rename happens | Low | High — bridge 500s | The registry is namespaced to repo function names, not table names, so renaming a workspace_* table doesn't break the registry. But renaming a repository function does. Add a startup self-check that imports every registry function and fails fast. |

---

## Open Questions

- **Q1.** Is the legacy Flask UI in `carabiner/api/` still served in production? The CLAUDE.md describes only the FastAPI bridge as the current runtime, but `_a0_handlers.py` and `prep_routes.py` look live. If yes, R4 above becomes a Phase 10 blocker. If no, Phase 8 can drop `prep_lists` and friends without consequence.
- **Q2.** Is the `vendors` table referenced by any MCP tool I haven't found? I checked `_MODULE_REGISTRY` (8 modules; no `vendors`) and the legacy CLI, but the table is still imported in `models.py` and the policy gate at `policy.py:34` lists `"vendors"` as an `ALLOWED_RESOURCES` — meaning hermes could propose a write to `vendors` that would fail because no module registers it. Decision: keep `vendors` in `ALLOWED_RESOURCES` until Phase 8b creates the workspace table and registers the module.

---

## Acceptance Checklist

- [x] Decision documented per table (15 rows above)
- [x] Rationale grounded in code evidence with file:line citations
- [x] ADR-001 captured (Context / Decision / Consequences)
- [x] Migration order sequenced across Phase 8 and Phase 9
- [x] Risk register with 9 risks and explicit mitigations
- [x] `docs/DATA_OWNERSHIP.md` updated with the "DB-007 Final Decisions" section
- [x] Reversibility noted (all decisions reversible until Phase 8 drops tables)
- [x] Dependency direction preserved (workspace_* does not import from operational models)
