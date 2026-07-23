#!/usr/bin/env bash
# CarabinerOS -- single-command deploy for the investor demo stack.
#
# What this does (in order):
#   1. Pulls the working tree (if it has an upstream tracking branch).
#   2. Snapshots the current images to a local "previous" tag so we can
#      roll back if the rebuild misbehaves.
#   3. Snapshots var/hermes-home/config.yaml + env to var/rollback/<ts>/
#      so the rollback script has a fresh config to fall back to.
#   4. Builds every service with --no-cache.
#   5. Brings the stack up with -d.
#   6. Polls http://localhost:8641/api/health for ok:true (120s).
#   7. Prints a status table: container / status / port / uptime.
#   8. On any failure after step 4, runs the rollback path inline and
#      exits non-zero with a clear reason.
#
# Usage:
#   scripts/deploy.sh                    # full deploy
#   scripts/deploy.sh --no-pull         # skip the git pull step
#   scripts/deploy.sh --skip-snapshot   # do NOT snapshot images (faster,
#                                       # but rollback will not be available)
#   scripts/deploy.sh --dry-run         # print what we WOULD do, exit 0
#   scripts/deploy.sh -h | --help       # help
#
# Hard constraints honored:
#   - Does NOT touch pgdata. The DB volume is preserved across deploys.
#   - Does NOT delete any rollback artifact.
#   - No emojis. No external network calls beyond docker + git + curl.

set -euo pipefail

# ---------------------------------------------------------------------------
# Args and paths
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.hermes.yml"
COMPOSE_PROJECT="$(grep -E '^name:' "$COMPOSE_FILE" | awk '{print $2}' | head -n1)"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-carabiner-hermes}"
HEALTH_URL="http://localhost:8641/api/health"
HEALTH_TIMEOUT_S=120
SNAPSHOT_TAG="carabineros-predeploy-$(date -u +%Y%m%dT%H%M%SZ)"
ROLLBACK_DIR="$REPO_ROOT/var/rollback/$(date -u +%Y%m%dT%H%M%SZ)"

DO_PULL=1
DO_SNAPSHOT=1
DRY_RUN=0

usage() {
    sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
    exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-pull)         DO_PULL=0 ;;
        --skip-snapshot)   DO_SNAPSHOT=0 ;;
        --dry-run)         DRY_RUN=1 ;;
        -h|--help)         usage 0 ;;
        *) echo "unknown flag: $1" >&2; usage 2 ;;
    esac
    shift
done

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
die() { printf '[deploy %s] FAIL: %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------

[[ -f "$COMPOSE_FILE" ]] || die "compose file missing: $COMPOSE_FILE"
command -v docker >/dev/null 2>&1 || die "docker CLI not found"
docker info >/dev/null 2>&1 || die "docker daemon not reachable"
command -v curl >/dev/null 2>&1 || die "curl not found"

cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Helpers (defined BEFORE the steps so steps can call them)
# ---------------------------------------------------------------------------

run() {
    if [[ "$DRY_RUN" -eq 1 ]]; then
        printf '  DRY-RUN: %s\n' "$*"
    else
        "$@"
    fi
}

print_status_table() {
    if [[ "$DRY_RUN" -eq 1 ]]; then
        log "DRY-RUN: skipping status table"
        return 0
    fi
    printf '\n%-28s %-12s %-22s %-10s\n' CONTAINER STATUS PORT UPTIME
    printf '%-28s %-12s %-22s %-10s\n' '----------------------------' '------------' '----------------------' '----------'
    while IFS=$'\t' read -r name status ports created; do
        [[ -z "$name" ]] && continue
        port="$(echo "$ports" | awk -F' -> ' '{print $1}' | head -n1)"
        uptime="$(uptime_str "$created")"
        printf '%-28s %-12s %-22s %-10s\n' "$name" "$status" "$port" "$uptime"
    done < <(docker compose -f "$COMPOSE_FILE" ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}' 2>/dev/null \
             | tail -n +2)
    printf '\n'
}

uptime_str() {
    local created="$1"
    python3 - "$created" <<'PY' 2>/dev/null || echo "?"
import sys, datetime, email.utils
s = sys.argv[1]
try:
    dt = datetime.datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=datetime.timezone.utc)
except ValueError:
    try:
        dt = email.utils.parsedate_to_datetime(s)
    except Exception:
        print("?")
        sys.exit(0)
delta = datetime.datetime.now(datetime.timezone.utc) - dt
secs = int(delta.total_seconds())
if secs < 60:    print(f"{secs}s")
elif secs < 3600: print(f"{secs//60}m")
else:            print(f"{secs//3600}h{(secs%3600)//60}m")
PY
}

rollback_to_snapshot() {
    if [[ "$DO_SNAPSHOT" -eq 0 ]]; then
        log "rollback skipped: --skip-snapshot was set; manual intervention required"
        return 0
    fi
    log "rolling back to snapshot $SNAPSHOT_TAG"
    while IFS= read -r svc; do
        [[ -z "$svc" ]] && continue
        safe_svc="$(echo "$svc" | tr '/:' '__')"
        snap="${COMPOSE_PROJECT}_${safe_svc}:${SNAPSHOT_TAG}"
        if docker image inspect "$snap" >/dev/null 2>&1; then
            orig="$(docker compose -f "$COMPOSE_FILE" config --images 2>/dev/null \
                    | awk -v s="$svc" '$0 ~ s {print; exit}')"
            if [[ -n "$orig" ]]; then
                docker tag "$snap" "$orig" || log "  WARN: re-tag $snap -> $orig failed"
                log "  $svc rolled back to $snap"
            fi
        fi
    done < <(docker compose -f "$COMPOSE_FILE" ps --services 2>/dev/null)
    if [[ -d "$ROLLBACK_DIR" ]]; then
        [[ -f "$ROLLBACK_DIR/config.yaml.bak" ]] && cp -p "$ROLLBACK_DIR/config.yaml.bak" "$REPO_ROOT/var/hermes-home/config.yaml"
        [[ -f "$ROLLBACK_DIR/env.bak"          ]] && cp -p "$ROLLBACK_DIR/env.bak"          "$REPO_ROOT/var/hermes-home/.env"
    fi
    docker compose -f "$COMPOSE_FILE" up -d || log "WARN: rollback up -d had errors"
}

# ---------------------------------------------------------------------------
# Step 1 -- pull latest (if tracking a remote branch)
# ---------------------------------------------------------------------------

if [[ "$DO_PULL" -eq 1 ]]; then
    if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
        UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}')"
        log "git pull --ff-only $UPSTREAM"
        if [[ "$DRY_RUN" -eq 0 ]]; then
            git pull --ff-only "$UPSTREAM" || log "WARN: git pull failed; continuing with working tree as-is"
        fi
    else
        log "no upstream tracking branch; skipping pull"
    fi
else
    log "--no-pull set; skipping pull"
fi

# ---------------------------------------------------------------------------
# Step 2 -- snapshot current images for rollback
# ---------------------------------------------------------------------------

if [[ "$DO_SNAPSHOT" -eq 1 ]]; then
    log "snapshotting running services as ${COMPOSE_PROJECT}_<svc>:${SNAPSHOT_TAG}"
    SNAPSHOT_OK=1
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        svc="$(echo "$line" | awk '{print $1}')"
        img="$(echo "$line" | awk '{print $2}')"
        [[ -z "$svc" || -z "$img" || "$img" == "-" ]] && continue
        safe_svc="$(echo "$svc" | tr '/:' '__')"
        new_tag="${COMPOSE_PROJECT}_${safe_svc}:${SNAPSHOT_TAG}"
        if [[ "$DRY_RUN" -eq 1 ]]; then
            printf '  DRY-RUN: docker tag %s %s\n' "$img" "$new_tag"
        else
            if docker tag "$img" "$new_tag" 2>/dev/null; then
                log "  $svc -> $new_tag"
            else
                log "  WARN: tag failed for $svc ($img); rollback image will be unavailable"
                SNAPSHOT_OK=0
            fi
        fi
    done < <(docker compose -f "$COMPOSE_FILE" ps --format '{{.Name}} {{.Image}}' 2>/dev/null \
             | grep -v '^$')
    if [[ "$SNAPSHOT_OK" -eq 0 ]]; then
        log "WARN: one or more image snapshots failed; rollback may be partial"
    fi
else
    log "--skip-snapshot set; rollback will NOT be available"
fi

# ---------------------------------------------------------------------------
# Step 3 -- snapshot config files (rollback needs these)
# ---------------------------------------------------------------------------

log "snapshotting config files to $ROLLBACK_DIR"
if [[ "$DRY_RUN" -eq 0 ]]; then
    mkdir -p "$ROLLBACK_DIR"
    if [[ -f "$REPO_ROOT/var/hermes-home/config.yaml" ]]; then
        cp -p "$REPO_ROOT/var/hermes-home/config.yaml" "$ROLLBACK_DIR/config.yaml.bak"
        log "  config.yaml -> config.yaml.bak"
    fi
    if [[ -f "$REPO_ROOT/var/hermes-home/.env" ]]; then
        cp -p "$REPO_ROOT/var/hermes-home/.env" "$ROLLBACK_DIR/env.bak"
        log "  .env -> env.bak"
    fi
    if [[ -f "$COMPOSE_FILE" ]]; then
        cp -p "$COMPOSE_FILE" "$ROLLBACK_DIR/docker-compose.hermes.yml.bak"
        log "  docker-compose.hermes.yml -> .bak"
    fi
else
    log "  DRY-RUN: skipping config snapshot (would write to $ROLLBACK_DIR)"
fi

# ---------------------------------------------------------------------------
# Step 4 -- build --no-cache
# ---------------------------------------------------------------------------

log "docker compose build --no-cache"
if [[ "$DRY_RUN" -eq 0 ]]; then
    if ! docker compose -f "$COMPOSE_FILE" build --no-cache; then
        log "BUILD FAILED; rolling back to previous images"
        rollback_to_snapshot
        die "build step failed; previous images restored"
    fi
fi

# ---------------------------------------------------------------------------
# Step 5 -- up -d
# ---------------------------------------------------------------------------

log "docker compose up -d"
if [[ "$DRY_RUN" -eq 0 ]]; then
    if ! docker compose -f "$COMPOSE_FILE" up -d; then
        log "UP FAILED; rolling back to previous images"
        rollback_to_snapshot
        die "up step failed; previous images restored"
    fi
fi

# ---------------------------------------------------------------------------
# Step 6 -- health-poll /api/health up to 120s
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
        log "HEALTH FAILED after ${HEALTH_TIMEOUT_S}s; rolling back"
        rollback_to_snapshot
        die "health endpoint never returned ok:true; previous images restored"
    fi
fi

# ---------------------------------------------------------------------------
# Step 7 -- status table
# ---------------------------------------------------------------------------

print_status_table

if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN complete; no changes applied"
else
    log "deploy complete; rollback snapshot tag: $SNAPSHOT_TAG"
    log "rollback artifact dir: $ROLLBACK_DIR"
fi
