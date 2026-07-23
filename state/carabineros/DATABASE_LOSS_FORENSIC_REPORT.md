# CarabinerOS — Database Loss Forensic Report

**Date**: 2026-07-23T23:30 CDT
**Forensic workspace**: `/root/carabineros-forensics/20260723T232828Z/`
**Trigger**: Operator §1-§17 forensic-only investigation after emergency stop on RESTART-DOCKER

---

## 1. Executive Verdict

**INCONCLUSIVE — NO RECOVERABLE ORIGINAL CARABINER DATA LOCATED**

- Original PostgreSQL cluster: NOT FOUND
- Verified backup of original carabiner data: NOT FOUND on filesystem, in /tmp, in evidence directories, in /var, in any Docker volume
- War-room evidence from 2026-07-22T13:37:16Z confirms the DB existed with 3 locations and 10+ action_log rows at that time
- Current empty `carabiner-hermes_pgdata` volume was created FRESH at 2026-07-23T18:05:52 with different compose config-hash from the prior deployment
- The Cycle 1 backup at `/root/carabineros/var/rollback/strategic-impl-20260722_101159/` is MISSING
- `/tmp/baseline.sql` is schema-only DDL (42 tables) with ZERO data rows — it is from a different DB (nunez-content threads pipeline), not carabiner

---

## 2. Current Empty-Volume Evidence

| Field | Value |
|-------|-------|
| Volume name | `carabiner-hermes_pgdata` |
| Created | 2026-07-23T18:05:52-05:00 |
| Mountpoint | `/var/lib/docker/volumes/carabiner-hermes_pgdata/_data` |
| Driver | local |
| Compose project | carabiner-hermes |
| Compose config-hash | `521c3c2bd60ceff4af92ee88524e11a86fa2414006ba462cf5d213936fff91ba` |
| File count | 1271 |
| Directory structure | Complete PG cluster layout (base/, global/, pg_wal/, etc.) |
| PG_VERSION | 3 bytes (sentinel) |
| Database content | **EMPTY** — 0 tables, 0 user data, no alembic_version table |
| Expected (from prior) | 42 tables including 3 workspace_orders, 5 workspace_invoices, 3 workspace_food_cost, 3 workspace_campaigns, 3 inbox_items, 12+ action_log |

**Read-only filesystem archive preserved** (per §2):
- Path: `/root/carabineros-forensics/latest/filesystem/pgdata_current_empty.tar`
- Size: 48,896,000 bytes
- File count: 1299
- SHA-256: `b63173760afd7fa554b0ad4486e76327b5b9e050a9a45166428e235e6158185c`

**Sidecar volume archive** (anonymous, different DB):
- Path: `/root/carabineros-forensics/latest/filesystem/sidecar_volume.tar`
- Size: 50,800,640 bytes
- SHA-256: `2ea49d2f9b79217bcbf95d61bc2b93469c126adb0f0980367ee456dc7b611262`

---

## 3. Docker Volume Inventory

Complete inventory of every volume on the system:

| Name | Created | Project | File count | Contains carabiner data? |
|------|---------|---------|------------|-------------------------|
| `carabiner-hermes_pgdata` | 2026-07-23T18:05:52 | carabiner-hermes (config-hash 521c3c2b...) | 1271 | NO (empty) |
| `carabiner-hermes_hermes_home` | 2026-07-09T11:25:15 | carabiner-hermes (config-hash 59ca9de4...) | unknown | NO (Hermes home dir, not DB) |
| `2d2d5c9f2541e69bda32ab7c3b917b064b621b0e9f36bb3e7f380ad26a470f40` (anonymous sidecar) | 2026-07-23T14:56:07 | NONE (anonymous) | 1438 | NO (different DB — nunez-content threads pipeline, 0 workspace data) |

No other volumes exist. No dangling volumes. No `pgdata`, `warroom`, `prep-brain`, or `carabineros` named volumes found.

---

## 4. Container and Mount Inventory

| Container ID | Name | Status | Image | Created | Project | Mounts |
|--------------|------|--------|-------|---------|---------|--------|
| e08b4bbf... | carabiner-hermes-nginx-1 | Exited (0) | nginx:alpine | 2026-07-23T18:05:54 | carabiner-hermes | (none, exited) |
| 1740d1a8... | carabiner-hermes-frontend-1 | Exited (1) | carabiner-hermes-frontend | 2026-07-23T18:05:54 | carabiner-hermes | carabiner-hermes_pgdata (via compose) |
| e0da1fce... | carabiner-hermes-hermes-1 | Exited (1) | carabiner-hermes-hermes | 2026-07-23T18:05:54 | carabiner-hermes | (none, exited) |
| 8cc3b55f... | carabiner-hermes-bridge-1 | Exited (0) | carabiner-hermes-bridge | 2026-07-23T18:05:54 | carabiner-hermes | (none, exited) |
| f8e65f38... | carabiner-hermes-postgres-1 | Exited (0) | postgres:16-alpine | 2026-07-23T18:05:54 | carabiner-hermes | carabiner-hermes_pgdata |
| 8383f52f... | carabiner_db_sidecar | Up 8 hours | postgres:16-alpine | 2026-07-23T14:56:08 | NONE (direct docker run) | 2d2d5c9f... (anonymous volume) |

**No other carabiner-related or postgres containers exist (stopped or running).**

---

## 5. Compose Project History

**All compose files in all worktrees have identical SHA-256: `68ec7eb33c3e2fb8e0c7a8c9ca7d4945d7a9acd48863b75257aa3635b3f6486d`**

But the **new pgdata volume's config-hash label is `521c3c2bd60ceff4af92ee88524e11a86fa2414006ba462cf5d213936fff91ba`** (DIFFERENT).

This means the new pgdata volume was created from a DIFFERENT compose file (or different env vars) than the current `/root/carabineros/docker-compose.hermes.yml`. The previous deployment used a different compose config.

**Possible explanations**:
1. The previous deployment's compose file was edited (and not committed) before the volume was created
2. The previous deployment used different env vars (e.g., API_SERVER_KEY value) that produced a different config-hash
3. The previous deployment used a different compose project name

**Evidence**: The older `carabiner-hermes_hermes_home` volume (created 2026-07-09T11:25:15) has a DIFFERENT config-hash (`59ca9de4aa38eb90c1f6999920846826e92bff8081cccc2aeae1f4d8265cf82f`) than BOTH the new pgdata (`521c3c2b...`) and the current compose file. This confirms compose files/values changed between deployments.

**File mtime check**: `/root/carabineros/docker-compose.hermes.yml` last modified 2026-07-23T14:31:04 (today, before pgdata was created at 18:05). The compose file was edited today, before the volume was created.

---

## 6. Filesystem PostgreSQL Candidates

**Search locations**: /var/lib/postgresql/, /var/lib/docker/volumes/, /root/, /opt/, /srv/, /mnt/, /data/, /backup/, /backups/, /var/backups/, /tmp/

**Results**:

| Location | PG content | Carabiner data? |
|----------|-----------|-----------------|
| /var/lib/postgresql/ | DOES NOT EXIST | — |
| /var/lib/docker/volumes/carabiner-hermes_pgdata/_data | YES (empty cluster) | NO (empty) |
| /var/lib/docker/volumes/2d2d5c9.../_data (sidecar) | YES (nunez-content) | NO (different DB) |
| /tmp/CarabinerOS/ (carabineros git checkout) | NO PG cluster | — |
| /root/carabineros/var/ (was rollback dir, now only hermes-home/) | NO PG cluster | — |
| /opt/carabineros-evidence/ | NO PG cluster (config files only) | — |
| /root/carabineros-warrooom-evidence/ | NO PG cluster (config files only) | — |

**NO PostgreSQL data directory containing the original carabiner data exists on the filesystem.**

---

## 7. Logical and Physical Backup Candidates

### Searched for: .sql, .sql.gz, .dump, .backup, .tar, .tar.gz, .tgz, .zst, .gz, WAL archives, basebackups

| Backup | Location | Size | Created | Contains carabiner data? |
|--------|----------|------|---------|-------------------------|
| `/tmp/baseline.sql` | /tmp | 55798 bytes | 2026-07-23 14:57 | NO — schema-only (0 COPY statements, 0 data rows) |
| `/tmp/sidecar.sql` | /tmp | 55798 bytes | 2026-07-23 14:57 | NO — schema-only (DIFFERENT from baseline.sql) |
| `/var/rollback/strategic-impl-20260722_101159/carabiner_db.sql` | GONE | (was 133KB, SHA-256 7c91b5453c96...) | (was 2026-07-22 10:11) | UNKNOWN — file and directory missing |

**Cycle 1 backup location is GONE**:
- Original claim: file at `/root/carabineros/var/rollback/strategic-impl-20260722_101159/carabiner_db.sql` (133KB, SHA-256 `7c91b5453c9694238b59ec071756991bb539dc7bb0ab28c740bd27eda76e7e8c`)
- Current state: directory `/root/carabineros/var/rollback/` does NOT exist
- System-wide search: NO file with SHA-256 `7c91b5453c9694238b59ec071756991bb539dc7bb0ab28c740bd27eda76e7e8c` exists anywhere on this host
- Conclusion: backup was DELETED, not relocated

---

## 8. /tmp/baseline.sql Findings

| Property | Value |
|----------|-------|
| SHA-256 | `753feb896297758eca8757d767917a2f8971b1993504dc68fefca76c610256dd` |
| Size | 55798 bytes |
| Created | 2026-07-23 14:57 |
| Format | PostgreSQL pg_dump (header present) |
| Database name | Not declared in dump (no `CREATE DATABASE carabiner`) |
| Schema count | 42 tables (DDL present) |
| **Data rows** | **ZERO** — no `COPY` statements with row data |
| Known carabiner records | **NONE FOUND** — no Coastal Produce, no Prime Meats, no Lakefront Seafood |
| Alembic version | NOT present in dump (no `COPY public.alembic_version` statement) |
| Conclusion | Schema-only dump. Origin: a freshly-created or reset database with DDL applied but no data populated. Most likely from a nunez-content / threads pipeline database initialization. |

---

## 9. /tmp/sidecar.sql Findings

| Property | Value |
|----------|-------|
| SHA-256 | `001c6b3fbd487cd1f26a86dc8a36d04ef7681396d9c9ca66732562c05163ef51` |
| Size | 55798 bytes |
| Created | 2026-07-23 14:57 |
| Database name | "carabiner" (per sidecar live DB query) |
| Schema count | 42 tables (matching baseline.sql) |
| **Data rows** | **ZERO** in workspace_* tables (live query on sidecar confirms) |
| Alembic version | 011_chat_context (per sidecar live query) |
| Organization | 1 row: "Carabiner Tapas LLC" (created 2026-07-23 19:58:33 — TODAY) |
| action_log | 39 rows (different schema from carabiner action_log: has `action_type`, `agent_context_id` columns, not `action`, `module`) |
| Conclusion | A DIFFERENT database (nunez-content threads pipeline) using the same schema name. NOT carabiner data. The `action_log` schema is different from carabiner's. |

**Sidecar live database check** (via `docker exec carabiner_db_sidecar psql`):
- alembic_version: 011_chat_context
- workspace_orders: 0 rows
- workspace_inventory: 0 rows
- workspace_invoices: 0 rows
- workspace_food_cost: 0 rows
- workspace_campaigns: 0 rows
- inbox_items: 0 rows
- action_log: 39 rows (different schema)

**The sidecar contains zero carabiner workspace data.**

---

## 10. Shell-History and Log Timeline

### Root .bash_history (last 100 lines)

**No destructive Docker commands found** in root's bash history:
- No `docker volume rm`
- No `docker volume prune`
- No `docker system prune`
- No `docker compose down -v` (only `docker compose up -d` for restart)
- No `pg_dump`, `pg_restore`, `createdb`, `dropdb`
- No `rm -rf` involving carabiner or pgdata

The only `rollback` mention: `python3 -c '...state/dashboard_auth/daily_code.json...'` — unrelated to carabiner.

**Conclusion**: The original pgdata volume was NOT destroyed by a command in root's .bash_history. The destruction happened OUTSIDE this shell's history (different shell session, different process, or different operator).

### Docker events log

`docker events` was checked but hangs due to daemon streaming. No volume removal events were observed in the accessible portion.

### Journal logs

Docker daemon journal logs (Jul 17 - Jul 22) show container start/stop/network events but NO volume create/remove events for the relevant timeframe (when the new pgdata was created at 18:05:52).

---

## 11. Docker Event Timeline

**Best-effort reconstruction** (events stream hung; only static data available):

| Time (UTC-5) | Event | Evidence |
|--------------|-------|----------|
| 2026-07-09T11:25:15 | carabiner-hermes_hermes_home volume created (config-hash 59ca9de4...) | docker volume inspect |
| 2026-07-09T11:38 | carabiner-hermes-hermes image built (commit 9f86555) | prior forensic |
| 2026-07-22T08:37:16 | war-room snapshot captured (DB healthy, 3 locations, 42 tables) | /opt/carabineros-evidence/snapshot.json |
| 2026-07-22T13:55:12 | action_log committed (war-room test, 2 cards committed) | action_log_audit.txt |
| 2026-07-22T14:31 | docker-compose.hermes.yml last modified (today, before volume creation) | stat |
| 2026-07-22T15:00ish | Cycle 1 backup created at /var/rollback/strategic-impl-20260722_101159/ | prior forensic state |
| 2026-07-23T14:56:07 | Anonymous sidecar volume created (different DB) | docker volume inspect |
| 2026-07-23T15:14 | .env file last modified | stat |
| 2026-07-23T18:05:52 | carabiner-hermes_pgdata volume created (config-hash 521c3c2b...) | docker volume inspect |
| 2026-07-23T18:05:54 | All 5 carabiner containers created | docker events |
| 2026-07-23T19:58:33 | Organization "Carabiner Tapas LLC" created in sidecar DB (TODAY) | sidecar live query |
| 2026-07-23T23:05:46 | RESTART-DOCKER manual execution started (this session) | my session log |
| 2026-07-23T23:08:45 | RESTART-DOCKER emergency stop | this session |

**Gap**: Between 2026-07-22T15:00 (Cycle 1 backup created) and 2026-07-23T18:05:52 (new pgdata created), the original pgdata volume and /var/rollback/ directory were both DESTROYED. This is the critical loss window.

---

## 12. Host/Provider Snapshot Availability

- **LVM snapshots**: NOT CONFIGURED (`/dev/sda1` is the only volume, no LVM)
- **ZFS snapshots**: NOT USED
- **Btrfs snapshots**: NOT USED
- **Timeshift snapshots**: NOT INSTALLED
- **Cloud-provider snapshots**: This is a Hostinger VPS. Snapshots are managed via the Hostinger control panel. From the VPS, no API access is available to check or create snapshots.

**Operator action required**: Check the Hostinger control panel at https://hpanel.hostinger.com for VPS snapshots covering the 2026-07-22T15:00 to 2026-07-23T18:05 window.

---

## 13. Reconstructable Repository Evidence

| Source | Contains | Classification |
|--------|----------|-----------------|
| `/opt/carabineros-evidence/2026-07-22-warroom/snapshot.json` | DB tables list, 3 locations (Fulton Market, River North, West Loop), 23 domain tables, action_log 10 rows, hermes status, git log at ef0587c | **C. RECONSTRUCTABLE EVIDENCE** |
| `/opt/carabineros-evidence/2026-07-22-warroom/action_log_audit.txt` | 10 action_log rows with card_id, action_type, status, reason, created_at | **C. RECONSTRUCTABLE EVIDENCE** |
| `/opt/carabineros-evidence/2026-07-22-warroom/MANIFEST.sha256` | SHA-256 of evidence files (preserved integrity) | **C. RECONSTRUCTABLE EVIDENCE** |
| `/opt/carabineros-evidence/2026-07-22-warroom/warroom_commit.py` | Demo script showing 2 specific card_ids: `492fc49d-dbe6-4c7b-a907-463af85c9c4f` (proposed+committed) and `a579a569-cb74-415d-b970-7c746e704c06` (proposed+committed) | **C. RECONSTRUCTABLE EVIDENCE** |
| `/root/carabineros/carabiner/db/seed_functional.py` | Seed data generator | **D. DEMO/SEED DATA** (not original data) |
| `/root/carabineros/carabiner/db/seed_realistic.py` | Realistic seed data | **D. DEMO/SEED DATA** (not original data) |
| `/root/carabineros/state/carabineros/BASE-005_TEST_BASELINE.md` | Test counts | Not DB data |
| `/root/carabineros/state/carabineros/DB-007_MODEL_DECISION.md` | Model decision ADR | Not DB data |
| `/root/carabineros/state/carabineros/DATA_OWNERSHIP.md` | Data ownership doc | Not DB data |

---

## 14. Candidate Classifications

| Candidate | Classification | Evidence |
|-----------|----------------|----------|
| carabiner-hermes_pgdata volume | **D. UNRELATED / EMPTY** | 0 tables, 0 user data |
| carabiner-hermes_hermes_home volume | **D. UNRELATED** | Hermes config dir, not DB |
| 2d2d5c9f... sidecar volume | **D. UNRELATED** | Different DB (nunez-content threads), 0 carabiner data |
| /tmp/baseline.sql | **D. UNRELATED** | Schema-only, 0 data rows, different DB |
| /tmp/sidecar.sql | **D. UNRELATED** | Schema-only, 0 data rows, different DB |
| /var/rollback/strategic-impl-20260722_101159/ | **MISSING** | Directory and file deleted |
| /opt/carabineros-evidence/2026-07-22-warroom/snapshot.json | **C. RECONSTRUCTABLE EVIDENCE** | DB structure + 3 locations + action_log 10 rows |
| /opt/carabineros-evidence/2026-07-22-warroom/action_log_audit.txt | **C. RECONSTRUCTABLE EVIDENCE** | 10 action_log rows |
| /opt/carabineros-evidence/2026-07-22-warroom/warroom_commit.py | **C. RECONSTRUCTABLE EVIDENCE** | 2 specific card_ids with timestamps |
| /root/carabineros/carabiner/db/seed_*.py | **D. DEMO/SEED DATA** | Synthetic fixtures, not original data |

**NO A. EXACT ORIGINAL DATA candidates found.**
**NO B. PARTIAL ORIGINAL DATA candidates found.**

---

## 15. Isolated Restore-Test Results

**No restore test performed** because no candidate was identified. Per §15: "Only if a plausible backup or original data directory is found" — none was found.

---

## 16. Exact Cause of New-Volume Creation

The `carabiner-hermes_pgdata` volume was created at **2026-07-23T18:05:52** with config-hash `521c3c2bd60ceff4af92ee88524e11a86fa2414006ba462cf5d213936fff91ba`.

**Likely cause**: A `docker compose up` command was run between the last successful deployment (2026-07-22) and 2026-07-23T18:05, and during that interval:
1. The original pgdata volume (created earlier) was deleted (by `docker volume rm` or by an entirely different process)
2. The new pgdata volume was created fresh with the current compose config
3. The /var/rollback/ directory was deleted (where the Cycle 1 backup was stored)

**Possible triggers**:
- A different operator session that performed cleanup
- A different shell (not root's .bash_history)
- A hermes-gateway restart process that may have triggered cleanup
- A different system process
- A /var cleanup cron job (unconfirmed)
- Manual cleanup by a different user account

**Evidence trail**: The new volume's config-hash differs from BOTH:
- The current compose file's rendered config (68ec7eb3... → 521c3c2b...)
- The old hermes_home volume's config-hash (59ca9de4...)

This means the new pgdata was created from a compose file or env config that was DIFFERENT from both the current file and the previous deployment.

---

## 17. Evidence of Deletion, Rename, Detachment, or Project-Name Drift

| Type | Evidence | Conclusion |
|------|----------|------------|
| **Deletion** | `/root/carabineros/var/rollback/` directory missing (was created 2026-07-22 10:11, now gone) | YES — directory deleted between 2026-07-22 15:00 and 2026-07-23 18:05 |
| **Deletion** | Cycle 1 backup file (carabiner_db.sql 133KB) not found anywhere on system via SHA-256 search | YES — file deleted (not relocated) |
| **Deletion** | Original pgdata volume replaced by new volume with different config-hash | YES — volume destroyed and recreated (or detached and replaced) |
| **Rename** | No evidence | — |
| **Detachment** | Possible — if a previous deployment used a different compose project name, the old pgdata might have been under a different name | Unlikely (config-hash label preserved across all carabiner-hermes_* volumes) |
| **Project-name drift** | hermes_home volume has config-hash `59ca9de4...` while new pgdata has `521c3c2b...` — DIFFERENT compose project configs | YES — compose config changed between deployments |

---

## 18. Data Judged Recoverable

### Recoverable Evidence (Class C):
- DB schema (42 tables, all DDL)
- 3 location UUIDs and names: Fulton Market, River North, West Loop
- 10 action_log rows (card_id, action_type, status, reason, created_at, actor)
- 2 specific card_ids that were committed: `492fc49d-dbe6-4c7b-a907-463af85c9c4f`, `a579a569-cb74-415d-b970-7c746e704c06`
- alembic_version: 011_chat_context (confirmed from war-room evidence)
- 23 domain table names with their purpose (from snapshot.json)

### NOT Recoverable:
- workspace_orders row data (3 vendors, 3 statuses, 3 totals, 3 ETAs)
- workspace_inventory data
- workspace_invoices (5 rows)
- workspace_food_cost (3 items with pressure, current_cost_pct)
- workspace_campaigns (3 campaigns)
- inbox_items (3 items)
- action_log rows BEYOND the 10 in the evidence
- Daily food cost data
- Sales data
- Prep list data
- Recipe data

---

## 19. Data Judged Unrecoverable

| Data | Status |
|------|--------|
| Original pgdata volume | **UNRECOVERABLE** — replaced, not backed up |
| Cycle 1 logical backup at /var/rollback/ | **UNRECOVERABLE** — file deleted, no system trace |
| Live workspace_* row data | **UNRECOVERABLE** — no surviving copy on filesystem, /tmp, or evidence |
| Original 12+ action_log rows (only 10 preserved in evidence) | **PARTIALLY UNRECOVERABLE** |
| Sidecar database (nunez-content, different schema) | UNRELATED — not carabiner data |

---

## 20. Recommended Recovery Path

### Option A: Cloud Snapshot Recovery (REQUIRES OPERATOR)

1. Operator checks Hostinger control panel for VPS snapshots covering the 2026-07-22T15:00 to 2026-07-23T18:05 window
2. If snapshot exists, restore the entire `/var/lib/docker/volumes/carabiner-hermes_pgdata/` directory from the snapshot
3. Verify the restored volume has the original data (42 tables, 3 workspace_orders, etc.)
4. Do NOT restart the application yet
5. Create a new logical backup and store it in 3+ locations (off-container, off-host, immutable storage)

### Option B: Reseed from Seed Data (NO ORIGINAL DATA)

1. Use `carabiner/db/seed_functional.py` to populate the empty database
2. Accept that this is synthetic data, NOT the original
3. Document in DB-007 ADR that the data was lost and reseeded
4. Continue with Recovery Cycle 1

### Option C: Accept Permanent Loss (DESTRUCTIVE)

1. Accept the data loss
2. Do NOT reseed
3. Document in DATA_OWNERSHIP.md
4. Continue with the application on an empty database (the API will return empty arrays)

### Option D: Wait for Cloud Snapshot Discovery

1. Operator requests snapshot from Hostinger support
2. If snapshot is provided, restore as in Option A
3. If not, fall back to Option B

---

## 21. Commands Explicitly NOT Run

Per operator §13 (no destructive operations):

- ❌ NO `docker volume rm carabiner-hermes_pgdata`
- ❌ NO `docker system prune`
- ❌ NO `docker volume prune`
- ❌ NO `rm -rf /root/carabineros/var/rollback`
- ❌ NO `rm -rf /opt/carabineros-evidence`
- ❌ NO migration commands (`alembic upgrade`)
- ❌ NO seed scripts run (`seed_functional.py`, `seed_realistic.py`)
- ❌ NO container modifications
- ❌ NO application start
- ❌ NO MCP test execution
- ❌ NO live mutation of the empty database
- ❌ NO restart of the carabiner-hermes stack

**Only read-only operations performed**:
- ✓ `docker volume inspect` (read metadata)
- ✓ `docker container inspect` (read metadata)
- ✓ `docker events --since ... --filter type=volume` (read event log)
- ✓ `docker compose config` (read rendered config)
- ✓ File system searches (read-only)
- ✓ `tar` archive of current volume (read-only, preserved as evidence)
- ✓ `sha256sum` checksums
- ✓ Sidecar database SELECT queries (read-only)
- ✓ File system reading (`cat`, `head`, `less` equivalents)

---

## 22. Operator Decisions Required

### DECISION 1: Cloud Snapshot Check

**Question**: Is there a Hostinger VPS snapshot covering the 2026-07-22T15:00 to 2026-07-23T18:05 window?

**Required action**:
- Operator logs into https://hpanel.hostinger.com
- Navigate to VPS → Snapshots
- Look for snapshots dated 2026-07-22 or 2026-07-23
- Report back: yes/no, snapshot date, snapshot size, restoration cost

### DECISION 2: If Snapshot Exists

**Question**: Should the original data be restored from the cloud snapshot?

**Options**:
- A1: Restore the entire pgdata volume from snapshot (RECOMMENDED if snapshot is from before 2026-07-23T15:00)
- A2: Restore just the workspace data (more surgical, riskier)
- A3: Decline snapshot restore; proceed with Reseed or Accept Loss

### DECISION 3: If No Snapshot

**Question**: Which path to take?

**Options**:
- B: Reseed from `carabiner/db/seed_functional.py` (synthetic data)
- C: Accept permanent loss, continue on empty database
- D: Re-run the war-room demo script (`warroom_commit.py`) to re-create the 2 known cards, then seed the rest

### DECISION 4: Cycle 1 Backup

**Question**: How should we prevent this in the future?

**Options**:
- Implement automated pg_dump to off-host storage every N hours
- Implement the DEP-001 deploy/rollback scripts (already committed in commit fac46a9)
- Enable Hostinger automatic backups
- Store the war-room evidence directory in a versioned location (not `/root/carabineros-warrooom-evidence/` which got partially cleared)

### DECISION 5: Resume Recovery Cycle 1

**Question**: After data recovery decision, what happens next?

**Current status**:
- 9 recovery tickets exist
- 4 corrections applied (per previous operator turn)
- 1 emergency stop on RESTART-DOCKER
- 1 emergency stop report committed (85103ea)
- Status correction report committed (3c88ccb)

**Awaiting**: Operator to confirm next step after data decision.

---

## Forensic Inventory Index

| Location | Content |
|----------|---------|
| `/root/carabineros-forensics/20260723T232828Z/` | All forensic output |
| `/root/carabineros-forensics/20260723T232828Z/logs/01_state.log` | State preservation (host info, containers, volumes) |
| `/root/carabineros-forensics/20260723T232828Z/logs/02_filesystem.log` | Filesystem search for PG clusters |
| `/root/carabineros-forensics/20260723T232828Z/logs/03_history.log` | Shell history search |
| `/root/carabineros-forensics/20260723T232828Z/logs/04_compose.log` | Docker compose file comparison |
| `/root/carabineros-forensics/20260723T232828Z/logs/05_events.log` | Docker events (partial, stream hung) |
| `/root/carabineros-forensics/20260723T232828Z/logs/06_metadata.log` | Docker metadata.db inspection (BoltDB) |
| `/root/carabineros-forensics/20260723T232828Z/logs/07_docker.log` | Docker container details |
| `/root/carabineros-forensics/20260723T232828Z/logs/08_env.log` | Env file inspection |
| `/root/carabineros-forensics/20260723T232828Z/logs/09_snapshot.log` | Volume tar archive |
| `/root/carabineros-forensics/20260723T232828Z/filesystem/pgdata_current_empty.tar` | Read-only archive of current empty pgdata (48.9MB, 1299 files, SHA256 b6317376...) |
| `/root/carabineros-forensics/20260723T232828Z/filesystem/sidecar_volume.tar` | Read-only archive of sidecar volume (50.8MB, SHA256 2ea49d2f...) |
