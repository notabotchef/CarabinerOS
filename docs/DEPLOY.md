# CarabinerOS — Deploy & Rollback Runbook

DEP-001. Single-command deploy path for the investor demo stack, plus the
canonical rollback procedure when a deploy misbehaves.

This document is the operator-facing version of `scripts/deploy.sh` and
`scripts/rollback.sh`. Read it once before you deploy in front of an
investor. Skim the rollback decision tree before you merge anything that
touches `docker-compose.hermes.yml`, `Dockerfile.hermes`, or
`Dockerfile.bridge`.

---

## 1. Pre-deploy checklist

Run these in order. Do not skip the backup; do not skip the announce.

1. **Confirm you are on a clean, leased worktree.**
   `git status` should show `On branch ticket/<id>-...` and a clean
   working tree. The worktree must appear in
   `state/carabineros/FILE_LEASES.json` with `status: active`.
2. **Take a fresh DB backup.** Even though `scripts/deploy.sh` does NOT
   touch the `pgdata` volume, you want a recent dump so the rollback
   path has something to restore from if the new release corrupts the
   schema.
   `BACKUP_ROOT=/opt/carabineros-evidence/db scripts/backup_db.sh`
   (owned by DB-002; if missing, see "Known gaps" below).
3. **Snapshot the current config.** `scripts/deploy.sh` does this
   automatically, but if you are about to run a manual compose command
   first, copy `var/hermes-home/config.yaml` to a dated location.
4. **Announce in `#ops`.** "Deploying commit `<sha>` to demo in 2
   minutes. Expect ~30s warm-up. Rollback window: 15 minutes." Wait
   for at least one 👍 from the on-call engineer. If anyone says
   "wait", wait.
5. **Confirm no drill traffic.** The deploy drill (this ticket) runs
   against a side-car compose on alternate ports (8091 / 55432) — it
   must NEVER be running concurrently with a real deploy on :8090 /
   :5432.
6. **Smoke-check the running stack** so you have a baseline:
   `curl -fsS http://localhost:8641/api/health | jq` — record the
   output. If `ok:false` already, do NOT deploy; fix the existing
   outage first.

---

## 2. `scripts/deploy.sh` walkthrough

The script is `set -euo pipefail`. It does exactly eight things, in
order, and stops with a non-zero exit + an inline rollback if any step
after the snapshot fails.

| # | Step | What it does | If it fails |
|---|------|--------------|-------------|
| 1 | git pull | `git pull --ff-only @{u}` if upstream is tracked | warning only; deploy continues with the working tree as-is |
| 2 | image snapshot | tags every running container's image as `${PROJECT}_<svc>:carabineros-predeploy-<UTC>` | deploy continues but rollback image is unavailable |
| 3 | config snapshot | copies `config.yaml`, `.env`, `docker-compose.hermes.yml` to `var/rollback/<UTC>/` | step cannot fail; mkdir -p ensures parent |
| 4 | `docker compose build --no-cache` | rebuilds every service image from scratch | **inline rollback** (re-tag snapshot images, restore config, up -d) |
| 5 | `docker compose up -d` | starts postgres / bridge / hermes / frontend / nginx | **inline rollback** |
| 6 | health poll | polls `http://localhost:8641/api/health` every 2s, looks for `"ok":true`, timeout 120s | **inline rollback** |
| 7 | status table | prints `CONTAINER / STATUS / PORT / UPTIME` from `docker compose ps` | cosmetic only |
| 8 | summary | prints snapshot tag + rollback dir so the operator can invoke rollback.sh by hand if needed | n/a |

### Flags

- `--no-pull` — skip step 1. Use when you have already pulled or when
  the deploy is happening from a CI checkout.
- `--skip-snapshot` — skip step 2. Faster (no image tag ops), but the
  inline rollback path in steps 4–6 will NOT be able to restore
  previous images. Use only when you have an external, tagged
  "known-good" release you can `docker compose pull` instead.
- `--dry-run` — print every step that would run, exit 0. Use this
  before a real deploy if you have not exercised the script recently.
- `-h, --help` — show the script header.

### Example

```
$ scripts/deploy.sh
[deploy 20:31:04Z] git pull --ff-only origin/strategic-implementation
[deploy 20:31:05Z] snapshotting running services as carabiner-hermes_<svc>:carabineros-predeploy-20260723T203104Z
[deploy 20:31:05Z]   carabiner-hermes-postgres-1 -> carabiner-hermes_carabiner-hermes-postgres-1:carabineros-predeploy-20260723T203104Z
[deploy 20:31:06Z]   carabiner-hermes-bridge-1   -> carabiner-hermes_carabiner-hermes-bridge-1:carabineros-predeploy-20260723T203104Z
... (one line per running service)
[deploy 20:31:06Z] snapshotting config files to /root/carabineros/var/rollback/20260723T203104Z
[deploy 20:31:06Z] docker compose build --no-cache
[deploy 20:34:18Z] docker compose up -d
[deploy 20:34:18Z] polling http://localhost:8641/api/health (timeout 120s)
[deploy 20:34:46Z] health OK after 28s: {"ok":true,"runtime":"hermes","hermes_reachable":true}

CONTAINER                      STATUS        PORT                   UPTIME
----------------------------   ------------   ----------------------   ----------
carabiner-hermes-postgres-1    Up (healthy)  0.0.0.0:5432->5432/tcp  8s
carabiner-hermes-bridge-1      Up (healthy)  0.0.0.0:8641->8641/tcp  8s
carabiner-hermes-hermes-1      Up (healthy)  0.0.0.0:8642->8642/tcp  28s
carabiner-hermes-frontend-1    Up            3000/tcp                8s
carabiner-hermes-nginx-1       Up            0.0.0.0:8090->80/tcp    8s

[deploy 20:34:46Z] deploy complete; rollback snapshot tag: carabineros-predeploy-20260723T203104Z
[deploy 20:34:46Z] rollback artifact dir: /root/carabineros/var/rollback/20260723T203104Z
```

### The "30s warm-up"

Hermes itself (the API gateway container) reports healthy only after
its model registry finishes loading. The compose healthcheck gives it a
90s `start_period`, but in practice this is 25–35s. The bridge becomes
healthy faster (~10s). The frontend (`npm run dev`) is the slowest —
budget the full 30s before opening :8090 to the demo audience.

---

## 3. Rollback decision tree

```
                      Deploy completed?
                       /          \
                     yes           no -> fix forward, don't roll back
                      |
            /api/health ok:true?
             /        \
           yes         no
            |           |
        Did you     Roll back NOW.
        ship a      scripts/rollback.sh
        breaking    (auto-picks latest
        schema?     snapshot)
            |           |
          no  \      / yes
              \    /
        Monitor    Restore pgdata from
        for 15 min  backup + config from
        and stand   snapshot, then run
        by.         scripts/run_tests.sh.
```

Concrete triggers for rollback (in order of severity):

1. **`/api/health` returns `ok:false` for >2 minutes** after a deploy,
   AND `docker compose logs hermes` shows repeated errors not present
   before the deploy.
2. **Bridge returns 5xx for a query that worked before the deploy**.
   Check `docker compose logs bridge` for the offending stack frame.
3. **Frontend :8090 returns 502 or hangs**. `docker compose logs
   nginx` and `docker compose logs frontend` to determine which side
   is broken. Rollback if it's the bridge or hermes; otherwise restart
   just the frontend container (`docker compose restart frontend`).
4. **Postgres connection refused** for >30s. Check
   `docker compose logs postgres`. If the new release changed the
   schema and the migration didn't apply, ROLLBACK (do not try to fix
   forward — the migration may have run partially).
5. **A demo audience is watching and something is broken.** Rollback
   first, debug second. The 30s window to restore service matters
   more than perfect postmortem.

### When NOT to roll back

- A single failed curl / 5xx that recovers on retry.
- A frontend hot-reload glitch that a refresh fixes.
- A user-error config change that you can identify and revert
  directly (don't pay the rollback tax).

### What rollback.sh actually does

It refuses to run if either of these is missing or >24h old (the
"freshness gate"):

- a DB dump under `$BACKUP_ROOT` (default `/opt/carabineros-evidence/db`)
- a config snapshot under `var/rollback/<date>/`

It then:

1. Stops the stack (`docker compose down --remove-orphans`).
2. Restores `pgdata` via `scripts/restore_db.sh` (DB-002) if present,
   otherwise an in-place psql fallback that validates the dump is
   loadable. The fallback does NOT populate the named volume — for
   full restore, install DB-002's helper first.
3. Copies `config.yaml.bak` and `env.bak` from the snapshot dir over
   the live `var/hermes-home/config.yaml` and `var/hermes-home/.env`.
4. Brings the stack up.
5. Polls `/api/health` for ok:true (120s).

### When you have to roll back by hand (no deploy.sh snapshot)

If `var/rollback/<date>/` is missing (e.g. someone ran `docker
compose up -d` outside the script), you can still recover:

1. Find the previous image tag — it will be the image id that was
   running before the broken release. `docker image ls` will show
   orphaned tags like `<none>:<id>`.
2. `docker tag <id> <service-image-name>:<previous-tag>` for each
   service.
3. `docker compose up -d` — compose will pick up the re-tagged images.
4. Restore config from your most recent manual backup (you DO have
   one, because you ran the pre-deploy checklist, right?).

If you don't have one either, the rollback tax is much higher: you
are debugging from a known-bad state with no working baseline. This
is why the freshness gate exists.

---

## 4. Post-deploy verification

After a successful deploy, run these before declaring victory.

1. **Health probe.** `curl -fsS http://localhost:8641/api/health | jq`
   should print `{"ok":true, ...}`. Save the output to the deploy log.
2. **Open :8090 in a browser.** The dashboard should load in <30s
   after the deploy command returned. If it hangs, check `docker
   compose logs frontend` — the most common cause is Turbopack OOM,
   which is already mitigated by `mem_limit: 2g` on the frontend
   service (see DEMO-010).
3. **Smoke test the bridge.** `scripts/smoke_hermes.sh` (must have
   `HERMES_BASE_URL=http://localhost:8642` and `API_SERVER_KEY` set).
   Expected: at least one model listed, a chat-completions stream
   returning SSE events.
4. **Post-war-room smoke** (when in doubt): `scripts/smoke_post_war_room.sh`
   — read-only by default, so safe to run against live demo data.
5. **Run the test suite.** `scripts/run_tests.sh` (owned by TEST-001).
   This validates backend pytest + e2e + frontend smoke against the
   side-car Postgres on :5433 and the bridge on :8641. It does NOT
   mutate live demo data.
6. **Tell `#ops` "deploy done, commit `<sha>`, health ok:true,
   tests green"**. Include the rollback dir path so the on-call has
   it if something breaks 20 minutes from now.

### Verification table (copy/paste into the deploy log)

| Check | Expected | Actual |
|-------|----------|--------|
| `curl /api/health` | `{"ok":true,...}` | |
| `:8090` loads | dashboard renders in <30s | |
| `smoke_hermes.sh` | `OK -- N model(s) available` | |
| `smoke_post_war_room.sh` | exit 0 | |
| `run_tests.sh` | exit 0, coverage >= 60% | |
| `docker compose ps` | 5 services, all Up | |
| Rollback dir | `var/rollback/<UTC>/` exists, contains `config.yaml.bak` | |

---

## 5. Known gaps

- **`scripts/backup_db.sh` and `scripts/restore_db.sh` are owned by
  DB-002, which is currently blocked.** Until DB-002 ships:
  - `scripts/deploy.sh` works (does not touch pgdata).
  - `scripts/rollback.sh`'s preferred path (delegating DB restore to
    `scripts/restore_db.sh`) is skipped; the in-place psql fallback
    validates the dump but does NOT populate the named `pgdata`
    volume. For full restore, install the DB-002 helper.
  - The freshness gate still enforces 24h on whatever backup exists
    under `$BACKUP_ROOT`.
- **`STABLE-002` (config snapshot automation) is not yet a ticket in
  the board.** `scripts/deploy.sh` snapshots config files manually
  today (step 3). When STABLE-002 lands, that becomes an explicit hook
  instead.
- **`scripts/run_tests.sh` is owned by TEST-001 (currently running).**
  It is referenced in the post-deploy verification but does not gate
  the deploy itself; once TEST-001 closes, consider adding it as a
  required pre-merge check.

---

## 6. File map

- `scripts/deploy.sh` — single-command deploy.
- `scripts/rollback.sh` — single-command rollback.
- `scripts/backup_db.sh` — pg_dump to `/opt/carabineros-evidence/db`
  (DB-002).
- `scripts/restore_db.sh` — side-car restore drill (DB-002).
- `scripts/run_tests.sh` — backend pytest + e2e + frontend smoke
  (TEST-001).
- `scripts/smoke_hermes.sh` — gateway curl smoke.
- `scripts/smoke_post_war_room.sh` — post-war-room regression.
- `docker-compose.hermes.yml` — the only compose file deploy.sh
  touches.
- `var/rollback/<UTC>/` — dated config snapshots; one per successful
  deploy.
- `state/carabineros/DEPLOY_DRILL_<date>.md` — deploy-drill evidence
  (this ticket).
- `state/carabineros/FILE_LEASES.json` — worktree lease registry; the
  operator's proof they have exclusive write rights.

---

**DEP-001 — DevOps Automator — 2026-07-23**
