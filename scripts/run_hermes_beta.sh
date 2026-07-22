#!/usr/bin/env bash
# Render hermes/config.template.yaml into var/hermes-home/, then start
# the bridge + hermes gateway. Ctrl-C stops both and (by default) cleans
# up var/. Set KEEP_HOME=1 to skip the cleanup.
#
# Usage:
#   scripts/run_hermes_beta.sh                 # default port, echo hermes pings
#   KEEP_HOME=1 scripts/run_hermes_beta.sh     # keep var/hermes-home/ for inspection
#   CARABINER_RUNTIME=echo scripts/run_hermes_beta.sh  # skip hermes gateway (bridge only)

set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

VAR_DIR="$REPO_ROOT/var/hermes-home"
HERMES_PORT="${HERMES_PORT:-8642}"
BRIDGE_PORT="${BRIDGE_PORT:-8641}"
API_SERVER_KEY="${API_SERVER_KEY:-$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p -c 64)}"
BRIDGE_SECRET_KEY="${BRIDGE_SECRET_KEY:-$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p -c 64)}"
MCP_PUBLIC_URL="${MCP_PUBLIC_URL:-http://localhost:${BRIDGE_PORT}/mcp}"

mkdir -p "$VAR_DIR"

# Render the config — substitute env vars into the template.
HERMES_MCP_URL="$MCP_PUBLIC_URL" \
API_SERVER_KEY="$API_SERVER_KEY" \
  envsubst < "$REPO_ROOT/hermes/config.template.yaml" > "$VAR_DIR/config.yaml"

echo "Rendered: $VAR_DIR/config.yaml"

# Pick the runtime mode.
CARABINER_RUNTIME="${CARABINER_RUNTIME:-hermes}"

BRIDGE_PID=""
HERMES_PID=""

cleanup() {
  echo
  echo "Stopping bridge (pid=${BRIDGE_PID:-none}) and hermes (pid=${HERMES_PID:-none})..."
  [[ -n "${BRIDGE_PID}" ]] && kill "$BRIDGE_PID" 2>/dev/null || true
  [[ -n "${HERMES_PID}" ]] && kill "$HERMES_PID" 2>/dev/null || true
  wait "${BRIDGE_PID:-0}" 2>/dev/null || true
  wait "${HERMES_PID:-0}" 2>/dev/null || true
  if [[ "${KEEP_HOME:-0}" != "1" ]]; then
    rm -rf "$REPO_ROOT/var"
  else
    echo "KEEP_HOME=1 — leaving $REPO_ROOT/var in place"
  fi
  echo "Done."
}
trap cleanup EXIT INT TERM

# Start the bridge.
echo "Starting bridge on :${BRIDGE_PORT} (CARABINER_RUNTIME=${CARABINER_RUNTIME})..."
BRIDGE_SECRET_KEY="$BRIDGE_SECRET_KEY" \
API_SERVER_KEY="$API_SERVER_KEY" \
CARABINER_RUNTIME="$CARABINER_RUNTIME" \
HERMES_BASE_URL="http://localhost:${HERMES_PORT}" \
BRIDGE_PORT="$BRIDGE_PORT" \
DATABASE_URL="${DATABASE_URL:-}" \
  python -m uvicorn carabiner.runtime.server:create_app --factory --host 0.0.0.0 --port "$BRIDGE_PORT" &
BRIDGE_PID=$!

# Optionally start hermes.
if [[ "$CARABINER_RUNTIME" == "hermes" ]]; then
  echo "Starting hermes-agent on :${HERMES_PORT}..."
  HERMES_HOME="$VAR_DIR" \
    python -m hermes_agent.gateway --config "$VAR_DIR/config.yaml" &
  HERMES_PID=$!
fi

# Wait for both health endpoints.
for endpoint in "http://localhost:${BRIDGE_PORT}/api/health" "http://localhost:${HERMES_PORT}/v1/models"; do
  if ! curl -sf -m 5 "$endpoint" >/dev/null 2>&1 && [[ "$endpoint" == *"${HERMES_PORT}"* && "$CARABINER_RUNTIME" != "hermes" ]]; then
    continue
  fi
  for i in {1..30}; do
    if curl -sf -m 2 "$endpoint" >/dev/null 2>&1; then
      echo "Ready: $endpoint"
      break
    fi
    sleep 0.5
    if [[ $i -eq 30 ]]; then
      echo "TIMEOUT waiting for $endpoint" >&2
      exit 1
    fi
  done
done

echo
echo "==============================================="
echo "Hermes beta ready:"
echo "  bridge  = http://localhost:${BRIDGE_PORT}"
echo "  hermes  = http://localhost:${HERMES_PORT}"
echo "  API key = ${API_SERVER_KEY:0:8}...(see \$VAR_DIR)"
echo "  Ctrl-C  to stop."
echo "==============================================="

# Park forever — the trap handles shutdown.
wait