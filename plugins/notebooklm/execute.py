"""
NotebookLM Plugin — execute.py

Called by A0 when the plugin is first installed or when the user clicks
"Run" in the plugin settings UI.  Installs the notebooklm-mcp npm
package and ensures patchright browsers are available.
"""

import subprocess
import sys
import os
import shutil


def main() -> int:
    plugin_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(plugin_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    # --- 1. Install Python deps (patchright) ---------------------------------
    req_file = os.path.join(plugin_dir, "requirements.txt")
    if os.path.exists(req_file):
        print("Installing Python dependencies ...")
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", req_file],
            text=True, capture_output=True,
        )
        if result.returncode != 0:
            print(f"ERROR: pip install failed:\n{result.stderr}")
            return 1
        print("Python dependencies installed.")

    # --- 2. Install patchright browser (Chromium) ----------------------------
    print("Installing patchright Chromium browser ...")
    result = subprocess.run(
        [sys.executable, "-m", "patchright", "install", "chromium"],
        text=True, capture_output=True,
    )
    if result.returncode != 0:
        print(f"WARNING: patchright install chromium failed:\n{result.stderr}")
        print("Auth flow will still work if Chromium is available via another path.")

    # --- 3. Check that npx / notebooklm-mcp is reachable --------------------
    npx = shutil.which("npx")
    if npx:
        print(f"npx found at {npx}")
        # Pre-install the mcp package so first query is fast
        print("Pre-installing notebooklm-mcp npm package ...")
        result = subprocess.run(
            ["npx", "-y", "notebooklm-mcp@latest", "--help"],
            text=True, capture_output=True, timeout=120,
        )
        if result.returncode == 0:
            print("notebooklm-mcp package cached.")
        else:
            print("WARNING: notebooklm-mcp pre-install had non-zero exit (may still work).")
    else:
        print("WARNING: npx not found. Install Node.js >= 18 inside the container.")

    print("NotebookLM plugin setup complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
