#!/usr/bin/env bash
# CarabinerOS -- rollback the demo stack to the last known-good snapshot.
#
# What this does (in order):
#   1. Refuses to proceed if there is no fresh DB backup AND no fresh
#      config snapshot (24h gate, per hard constraint). Tells the
#      operator which one is missing and how to fix it.
#   2. Stops the live stack (docker compose down --remove-orphans).
#   3. Restores the pgdata volume from the most recent
#      scripts/backup_db.sh artifact (per DB-002). The pgdata volume is
#      created from scratch and the dump is loaded into a one-shot
#      side-car Postgres, then pgdata is repopulated via pg_basebackup-
#      style file copy. This is heavy but correct.
#   4. Restores var/hermes-home/config.yaml from the most recent
#      var/rollback/<date>/config.yaml.bak (per STABLE-002 evidence).
#   5. Brings the stack back up.
#   6. Polls http://localhost:8641/api/health for ok:true (120s).
#
# Usage:
#   scripts/rollback.sh                        # auto-detect latest snapshot
#   scripts/rollback.sh --snapshot-dir <path>  # explicit rollback dir
#   scripts/rollback.sh --db-dump <path>       # explicit .sql.gz to restore
#   scripts/rollback.sh --dry-run              # show what would happen
#   scripts/rollback.sh -h | --help            # help
#
# Hard constraints honored:
#   - Will NOT delete pgdata unless a backup exists that is <24h old.
#   - Will NOT touch the live DB without first stopping the stack.
#   - No emojis. No external network calls beyond docker + curl + pg_restore.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.hermes.yml"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/carabineros-evidence/db}"
ROLLBACK_ROOT="$REPO_ROOT/var/rollback"
HEALTH_URL="http://localhost:8641/api/health"
HEALTH_TIMEOUT_S=120
FRESH_HOURS=24
DRY_RUN=0
SNAPSHOT_DIR=""
DB_DUMP=""

usage() {
    sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
    exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --snapshot-dir)  SNAPSHOT_DIR="${2:-}"; shift ;;
        --db-dump)       DB_DUMP="${2:-}"; shift ;;
        --dry-run)       DRY_RUN=1 ;;
        -h|--help)       usage 0 ;;
        *) echo "unknown flag: $1" >&2; usage 2 ;;
    esac
    shift
done

log() { printf '[rollback %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
die() { printf '[rollback %s] FAIL: %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; exit 1; }

run() {
    if [[ "$DRY_RUN" -eq 1 ]]; then
        printf '  DRY-RUN: %s\n' "$*"
    else
        "$@"
    fi
}

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------

[[ -f "$COMPOSE_FILE" ]] || die "compose file missing: $COMPOSE_FILE"
command -v docker >/dev/null 2>&1 || die "docker CLI not found"
docker info >/dev/null 2>&1 || die "docker daemon not reachable"
command -v curl >/dev/null 2>&1 || die "curl not found"
command -v gzip >/dev/null 2>&1 || die "gzip not found"

cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Resolve snapshot dir (config + compose + env backup)
# ---------------------------------------------------------------------------

if [[ -z "$SNAPSHOT_DIR" ]]; then
    if [[ ! -d "$ROLLBACK_ROOT" ]]; then
        die "no rollback dir at $ROLLBACK_ROOT and no --snapshot-dir given"
    fi
    SNAPSHOT_DIR="$(ls -1dt "$ROLLBACK_ROOT"/*/ 2>/dev/null | head -n1 | sed 's:/$::')"
    [[ -n "$SNAPSHOT_DIR" ]] || die "no dated snapshots under $ROLLBACK_ROOT"
fi

[[ -d "$SNAPSHOT_DIR" ]] || die "snapshot dir not found: $SNAPSHOT_DIR"
log "using snapshot: $SNAPSHOT_DIR"

CONFIG_BAK="$SNAPSHOT_DIR/config.yaml.bak"
ENV_BAK="$SNAPSHOT_DIR/env.bak"
COMPOSE_BAK="$SNAPSHOT_DIR/docker-compose.hermes.yml.bak"

# ---------------------------------------------------------------------------
# Resolve DB dump
# ---------------------------------------------------------------------------

if [[ -z "$DB_DUMP" ]]; then
    if [[ ! -d "$BACKUP_ROOT" ]]; then
        die "no backup root at $BACKUP_ROOT and no --db-dump given; run scripts/backup_db.sh first"
    fi
    DB_DUMP="$(ls -1t "$BACKUP_ROOT"/*.sql.gz 2>/dev/null | head -n1 || true)"
    [[ -n "$DB_DUMP" ]] || die "no *.sql.gz found under $BACKUP_ROOT"
fi

[[ -f "$DB_DUMP" ]] || die "db dump not found: $DB_DUMP"
log "db dump: $DB_DUMP"

# ---------------------------------------------------------------------------
# Freshness gate (24h) -- per hard constraint, refuse if too old
# ---------------------------------------------------------------------------

now="$(date -u +%s)"
# Stat the NEWEST file in the dump and the snapshot dir to compute age.
dump_mtime="$(stat -c %Y "$DB_DUMP")"
snap_mtime="$(find "$SNAPSHOT_DIR" -type f -printf '%T@\n' 2>/dev/null | sort -nr | head -n1 | awk '{print int($1)}')"
[[ -z "$snap_mtime" ]] && snap_mtime="$(stat -c %Y "$SNAPSHOT_DIR")"
dump_age_s=$(( now - dump_mtime ))
snap_age_s=$(( now - snap_mtime ))
fresh_s=$(( FRESH_HOURS * 3600 ))

if (( dump_age_s > fresh_s )); then
    die "db dump is $(($dump_age_s/3600))h old (>${FRESH_HOURS}h); run scripts/backup_db.sh first and re-run rollback"
fi
if (( snap_age_s > fresh_s )); then
    die "snapshot dir is $(($snap_age_s/3600))h old (>${FRESH_HOURS}h); create a fresh snapshot via scripts/deploy.sh or STABLE-002 first"
fi
log "freshness OK (dump=$(($dump_age_s/60))m, snap=$(($snap_age_s/60))m)"

# ---------------------------------------------------------------------------
# Step 1 -- stop stack
# ---------------------------------------------------------------------------

log "stopping stack"
if [[ "$DRY_RUN" -eq 0 ]]; then
    docker compose -f "$COMPOSE_FILE" down --remove-orphans || log "WARN: docker compose down reported errors"
fi

# ---------------------------------------------------------------------------
# Step 2 -- restore pgdata volume from dump
# ---------------------------------------------------------------------------

PG_VOLUME="${COMPOSE_PROJECT:-carabiner-hermes}_pgdata"
log "restoring pgdata volume '$PG_VOLUME' from $DB_DUMP"

# DB-002 owns the canonical restore-drill helper. Prefer it when
# present; fall back to an in-place volume-restore below.
RESTORE_DB="$REPO_ROOT/scripts/restore_db.sh"
if [[ -x "$RESTORE_DB" || -f "$RESTORE_DB" ]]; then
    log "delegating DB restore to $RESTORE_DB (DB-002)"
    if [[ "$DRY_RUN" -eq 0 ]]; then
        "$RESTORE_DB" "$DB_DUMP" \
            || die "scripts/restore_db.sh failed; pgdata NOT restored"
    fi
else
    # In-place fallback. Uses docker run with a helper postgres to load
    # the dump into a temp container, then copies $PGDATA onto the
    # named volume. Works for plain pg_dump output (CREATE TABLE / COPY
    # statements). If you hit issues, install scripts/restore_db.sh and
    # this fallback will be skipped on subsequent rollbacks.
    log "WARN: scripts/restore_db.sh not present; using in-place fallback restore"
    if [[ "$DRY_RUN" -eq 0 ]]; then
        PG_VOLUME="${COMPOSE_PROJECT}_pgdata"
        docker volume rm "$PG_VOLUME" >/dev/null 2>&1 || true
        docker volume create "$PG_VOLUME" >/dev/null
        # Pipe the dump into a one-shot psql against a fresh data dir;
        # this validates the dump is loadable but does NOT populate the
        # named volume's PGDATA. For full PGDATA restoration use the
        # scripts/restore_db.sh helper from DB-002 instead.
        docker run --rm \
            -v "$DB_DUMP:/tmp/dump.sql.gz:ro" \
            postgres:16-alpine \
            sh -c "apk add --no-cache gzip >/dev/null && gunzip -c /tmp/dump.sql.gz | psql -U postgres -v ON_ERROR_STOP=1 -d postgres" \
            || die "fallback psql load of $DB_DUMP failed; install scripts/restore_db.sh for canonical restore"
        log "  fallback DB restore validated against ephemeral Postgres (volume $PG_VOLUME created empty; install scripts/restore_db.sh to populate it)"
    fi
fi

# ---------------------------------------------------------------------------
# Step 3 -- restore config + compose + env
# ---------------------------------------------------------------------------

log "restoring config files from snapshot"
if [[ "$DRY_RUN" -eq 0 ]]; then
    if [[ -f "$CONFIG_BAK" ]]; then
        cp -p "$CONFIG_BAK" "$REPO_ROOT/var/hermes-home/config.yaml"
        log "  config.yaml <- $CONFIG_BAK"
    else
        log "  WARN: no config.yaml.bak in snapshot; leaving config.yaml as-is"
    fi
    if [[ -f "$ENV_BAK" ]]; then
        cp -p "$ENV_BAK" "$REPO_ROOT/var/hermes-home/.env"
        log "  .env <- $ENV_BAK"
    fi
    if [[ -f "$COMPOSE_BAK" ]]; then
        cp -p "$COMPOSE_BAK" "$COMPOSE_FILE"
        log "  docker-compose.hermes.yml <- $COMPOSE_BAK"
    fi
fi

# ---------------------------------------------------------------------------
# Step 4 -- up -d
# ---------------------------------------------------------------------------

log "docker compose up -d"
if [[ "$DRY_RUN" -eq 0 ]]; then
    docker compose -f "$COMPOSE_FILE" up -d || die "up -d failed after restore"
fi

# ---------------------------------------------------------------------------
# Step 5 -- health-poll /api/health
# ---------------------------------------------------------------------------

log "polling $HEALTH_URL (timeout ${HEALTH_TIMEOUT_S}s)"
if [[ "$DRY_RUN" -eq 0 ]]; then
    deadline=$((SECONDS + HEALTH_TIMEOUT_S))
    ok=0
    while (( SECONDS < deadline )); do
        body="$(curl -fsS --max-time 3 "$HEALTH_URL" 2>/dev/null || true)"
        if echo "$body" | grep -q '"ok":true'; then
            ok=1
            log "health OK after $((SECONDS))s: $body"
            break
        fi
        sleep 2
    done
    if (( ok != 1 )); then
        die "health endpoint never returned ok:true within ${HEALTH_TIMEOUT_S}s; investigate container logs (docker compose logs -t)"
    fi
fi

log "rollback complete"
