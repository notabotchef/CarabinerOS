#!/usr/bin/env bash
# CarabinerOS — post-war-room regression smoke test.
# Validates stack without mutating live demo data by default.
# Use --with-fixture-write to enable the propose step against a fixture.
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed
#   2 — environment missing (e.g. docker, curl)

set -u
set -o pipefail

WITH_FIXTURE=0
for arg in "$@"; do
    case "$arg" in
        --with-fixture-write) WITH_FIXTURE=1 ;;
        -h|--help)
            cat <<USAGE
Usage: scripts/smoke_post_war_room.sh [--with-fixture-write]
  --with-fixture-write  Enable the propose step against a fixture card.
                        Without this flag the script is read-only.
USAGE
            exit 0
            ;;
    esac
done

cd "$(dirname "$0")/.."  # repo root

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

# 2. Bridge API ---------------------------------------------------------
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

# 3. Hermes model ping (read-only) --------------------------------------
hdr "Hermes model ping"
HERMES=$(curl -s -m 8 http://127.0.0.1:8642/v1/models \
    -H 'Authorization: Bearer c6784b57c75554cbb78fd526a02549caf8296705345c3bc720815d4cb1636a5d' \
    || true)
echo "  /v1/models -> $(echo "$HERMES" | head -c 200)"
if echo "$HERMES" | grep -q 'carabineros-hermes'; then
    ok "Hermes exposes carabineros-hermes alias"
else
    fail "Hermes /v1/models did not return expected alias"
fi

CHAT=$(curl -s -m 30 -X POST http://127.0.0.1:8642/v1/chat/completions \
    -H 'Authorization: Bearer c6784b57c75554cbb78fd526a02549caf8296705345c3bc720815d4cb1636a5d' \
    -H 'Content-Type: application/json' \
    -d '{"model":"carabineros-hermes","messages":[{"role":"user","content":"Reply with the literal word OK"}],"max_tokens":10}' \
    || true)
if echo "$CHAT" | grep -Eq '"content":\s*"OK"'; then
    ok "Hermes chat completion -> OK"
else
    fail "Hermes chat completion unexpected -> $(echo "$CHAT" | head -c 200)"
fi

# 4. MCP read (host CLI is the cleanest path; falls back to container)
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

# 5. Policy rejection (in-process, no DB writes)
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

# 6. Action log presence ----------------------------------------------
hdr "Audit log presence"
ROWS=$(docker exec carabiner-hermes-postgres-1 psql -U postgres -d carabiner -tAc \
    "SELECT count(*) FROM action_log WHERE metadata->>'source' = 'hermes-bridge'")
if [ "${ROWS:-0}" -gt 0 ]; then
    ok "action_log has $ROWS hermes-bridge rows (audit trail present)"
else
    warn "no hermes-bridge action_log rows yet (expected post-demo)"
fi

# Summary --------------------------------------------------------------
hdr "Summary"
echo "  PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
[ "$FAIL" -eq 0 ]