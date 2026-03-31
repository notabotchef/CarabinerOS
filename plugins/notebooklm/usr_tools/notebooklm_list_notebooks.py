"""
Thin proxy for A0 tool discovery.

Copy or symlink this file to usr/tools/notebooklm_list_notebooks.py
so that A0's get_tool() can find it by name.
"""

import sys
from pathlib import Path

_plugin_root = Path(__file__).resolve().parent.parent
_project_root = _plugin_root.parent
for p in [str(_plugin_root.parent), str(_project_root)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from plugins.notebooklm.tools.list_notebooks import NotebookLMListNotebooks  # noqa: E402, F401
