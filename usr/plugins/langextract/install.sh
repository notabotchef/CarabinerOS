#!/usr/bin/env bash
# LangExtract Plugin — One-command installer for Agent Zero
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
A0_ROOT="${1:-/a0}"
PLUGIN_NAME="langextract"

echo "╔══════════════════════════════════════════════╗"
echo "║  LangExtract Plugin Installer                ║"
echo "║  Structured extraction for Agent Zero        ║"
echo "╚══════════════════════════════════════════════╝"

# 1. Install Python dependency
echo "[1/3] Installing langextract..."
pip install langextract 2>/dev/null || pip install langextract --break-system-packages

# 2. Copy plugin to usr/plugins if not already there
DEST="${A0_ROOT}/usr/plugins/${PLUGIN_NAME}"
if [ "$SCRIPT_DIR" != "$DEST" ]; then
    echo "[2/3] Installing plugin to ${DEST}..."
    mkdir -p "$DEST"
    cp -r "$SCRIPT_DIR"/* "$DEST"/
else
    echo "[2/3] Plugin already in place."
fi

# 3. Verify
echo "[3/3] Verifying installation..."
python -c "import langextract; print(f'  langextract {langextract.__version__} OK')" 2>/dev/null || \
python3 -c "import langextract; print(f'  langextract {langextract.__version__} OK')"

echo ""
echo "✅ LangExtract plugin installed. Enable it in A0 Plugin Hub."
echo "   Built-in schemas: invoice, recipe, prep_list"
