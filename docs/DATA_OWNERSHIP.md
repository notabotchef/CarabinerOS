# CarabinerOS Data Ownership

This document defines canonical ownership, read projections, mutation authority, and lifecycle for all overlapping data entities in the CarabinerOS product. It resolves the dual-model ambiguity between `carabiner/db/models.py` (operational) and `carabiner/db/workspace_models.py` (workspace/frontend-driven).

## Entity Ownership Matrix

### Orders

| Aspect | Definition |
|--------|------------|
| **Canonical transactional source** | `workspace_orders` (workspace_models.py) |
| **Read projection** | `workspace_orders` via `list_orders()` / `get_order()` |
| **Mutation authority** | Bridge MCP `carabiner_propose_write` → policy gate → audit log → execute |
| **Synchronization direction** | Workspace is canonical; operational `orders` table is NOT used |
| **Lifecycle** | Created by chat/human action → proposed → committed → status updates |
| **Deletion behavior** | Hard delete via `delete_order()` (no soft delete) |
| **Consolidation plan** | Operational `orders` table (models.py) is UNUSED — keep for now, mark as DEPRECATED |

### Invoices

| Aspect | Definition |
|--------|------------|
| **Canonical transactional source** | `workspace_invoices` (workspace_models.py) |
| **Read projection** | `workspace_invoices` via `list_invoices()` / `get_invoice()` |
| **Mutation authority** | Bridge MCP `carabiner_propose_write` → policy gate → audit log → execute |
| **Synchronization direction** | Workspace is canonical; operational `invoices` table is NOT used |
| **Lifecycle** | Created via invoice upload → OCR/extract → match PO → approve → paid |
| **Deletion behavior** | Hard delete via `delete_invoice()` (no soft delete) |
| **Audit trail** | `invoice_events` table (one-to-many with workspace_invoices) |
| **Consolidation plan** | Operational `invoices` table (models.py) is UNUSED — keep for now, mark as DEPRECATED |

### Inventory

| Aspect | Definition |
|--------|------------|
| **Canonical transactional source** | `workspace_inventory` (workspace_models.py) |
| **Read projection** | `workspace_inventory` via `list_inventory()` / `get_inventory()` |
| **Mutation authority** | Bridge MCP `carabiner_propose_write` → policy gate → audit log → execute |
| **Synchronization direction** | Workspace is canonical; operational `inventory_*` tables are NOT used |
| **Lifecycle** | Counted via spot/full/walk_in counts → on_hand tracked via par_levels |
| **Deletion behavior** | Hard delete via `delete_inventory()` |
| **Related tables** | `inventory_counts`, `inventory_count_lines`, `par_levels`, `waste_logs` (operational) |
| **Consolidation plan** | Operational `inventory_*` tables ARE USED — they hold the count/par/waste data that the workspace_inventory summary reads from. Keep both, document the read relationship. |

### Prep

| Aspect | Definition |
|--------|------------|
| **Canonical transactional source** | `prep_lists` + `prep_list_items` (models.py — operational) |
| **Read projection** | `workspace_prep` (workspace_models.py) — summary/projection |
| **Mutation authority** | Bridge MCP `carabiner_propose_write` → policy gate → audit log → execute |
| **Synchronization direction** | Operational is canonical; workspace is a READ projection of today's prep state |
| **Lifecycle** | Created (generated_by: manual/scheduled) → approved → items progress (Not started → In progress → Ready) |
| **Deletion behavior** | Hard delete via `delete_prep()` |
| **Consolidation plan** | Keep both. Workspace is a summary; operational holds the full prep list structure. `010_prep_module_upgrade` adds station/assigned_to/est_minutes/sort_order/service_lane/notes to operational — these power the workspace summary. |

### Food Cost

| Aspect | Definition |
|--------|------------|
| **Canonical transactional source** | `workspace_food_cost` (workspace_models.py) |
| **Read projection** | `workspace_food_cost` via `list_food_cost()` / `get_food_cost()` |
| **Mutation authority** | Bridge MCP `carabiner_propose_write` → policy gate → audit log → execute |
| **Synchronization direction** | Workspace is canonical |
| **Lifecycle** | Updated daily from POS sales + purchase data; pressure = (current_cost_pct - target) |
| **Deletion behavior** | Hard delete via `delete_food_cost()` |
| **Related tables** | `daily_food_cost` (operational — historical daily snapshots) |
| **Consolidation plan** | Keep both. `daily_food_cost` is the time-series; `workspace_food_cost` is the current snapshot. |

### Menu

| Aspect | Definition |
|--------|------------|
| **Canonical transactional source** | `workspace_menu` (workspace_models.py) |
| **Read projection** | `workspace_menu` via `list_menu()` / `get_menu()` |
| **Mutation authority** | Bridge MCP `carabiner_propose_write` → policy gate → audit log → execute |
| **Synchronization direction** | Workspace is canonical |
| **Lifecycle** | Created → priced (food_cost, contribution_margin) → optionally 86'd |
| **Deletion behavior** | Hard delete via `delete_menu()` |
| **Related tables** | `menu_items` (operational — recipe-linked menu items), `recipes` (operational) |
| **Consolidation plan** | Keep both. `workspace_menu` is the frontend-facing menu with pricing; `menu_items` links to recipes. |

### Campaigns (Marketing)

| Aspect | Definition |
|--------|------------|
| **Canonical transactional source** | `workspace_campaigns` (workspace_models.py) |
| **Read projection** | `workspace_campaigns` via `list_campaigns()` / `get_campaign()` |
| **Mutation authority** | Bridge MCP `carabiner_propose_write` → policy gate → audit log → execute |
| **Synchronization direction** | Workspace is canonical |
| **Lifecycle** | Research → Drafting → Review → Live → Completed |
| **Deletion behavior** | Hard delete via `delete_campaign()` |

### Recipes

| Aspect | Definition |
|--------|------------|
| **Canonical transactional source** | `recipes` + `recipe_components` + `recipe_component_ingredients` + `recipe_steps` (models.py — operational, modernist format) |
| **Read projection** | `workspace_recipes` (workspace_models.py) |
| **Mutation authority** | Bridge MCP `carabiner_propose_write` → policy gate → audit log → execute |
| **Synchronization direction** | Operational is canonical; workspace is a summary projection |
| **Lifecycle** | Created → linked to menu_items → ingredients tracked via recipe_components |
| **Deletion behavior** | Hard delete via `delete_recipe()` (cascade components) |

### Locations

| Aspect | Definition |
|--------|------------|
| **Canonical transactional source** | `workspace_locations` (workspace_models.py) |
| **Read projection** | `workspace_locations` via `list_locations()` / `get_location_by_slug()` |
| **Mutation authority** | Bridge MCP `carabiner_propose_write` (admin only) |
| **Synchronization direction** | Workspace is canonical |
| **Lifecycle** | Single location for beta (cOS Test Kitchen); multi-location schema ready |
| **Deletion behavior** | Hard delete via `delete_location()` (cascade workspace_*) |

### Action Log

| Aspect | Definition |
|--------|------------|
| **Canonical transactional source** | `action_log` (models.py — operational, APPEND-ONLY) |
| **Read projection** | `action_log` via runtime state push (Socket.IO) |
| **Mutation authority** | Bridge internals only (no external mutation) |
| **Synchronization direction** | Append-only; no sync needed |
| **Lifecycle** | Created on every propose/commit/dismiss action; never updated, never deleted |
| **Retention** | Permanent (audit trail) |

### Chat Context

| Aspect | Definition |
|--------|------------|
| **Canonical transactional source** | `chat_context_id` column on all workspace_* tables (added by `011_chat_context`) |
| **Read projection** | Filtered by `chat_context_id` |
| **Mutation authority** | Bridge sets `chat_context_id` on creation; never updated |
| **Synchronization direction** | Bi-directional: chat context links to workspace entities, workspace entities link back via chat_context_id |
| **Lifecycle** | Set on creation, immutable |

## Mutation Authority Summary

All mutations to workspace_* tables go through:
1. **Bridge MCP** (`carabiner_propose_write` at `/mcp`)
2. **Policy gate** (`carabiner/runtime/policy.py` — verb × resource allowlist)
3. **Audit log** (`action_log` table — append-only)
4. **Execute** (repository function)

Direct database writes to workspace_* tables bypass this chain and should be treated as a security violation. The only direct writes should be:
- Alembic migrations (DDL)
- Seed scripts (one-time data loading)
- Backup/restore operations

## Read Projection Summary

All reads from workspace_* tables go through:
1. **Bridge HTTP API** (`/api/<resource>` at :8641)
2. **Bridge MCP** (`carabiner_read` at `/mcp`)
3. **Bridge Socket.IO** (`state_push` for live updates)

Direct database reads from workspace_* tables should only be used by:
- Alembic migrations
- Seed scripts
- Backup/restore operations
- Diagnostic queries (read-only, no joins to other tables)

## Lifecycle Policies

### Soft Delete
**None.** All workspace_* entities use hard delete. Soft delete would complicate the action card lifecycle and audit trail.

### Audit Trail
**All mutations are logged.** The `action_log` table records:
- timestamp
- actor (chat_context_id or "system")
- verb (create/update/delete)
- resource (workspace_* table name)
- resource_id
- proposed data
- commit status

### Retention
- `workspace_*` data: permanent (business data)
- `action_log`: permanent (audit trail, never pruned)
- `chat_log`: 30 days (configurable in hermes config)
- `daily_food_cost`: permanent (historical analysis)

## Consolidation Roadmap

### Phase 2 (current)
- Document ownership (this file)
- Decide workspace-model future (DB-007)

### Phase 8 (modularity)
- Consider consolidating operational tables that are NEVER read (e.g., `orders`, `invoices`) into the workspace_models only
- Add migration to drop unused operational tables (if confirmed dead)

### Phase 9 (product)
- Add cross-location data ownership (workspace_locations is already schema-ready)
- Add multi-tenant data isolation (currently single-tenant for beta)
