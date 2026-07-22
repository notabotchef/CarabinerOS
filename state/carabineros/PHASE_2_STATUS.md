# Phase 2 — Database and Data Ownership

## Status: IN PROGRESS

### Diagnosis Complete

**Root cause of "stale page" report**: My Cycle 1 changes (UI-001, UI-002, CFG-001) were committed to `strategic-implementation` branch but NOT to `main`. The Docker frontend image was built from `main` (commit 5437b5d), so the deployed frontend did NOT have:
- Keyboard accessibility (Enter/Space activation)
- aria-expanded attributes
- useDashboardSummary() hook (was showing mock fallbacks instead of live API data)
- Config alignment fixes

**Fix applied (2026-07-22 15:41 CDT)**:
1. Merged `strategic-implementation` into `main` (merge commit 79d91f4)
2. Pushed to origin/main
3. Rebuilt frontend Docker image (`carabiner-hermes-frontend:latest`)
4. Restarted `carabiner-hermes-frontend-1` container

**Verification (Playwright browser test)**:
- Page loads with full greeting, Daily Brief, and KPI cards
- KPI cards show LIVE data: Orders: 3 (2 needs approval), Food Cost: 35.2% (1 high pressure), Prep: 1/3 (2 remaining)
- Daily Brief rows are now `<button>` elements (keyboard accessible)
- KPI cards are now `<button>` elements with accessible labels
- Sidebar opens on menu button click
- Navigation to `/orders` loads page with live data
- Socket.IO connects and receives state_push events
- No JavaScript errors in console

## Tickets

| Ticket | Title | Status | Branch |
|--------|-------|--------|--------|
| DB-001 | Audit Alembic revision graph | DONE | ticket/DB-001-audit-graph |
| DB-002 | Test clean database upgrade | PENDING | ticket/DB-002-clean-upgrade |
| DB-003 | Test restored database upgrade | PENDING | ticket/DB-003-restored-upgrade |
| DB-004 | Resolve duplicate repository methods | PENDING | ticket/DB-004-dup-methods |
| DB-005 | Clean confirmed minor model issues | DONE (commit 9a51928) | n/a |
| DB-006 | Write DATA_OWNERSHIP.md | PENDING | ticket/DB-006-data-ownership |
| DB-007 | Decide workspace-model future | PENDING | ticket/DB-007-workspace-future |

## DB-001 Findings

### Critical: Multiple 010 Revisions

5 files all share `revision = "010"` and `down_revision = "009"`:
- `010_inventory_functional_fields.py`
- `010_invoices_phase1.py`
- `010_marketing_phase1_columns.py`
- `010_menu_engineering_phase1.py`
- `010_prep_module_upgrade.py`

This creates 5 parallel branches from 009 that Alembic cannot resolve. The `011_chat_context` migration has `down_revision = "008"` (bypassing all 010s), so Alembic sees two heads: `010` (5-way fork) and `011_chat_context`.

### Current State
- Live DB stamped at: `011_chat_context`
- Head(s): `010` (5-way) and `011_chat_context`
- The `011_chat_context` migration already incorporates schema changes from 4 of 5 orphaned 010 files (inventory, menu, invoices, marketing) using `ADD COLUMN IF NOT EXISTS`
- The `010_prep_module_upgrade` schema changes (prep_lists extensions, prep_stations table) are NOT in 011_chat_context

### Gap: Prep Module Schema

The `010_prep_module_upgrade.py` adds:
- `prep_lists`: expected_covers, generated_by, approved_by, approved_at
- `prep_list_items`: station, assigned_to, est_minutes, sort_order, service_lane, notes, unit, name
- New table: `prep_stations`

The live DB has these columns (the API returns prep data with `station`, `service_lane`, `task`, `readiness`, etc.), so the columns exist. They were likely created by the ORM's `Base.metadata.create_all()` on bridge startup, or by a manual SQL script. But the Alembic migration history does not record them.

### Recommendation
1. **Do NOT rewrite applied migration history** — the live DB is stamped at `011_chat_context`, rewriting it would break production
2. **Fix the orphaned 010 files** by giving them unique revision IDs and chaining them properly: `010a → 010b → 010c → 010d → 010e → 011_chat_context`
3. **Or**: mark the orphaned 010 files as superseded by adding `branch_labels` and `depends_on` to make Alembic ignore them
4. **Add prep module schema to 011_chat_context** if columns are missing (they appear to exist, verify before adding)

### Exit Gate Status

| Gate | Status | Notes |
|------|--------|-------|
| One valid migration head | NO | Two heads: 010 (5-way fork) and 011_chat_context |
| Fresh + restored upgrades pass | PENDING | DB-002/DB-003 |
| Data ownership unambiguous | PENDING | DB-006 |
