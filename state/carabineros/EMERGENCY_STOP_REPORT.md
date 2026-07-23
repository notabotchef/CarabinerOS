# CarabinerOS — EMERGENCY STOP Report (RESTART-DOCKER)

**Date**: 2026-07-23
**Trigger**: Operator §4 hard stop conditions met during RESTART-DOCKER execution.
**Ticket**: t_8375d217 RESTART-DOCKER (status: blocked)
**Severity**: CRITICAL — data loss

---

## Summary

Per operator §4 stop conditions: "PostgreSQL data appears missing; migration revision changes unexpectedly" — BOTH conditions met. RESTART-DOCKER was executing as authorized. Docker compose up succeeded, all 5 containers came Up. However, the PostgreSQL `carabiner-hermes_pgdata` named volume was created FRESH (not attached from the previous deployment) and is empty. The original 42-table carabiner DB is LOST.

**Operator stop conditions met**: STOPPED IMMEDIATELY. No further dispatch.

---

## Container States (when stack was Up)

| Container | Status | Ports | Image |
|-----------|--------|-------|-------|
| carabiner-hermes-postgres-1 | Up 55s (healthy) | 0.0.0.0:5432→5432 | postgres:16-alpine |
| carabiner-hermes-bridge-1 | Up 49s (healthy) | 0.0.0.0:8641→8641 | carabiner-hermes-bridge |
| carabiner-hermes-hermes-1 | Up 44s (healthy) | 0.0.0.0:8642→8642 | carabiner-hermes-hermes |
| carabiner-hermes-frontend-1 | Restarting (1) — first Turbopack compile | 3000 | carabiner-hermes-frontend |
| carabiner-hermes-nginx-1 | Up 43s | 0.0.0.0:8090→80 | nginx:alpine |

## Endpoint Results

| Endpoint | HTTP | Time |
|----------|------|------|
| Bridge /api/health | 200 | 0.004s |
| Bridge /api/orders | 200 | 0.593s |
| Bridge /csrf_token | 200 | 0.005s |
| Nginx / (frontend) | 502 | 3.064s (frontend still compiling) |
| Nginx /api/orders | 200 | 0.005s |

## Database Revision

**CRITICAL FAILURE**: 
- `alembic_version` table DOES NOT EXIST in the running PostgreSQL
- `SELECT version_num FROM alembic_version` → ERROR: relation "alembic_version" does not exist
- Table count: **0** (should be 42)

Expected: `011_chat_context`

## PostgreSQL Data Preservation Result

**FAILED — DATA LOST**

The `carabiner-hermes_pgdata` named volume was created at 2026-07-23T18:05:52 (TODAY). This is NOT the original volume from the previous deployment. The original volume and its data are GONE.

Original data that was lost:
- 42 tables (workspace_orders, workspace_inventory, workspace_invoices, workspace_food_cost, workspace_campaigns, workspace_menu, workspace_prep, workspace_recipes, etc.)
- 3 workspace_orders (Coastal Produce, Prime Meats, Lakefront Seafood)
- 5 workspace_invoices
- 3 workspace_food_cost entries (Avocado Toast, Short Rib Pappardelle, Oyster Board)
- 3 workspace_campaigns
- 3 inbox_items
- 12+ action_log rows (including war-room commits and OOM-fix events)
- alembic_version = 011_chat_context

## Backup Availability

| Backup | Status | Notes |
|--------|--------|-------|
| `/root/carabineros/var/rollback/strategic-impl-20260722_101159/carabiner_db.sql` (133KB, SHA-256: 7c91b5453c9694238b59ec071756991bb539dc7bb0ab28c740bd27eda76e7e8c) | **GONE** — directory does not exist | Created in Cycle 1, lost between cycles |
| `/tmp/baseline.sql` (55798 bytes, 42 tables) | **AVAILABLE** | Dated 2026-07-23 14:57; has alembic_version=011_chat_context but 0 workspace_orders — DIFFERENT DB instance (sidecar) |
| `/tmp/sidecar.sql` (55798 bytes) | **AVAILABLE** | Identical to baseline.sql; same sidecar DB |
| `carabiner_db_sidecar` container (port 5433) | **AVAILABLE** | Has alembic_version=011_chat_context but 0 workspace_orders — not the carabiner data we need |

The `/tmp/baseline.sql` and sidecar are from a DIFFERENT database (not the carabiner workspace data). They are not useful for restoring the lost carabiner data.

## Stop Conditions Triggered

Per operator §4:
- "PostgreSQL data appears missing" — **YES** (0 tables, no alembic_version)
- "migration revision changes unexpectedly" — **YES** (was 011_chat_context, now no version)

## Actions Taken

1. **STOPPED** docker compose immediately
2. All 5 carabiner containers are now `Exited`
3. Ticket t_8375d217 marked `blocked` with detailed result
4. Stack preserved (not removed) for forensic investigation
5. Volume `carabiner-hermes_pgdata` preserved (empty but intact)

## Restart Counts

| Container | RestartCount |
|-----------|--------------|
| postgres-1 | 0 |
| bridge-1 | 0 |
| hermes-1 | 0 |
| frontend-1 | 1 (first-time Turbopack compile) |
| nginx-1 | 0 |

No OOM-137 exits. No crash loops. The containers came up cleanly — the issue is that the volume was empty, not that containers failed.

## Data Recovery Options

1. **From `/tmp/baseline.sql`**: Does NOT have carabiner workspace data (sidecar DB)
2. **From sidecar `carabiner_db_sidecar` container**: Same as above — no carabiner workspace data
3. **From anywhere else**: NO KNOWN BACKUP EXISTS

**The original carabiner DB data appears to be PERMANENTLY LOST.**

## Authorization Status

Per operator §14: "Stop after returning that report."

**STOPPED.** Awaiting operator authorization before:
- Any further action
- Any ticket dispatch
- Any attempt to recreate the database from scratch (would need seed data)

## Outstanding Operator Questions

1. Is there a backup of the carabiner data on another system or in object storage that I'm not aware of?
2. Should the database be re-seeded from `seed_functional.py` or `seed_realistic.py` (which exist in carabiner/db/)?
3. Should the lost data be recreated manually, or is the seed data sufficient for re-establishing the demo state?
4. Should the docker-compose stack be removed and the pgdata volume inspected for forensic recovery?
5. The Cycle 1 backup directory `/root/carabineros/var/rollback/strategic-impl-20260722_101159/` is missing. Was it deleted intentionally during one of the shutdown cycles, or lost to filesystem cleanup?
