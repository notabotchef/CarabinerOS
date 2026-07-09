#!/usr/bin/env bash
# Curl-based smoke test against a running hermes gateway. Exits 0 on
# success, 1 on any failure.
#
# Usage:
#   HERMES_BASE_URL=http://localhost:8642 API_SERVER_KEY=... scripts/smoke_hermes.sh
#
# Assumes hermes is already up (start with scripts/run_hermes_beta.sh).

set -euo pipefail

BASE_URL="${HERMES_BASE_URL:-http://localhost:8642}"
KEY="${API_SERVER_KEY:?API_SERVER_KEY is required}"

echo "[smoke] GET ${BASE_URL}/v1/models"
models=$(curl -sf -H "Authorization: Bearer ${KEY}" "${BASE_URL}/v1/models" || {
  echo "FAIL: /v1/models request failed" >&2
  exit 1
})
count=$(echo "$models" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('data', [])))" 2>/dev/null || echo "0")
if [[ "$count" -lt 1 ]]; then
  echo "FAIL: /v1/models returned no models" >&2
  exit 1
fi
echo "[smoke] OK — $count model(s) available"

echo "[smoke] POST ${BASE_URL}/v1/chat/completions (stream=true)"
events=$(curl -sf -N -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -H "X-Hermes-Session-Id: smoke-$$" \
  -X POST "${BASE_URL}/v1/chat/completions" \
  -d '{"messages":[{"role":"user","content":"ping"}],"stream":true}' \
  | head -c 8192)

if [[ -z "$events" ]]; then
  echo "FAIL: /v1/chat/completions returned empty" >&2
  exit 1
fi
if ! grep -q 'data:' <<<"$events"; then
  echo "FAIL: no SSE data: lines in response" >&2
  echo "Response was: $events" >&2
  exit 1
fi
delta_count=$(grep -c '^data: {' <<<"$events" || true)
if [[ "$delta_count" -lt 1 ]]; then
  echo "FAIL: expected at least one text-delta event, got $delta_count" >&2
  exit 1
fi
echo "[smoke] OK — $delta_count SSE data event(s)"

echo "[smoke] PASSED"
exit 0