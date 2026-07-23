#!/usr/bin/env bash
# CarabinerOS — post-war-room regression smoke test.
# Validates the full stack without mutating live demo data by default.
#
# Flags (all optional, all opt-in to mutation):
#   --with-fixture-write   Enable the propose step against fixture data only.
#                          Live demo data is NEVER touched, even with this flag.
#   --reset-fixtures       Delete rows seeded by scripts/seed_fixture_data.sh.
#                          Idempotent and safe to re-run.
#   -h, --help             Show this help.
#
# Exit codes:
#   0 — all checks passed (warnings allowed)
#   1 — one or more checks failed
#   2 — environment missing (e.g. docker, curl)
#
# Read-only default is enforced: nothing is written unless --with-fixture-write
# or --reset-fixtures is passed. Writes are restricted to the canonical
# fixture data defined by scripts/seed_fixture_data.sh; live demo rows are not
# touched.

set -u
set -o pipefail

WITH_FIXTURE=0
RESET_FIXTURES=0
for arg in "$@"; do
    case "$arg" in
        --with-fixture-write) WITH_FIXTURE=1 ;;
        --reset-fixtures)     RESET_FIXTURES=1 ;;
        -h|--help)
            cat <<USAGE
Usage: scripts/smoke_post_war_room.sh [--with-fixture-write] [--reset-fixtures]

Default: read-only. No writes to live demo data, no fixture mutations.

  --with-fixture-write   Enable the propose step against a fixture card.
                         Proposes against an existing fixture-tagged row only.
                         Does NOT commit; does NOT touch live demo data.
  --reset-fixtures       Delete rows seeded by scripts/seed_fixture_data.sh
                         (vendors, purchase_orders, locations keyed by their
                         canonical seed UUIDs). Idempotent. Safe to re-run.
                         Does NOT touch any other rows.
  -h, --help             Show this help.

Exit codes: 0 all checks passed, 1 any check failed, 2 environment missing.
USAGE
            exit 0
            ;;
        *)
            echo "unknown flag: $arg" >&2
            echo "run with -h for usage" >&2
            exit 2
            ;;
    esac
done

cd "$(dirname "$0")/.."  # repo root

# Load the Hermes API key without printing it. Prefer the caller's
# environment; fall back to the repo-local .env used by docker-compose.
API_SERVER_KEY="${API_SERVER_KEY:-}"
if [ -z "$API_SERVER_KEY" ] && [ -f .env ]; then
    API_SERVER_KEY=$(grep -E '^API_SERVER_KEY=' .env | tail -n 1 | cut -d= -f2-)
fi

PASS=0
FAIL=0
WARN=0

note()  { printf "  %s\n" "$*"; }
ok()    { note "OK    $*"; PASS=$((PASS+1)); }
fail()  { note "FAIL  $*"; FAIL=$((FAIL+1)); }
warn()  { note "WARN  $*"; WARN=$((WARN+1)); }
hdr()   { printf "\n== %s ==\n" "$*"; }

require() {
    command -v "$1" >/dev/null 2>&1 || { fail "missing dependency: $1"; exit 2; }
}

require curl
require docker

# 1. Stack health -------------------------------------------------------
hdr "Stack health"
for svc in postgres bridge hermes frontend nginx; do
    name="carabiner-hermes-${svc}-1"
    status=$(docker inspect --format '{{.State.Status}}' "$name" 2>/dev/null || echo "missing")
    case "$status" in
        running|healthy) ok "$name: $status" ;;
        Up*)             ok "$name: $status" ;;
        *)               fail "$name: $status" ;;
    esac
done

# 2. Frontend status (nginx static + bridge SPA backend) ----------------
hdr "Frontend status"
# 2a. Nginx-served SPA — index.html should return 2xx and HTML
NGINX_INDEX=$(curl -s -m 5 -o /dev/null -w '%{http_code} %{content_type}' http://127.0.0.1:8090/ || echo "000")
case "$NGINX_INDEX" in
    "200 "*) ok "nginx SPA index: 200 (${NGINX_INDEX##* })" ;;
    200*)    ok "nginx SPA index: 200" ;;
    *)       fail "nginx SPA index: $NGINX_INDEX" ;;
esac
# 2b. Backend reachable through nginx (proxy to bridge on /api/health)
NGINX_API=$(curl -s -m 5 http://127.0.0.1:8090/api/health || true)
if echo "$NGINX_API" | grep -Eq '"ok":\s*true'; then
    ok "nginx → bridge /api/health proxied"
else
    warn "nginx → bridge /api/health not OK (got: $(echo "$NGINX_API" | head -c 120))"
fi

# 3. Bridge API ---------------------------------------------------------
hdr "Bridge API"
HEALTH=$(curl -s -m 5 http://127.0.0.1:8090/api/health || true)
echo "  /api/health -> $HEALTH"
if echo "$HEALTH" | grep -Eq '"ok":\s*true' && echo "$HEALTH" | grep -Eq '"hermes_reachable":\s*true'; then
    ok "/api/health (ok + hermes_reachable)"
else
    fail "/api/health not OK or hermes unreachable"
fi

for path in /api/inventory /api/invoices /api/prep /api/food-cost /api/menu; do
    body=$(curl -s -m 8 "http://127.0.0.1:8090$path")
    if echo "$body" | grep -Eq '"ok":\s*true'; then
        ok "GET $path"
    else
        fail "GET $path -> $(echo "$body" | head -c 200)"
    fi
done

# 4. Hermes model ping (read-only) --------------------------------------
hdr "Hermes model ping"
if [ -z "$API_SERVER_KEY" ]; then
    fail "API_SERVER_KEY missing (set env or repo .env)"
    HERMES=""
    CHAT=""
else
    HERMES=$(curl -s -m 8 http://127.0.0.1:8642/v1/models \
        -H "Authorization: Bearer $API_SERVER_KEY" \
        || true)
fi
echo "  /v1/models -> $(echo "$HERMES" | head -c 200)"
if echo "$HERMES" | grep -q 'carabineros-hermes'; then
    ok "Hermes exposes carabineros-hermes alias"
else
    fail "Hermes /v1/models did not return expected alias"
fi

if [ -n "$API_SERVER_KEY" ]; then
    CHAT=$(curl -s -m 30 -X POST http://127.0.0.1:8642/v1/chat/completions \
        -H "Authorization: Bearer $API_SERVER_KEY" \
        -H 'Content-Type: application/json' \
        -d '{"model":"carabineros-hermes","messages":[{"role":"user","content":"Reply with the literal word OK"}],"max_tokens":10}' \
        || true)
fi
if echo "$CHAT" | grep -Eq '"content":\s*"OK"'; then
    ok "Hermes chat completion -> OK"
else
    fail "Hermes chat completion unexpected -> $(echo "$CHAT" | head -c 200)"
fi

# 5. MCP read (read-only by default; --with-fixture-write enables propose)
hdr "MCP read"
if [ "$WITH_FIXTURE" -eq 1 ]; then
    note "fixture-write mode: running hermes CLI for carabiner_read"
    if timeout 60 hermes --provider minimax-oauth -m MiniMax-M3 \
        -t hermes-cli \
        -z 'Use carabiner_read to list inventory items below par. Be brief.' \
        --no-restore-cwd 2>&1 | grep -qi 'par'; then
        ok "MCP carabiner_read returned inventory data"
    else
        fail "MCP carabiner_read did not return inventory data"
    fi
else
    warn "MCP read SKIPPED (read-only mode). Re-run with --with-fixture-write."
fi

# 6. Propose against fixture data (gated on --with-fixture-write)
#    Uses the known fixture location UUID from scripts/seed_fixture_data.sh
#    (LOC_FULTON). NO DB write — this only exercises policy.check_propose in
#    memory inside the bridge container. Policy itself does not hit the DB,
#    so the same call works with or without postgres fixtures being loaded.
hdr "Propose against fixture data"
if [ "$WITH_FIXTURE" -eq 1 ]; then
    if ! docker ps --format '{{.Names}}' | grep -q '^carabiner-hermes-bridge-1$'; then
        fail "bridge container not running — cannot exercise propose"
    else
        FIXTURE_LOC='af06eec8-ae47-461c-a1c4-269d3f22ba80'  # LOC_FULTON from seed_fixture_data.sh
        PROPOSE=$(docker exec carabiner-hermes-bridge-1 sh -c \
            "PYTHONPATH=/app python3 -c '
from carabiner.runtime import policy
d = policy.check_propose(\"orders\", \"create\", {\"location_id\": \"$FIXTURE_LOC\", \"vendor\": \"smoke-fixture\"})
print(f\"  propose orders.create: allowed={d.allowed} reason={d.reason} normalised={d.normalised_resource}\")
'" 2>&1 || true)
        echo "$PROPOSE"
        if echo "$PROPOSE" | grep -q 'allowed=True'; then
            ok "propose orders.create against fixture data -> allowed=True"
        else
            fail "propose orders.create against fixture data not allowed"
        fi
    fi
else
    warn "propose SKIPPED (read-only mode). Re-run with --with-fixture-write."
fi

# 7. Policy rejection (in-process, no DB writes — always runs)
hdr "Policy rejection (in-process)"
DENIALS=$(docker exec carabiner-hermes-bridge-1 sh -c \
    'PYTHONPATH=/app python3 -c "
from carabiner.runtime import policy
results = []
for res, verb, dat, exp_reason in [
    (\"users\", \"delete\", {\"id\": \"x\"}, \"unknown_resource\"),
    (\"orders\", \"purge\", {\"id\": \"x\"}, \"unknown_verb\"),
    (\"orders\", \"create\", {\"vendor\": \"x\"}, \"missing_location_id\"),
]:
    d = policy.check_propose(res, verb, dat)
    results.append((verb, res, d.allowed, d.reason))
for verb, res, allowed, reason in results:
    print(f\"  {verb} {res}: allowed={allowed} reason={reason}\")
"' 2>&1 || true)
echo "$DENIALS"
if echo "$DENIALS" | grep -q 'allowed=False reason=unknown_resource' \
   && echo "$DENIALS" | grep -q 'allowed=False reason=unknown_verb' \
   && echo "$DENIALS" | grep -q 'allowed=False reason=missing_location_id'; then
    ok "policy denials enforced for 3 distinct cases"
else
    fail "policy denials incomplete"
fi

# 8. Optional reset (gated on --reset-fixtures; fixture rows only)
#    NOTE: This targets the rows that scripts/seed_fixture_data.sh actually
#    seeds (vendors + purchase_orders keyed by their known seed UUIDs). It
#    does NOT use metadata->>'fixture' = 'true' because vendors/locations/
#    purchase_orders do not currently have a metadata column. When those
#    tables gain a metadata JSONB column, switch to that predicate so any
#    fixture-tagged row is reset, not just the canonical seed set.
hdr "Optional reset (fixture rows)"
if [ "$RESET_FIXTURES" -eq 1 ]; then
    if ! docker ps --format '{{.Names}}' | grep -q '^carabiner-hermes-postgres-1$'; then
        fail "postgres container not running — cannot reset fixtures"
    else
        # Hardcoded vendor UUIDs from seed_fixture_data.sh.
        VEN_UUIDS=(
            '11111111-1111-1111-1111-111111111111'  # Coastal Produce
            '22222222-2222-2222-2222-222222222222'  # Prime Meats
            '33333333-3333-3333-3333-333333333333'  # Lakefront Seafood
            '44444444-4444-4444-4444-444444444444'  # Ibérico Direct
        )
        # Hardcoded PO UUIDs from seed_fixture_data.sh.
        PO_UUIDS=(
            'aaaaaaa1-0000-0000-0000-000000000001'
            'aaaaaaa2-0000-0000-0000-000000000002'
            'aaaaaaa3-0000-0000-0000-000000000003'
            'aaaaaaa4-0000-0000-0000-000000000004'
        )
        # Locations created by seed_fixture_data.sh (Fulton/River/West).
        LOC_UUIDS=(
            'af06eec8-ae47-461c-a1c4-269d3f22ba80'
            '519dfcc1-9ddd-4335-8fcc-f90fc3fb9fd3'
            '7c7c0ac5-e645-4cc1-8d7e-efa10ab9f5f1'
        )

        # Count what we are about to delete (cheap dry-run).
        VEN_LIST=$(printf "'%s'," "${VEN_UUIDS[@]}" | sed "s/,$//")
        PO_LIST=$(printf "'%s'," "${PO_UUIDS[@]}" | sed "s/,$//")
        LOC_LIST=$(printf "'%s'," "${LOC_UUIDS[@]}" | sed "s/,$//")
        COUNT=$(docker exec carabiner-hermes-postgres-1 psql -U postgres -d carabiner -tAc \
            "SELECT
                (SELECT count(*) FROM vendors           WHERE id IN ($VEN_LIST)) +
                (SELECT count(*) FROM purchase_orders   WHERE id IN ($PO_LIST)) +
                (SELECT count(*) FROM locations         WHERE id IN ($LOC_LIST))" 2>/dev/null | tr -d ' \n' || echo "0")
        if [ -z "$COUNT" ] || [ "$COUNT" -eq 0 ]; then
            warn "no fixture rows found — nothing to reset"
        else
            note "removing $COUNT fixture rows (vendors + purchase_orders + locations) seeded by seed_fixture_data.sh"
            if docker exec carabiner-hermes-postgres-1 psql -U postgres -d carabiner -v ON_ERROR_STOP=1 >/dev/null <<SQL
DELETE FROM purchase_orders WHERE id IN ($PO_LIST);
DELETE FROM vendors         WHERE id IN ($VEN_LIST);
DELETE FROM locations       WHERE id IN ($LOC_LIST);
SQL
            then
                ok "removed $COUNT fixture rows"
            else
                fail "fixture reset failed (psql exit non-zero)"
            fi
        fi
    fi
else
    warn "reset SKIPPED (read-only mode). Re-run with --reset-fixtures to remove rows seeded by seed_fixture_data.sh."
fi

# 9. Audit log presence -------------------------------------------------
hdr "Audit log presence"
ROWS=$(docker exec carabiner-hermes-postgres-1 psql -U postgres -d carabiner -tAc \
    "SELECT count(*) FROM action_log WHERE metadata->>'source' = 'hermes-bridge'")
if [ "${ROWS:-0}" -gt 0 ]; then
    ok "action_log has $ROWS hermes-bridge rows (audit trail present)"
else
    warn "no hermes-bridge action_log rows yet (expected post-demo)"
fi

# Summary ---------------------------------------------------------------
hdr "Summary"
echo "  PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
[ "$FAIL" -eq 0 ]
EXIT_CODE=$?
exit "$EXIT_CODE"
