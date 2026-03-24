#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${1:-}" ]]; then
  A0_ROOT="$1"
elif [[ -d "/a0/usr" && -d "/a0/webui" ]]; then
  A0_ROOT="/a0"
elif [[ -d "/git/agent-zero/usr" && -d "/git/agent-zero/webui" ]]; then
  A0_ROOT="/git/agent-zero"
else
  echo "Error: Cannot find Agent0 root. Pass it as first argument." >&2
  exit 1
fi

PLUGIN_NAME="codex-proxy"
PLUGIN_DIR="$A0_ROOT/usr/plugins/$PLUGIN_NAME"
SYMLINK="$A0_ROOT/plugins/$PLUGIN_NAME"

echo "=== Codex Proxy Installer ==="
echo "Source: $SCRIPT_DIR"
echo "Target: $PLUGIN_DIR"
echo "Agent0: $A0_ROOT"
if git -C "$SCRIPT_DIR" rev-parse --verify HEAD >/dev/null 2>&1; then
  PLUGIN_COMMIT="$(git -C "$SCRIPT_DIR" rev-parse HEAD)"
  echo "Plugin commit: $PLUGIN_COMMIT"
else
  PLUGIN_COMMIT="unknown"
  echo "Plugin commit: unknown"
fi
echo

mkdir -p "$PLUGIN_DIR"

echo "[1/4] Copying plugin files..."
cp -f "$SCRIPT_DIR/plugin.yaml" "$PLUGIN_DIR/"
cp -f "$SCRIPT_DIR/README.md" "$PLUGIN_DIR/"
cp -f "$SCRIPT_DIR/install.sh" "$PLUGIN_DIR/"
cp -f "$SCRIPT_DIR/initialize.py" "$PLUGIN_DIR/"
mkdir -p "$PLUGIN_DIR/runtime" "$PLUGIN_DIR/scripts"
cp -rf "$SCRIPT_DIR/runtime/"* "$PLUGIN_DIR/runtime/"
if [[ -f "$SCRIPT_DIR/scripts/install-into-agent0.sh" ]]; then
  cp -f "$SCRIPT_DIR/scripts/install-into-agent0.sh" "$PLUGIN_DIR/scripts/"
fi

echo "[2/4] Running plugin initializer..."
python3 "$PLUGIN_DIR/initialize.py" --a0-root "$A0_ROOT" --plugin-root "$PLUGIN_DIR"

echo "[3/4] Enabling plugin..."
touch "$PLUGIN_DIR/.toggle-1"
printf '%s\n' "$PLUGIN_COMMIT" > "$PLUGIN_DIR/.installed-from-commit"

echo "[4/4] Creating plugin symlink..."
mkdir -p "$A0_ROOT/plugins"
ln -sfn "$PLUGIN_DIR" "$SYMLINK"

echo "Restart Agent0 to load Codex Proxy changes."
