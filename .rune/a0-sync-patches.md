# Carabiner Patches to A0 Core — Reapply After Merge

## 1. run_ui.py — Carabiner DB Init

**Location**: Called at line ~484, defined at line ~555
**Purpose**: Initialize async DB engine at startup to prevent WSGI deadlock

### Patch: _init_carabiner_db() function (add after init_a0 definition)
```python
def _init_carabiner_db():
    """Initialize the CarabinerOS async DB engine at startup."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        PrintStyle.warning("DATABASE_URL not set — skipping CarabinerOS DB init")
        return
    try:
        import nest_asyncio
        nest_asyncio.apply()
        from carabiner.db.engine import init_db
        asyncio.get_event_loop().run_until_complete(init_db(db_url))
        PrintStyle().print("CarabinerOS database initialized.")
    except Exception as e:
        PrintStyle.warning(f"CarabinerOS DB init failed: {e}")
```

### Patch: Call site (add after init_a0() call, before WSGIMiddleware)
```python
    _init_carabiner_db()
```

## 2. python/api/carabiner_workspace.py → api/carabiner_workspace.py

**Purpose**: ApiHandler that registers carabiner Flask blueprints
**After merge**: Move to `api/carabiner_workspace.py` and update imports

### Import changes needed:
```python
# OLD
from python.helpers.api import ApiHandler, Request, Response
from python.helpers.print_style import PrintStyle

# NEW
from helpers.api import ApiHandler, Request, Response
from helpers.print_style import PrintStyle
```

## 3. carabiner/api/chats.py — 3 import sites

### Lines 132, 184, 213:
```python
# OLD
from python.helpers import persist_chat

# NEW
from helpers import persist_chat
```

## 4. WebSocket Namespace Change

**Upstream namespace**: `/ws` (defined in helpers/ws.py as `NAMESPACE = "/ws"`)
**Our current namespace**: `/state_sync`

### Files to update:
| File | Line | Old | New |
|------|------|-----|-----|
| `frontend/src/lib/socket-client.ts` | 23 | `/state_sync` | `/ws` |
| `usr/extensions/tool_execute_after/_10_chef_status.py` | 26 | `/state_sync` | `/ws` |
| `usr/extensions/tool_execute_after/_30_action_card_emit.py` | 434 | `/state_sync` | `/ws` |
| `usr/extensions/monologue_end/_10_chef_status.py` | 31 | `/state_sync` | `/ws` |
| `usr/extensions/tool_execute_before/_10_chef_status.py` | 76 | `/state_sync` | `/ws` |
| `python/tools/action_card.py` → `tools/action_card.py` | 5, 152 | `/state_sync` | `/ws` |

## 5. run_ui.py Import Changes

### Current (our version):
```python
from python.helpers import files, git, mcp_server, fasta2a_server, settings as settings_helper
from python.helpers.files import get_abs_path
from python.helpers import runtime, dotenv, process
from python.helpers.websocket import WebSocketHandler, validate_ws_origin
from python.helpers.extract_tools import load_classes_from_folder
from python.helpers.api import ApiHandler
from python.helpers.print_style import PrintStyle
from python.helpers import login
from python.helpers.websocket_manager import WebSocketManager
from python.helpers.websocket_namespace_discovery import discover_websocket_namespaces
```

### Upstream (new):
```python
from helpers import files, git, mcp_server, fasta2a_server, settings as settings_helper
from helpers.files import get_abs_path
from helpers import runtime, dotenv, process
from helpers.ws import register_ws_namespace, validate_ws_origin
# etc. — accept upstream version wholesale, then reapply carabiner patches
```

## 6. usr/ Directory Safety

- `usr/settings.json` — tracked in git, may conflict
- `usr/.env` — tracked in git, will conflict
- `usr/plugins/` — tracked, our codex-proxy lives here
- `usr/extensions/` — tracked, our carabiner extensions live here
- **Action**: Accept OURS for all usr/ conflicts during merge
