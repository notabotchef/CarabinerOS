#!/usr/bin/env bash
# install.sh — Install the NotebookLM plugin into a CarabinerOS / A0 instance.
#
# Run from the project root:
#   bash plugins/notebooklm/install.sh
#
# What it does:
#   1. Copies tool proxy files into usr/tools/
#   2. Copies tool prompt files into usr/prompts/  (or prompts/)
#   3. Copies the system-prompt extension into usr/extensions/system_prompt/
#   4. Ensures the plugins/ directory is on sys.path at runtime
#   5. Runs execute.py to install deps and browser

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== NotebookLM Plugin Installer ==="
echo "Plugin dir : $SCRIPT_DIR"
echo "Project root: $PROJECT_ROOT"

# 1. Tool proxy files
echo ""
echo "--- Installing tool files into usr/tools/ ---"
for f in "$SCRIPT_DIR"/usr_tools/*.py; do
    name="$(basename "$f")"
    dest="$PROJECT_ROOT/usr/tools/$name"
    cp -v "$f" "$dest"
done

# 2. Tool prompt files
echo ""
echo "--- Installing tool prompts into usr/prompts/ ---"
mkdir -p "$PROJECT_ROOT/usr/prompts"
for f in "$SCRIPT_DIR"/usr_prompts/*.md; do
    name="$(basename "$f")"
    dest="$PROJECT_ROOT/usr/prompts/$name"
    cp -v "$f" "$dest"
done

# 3. System prompt extension
echo ""
echo "--- Installing system prompt extension ---"
mkdir -p "$PROJECT_ROOT/usr/extensions/system_prompt"
cp -v "$SCRIPT_DIR/extensions/system_prompt/_50_notebooklm_context.py" \
      "$PROJECT_ROOT/usr/extensions/system_prompt/_50_notebooklm_context.py"

# 4. Symlink plugin into usr/plugins/ for A0 plugin settings discovery
echo ""
echo "--- Linking plugin into usr/plugins/ ---"
mkdir -p "$PROJECT_ROOT/usr/plugins"
LINK_TARGET="$PROJECT_ROOT/usr/plugins/notebooklm"
if [ -L "$LINK_TARGET" ] || [ -d "$LINK_TARGET" ]; then
    echo "  (already exists, skipping)"
else
    ln -sv "$SCRIPT_DIR" "$LINK_TARGET"
fi

# 5. Create data dirs
echo ""
echo "--- Creating data directories ---"
mkdir -p "$SCRIPT_DIR/data/browser_state"
mkdir -p "$SCRIPT_DIR/data/chrome_profile"

# 6. Run execute.py
echo ""
echo "--- Running plugin setup (execute.py) ---"
if [ -f "$PROJECT_ROOT/.venv/bin/python" ]; then
    "$PROJECT_ROOT/.venv/bin/python" "$SCRIPT_DIR/execute.py"
elif command -v python3 &>/dev/null; then
    python3 "$SCRIPT_DIR/execute.py"
else
    echo "WARNING: No Python found. Run execute.py manually."
fi

echo ""
echo "=== Installation complete ==="
echo ""
echo "IMPORTANT: If running in Docker, add this to docker-compose.dev.yml"
echo "under the agent-zero service:"
echo ""
echo "  ports:"
echo "    - \"9222:9222\"    # NotebookLM remote auth"
echo ""
echo "  volumes:"
echo "    - ./plugins:/app/plugins    # Plugin code"
