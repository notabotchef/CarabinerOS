# Phase 4: Carabiner Layer Adaptation

## Goal
Fix all broken imports and references in the carabiner layer after the A0 upstream merge. Update WebSocket namespace. Remove the legacy `python/` directory. Carabiner must work with the new A0 root-level directory structure.

## Data Flow
```
carabiner/api/chats.py: from python.helpers → from helpers
     ↓
usr/extensions/*.py: /state_sync namespace → /webui namespace
     ↓
frontend/src/lib/socket-client.ts: /state_sync → /webui
     ↓
python/tools/action_card.py → check if upstream moved it to tools/
     ↓
Delete python/ directory (no longer needed)
```

## Code Contracts
```python
# BEFORE — carabiner/api/chats.py
from python.helpers import persist_chat
# AFTER
from helpers import persist_chat

# BEFORE — any usr/extensions/ file
sio.connect(url, namespaces=["/state_sync"])
# AFTER
sio.connect(url, namespaces=["/webui"])
```

```typescript
// BEFORE — frontend/src/lib/socket-client.ts
const socket = io(url, { path: "/state_sync" });
// AFTER
const socket = io(url, { path: "/webui" }); // or namespace change — verify exact pattern
```

## Tasks

### Wave 1 (parallel — no dependencies)
- [ ] Task 1a — Fix carabiner Python imports
  - File: `carabiner/api/chats.py` (modify)
  - touches: [carabiner/api/chats.py]
  - provides: [working carabiner imports]
  - Test: `python -c "from carabiner.api.chats import *; print('OK')"`
  - Verify: `grep -r "from python\." carabiner/ | wc -l` → 0
  - Commit: `fix(carabiner): update imports from python.helpers to helpers`
  - Logic: Change `from python.helpers import persist_chat` → `from helpers import persist_chat`. Check `.rune/a0-sync-patches.md` for full import map. Grep for ANY remaining `from python.` in carabiner/ and fix all.
  - Edge: If `persist_chat` was renamed or moved upstream, grep for it in new `helpers/` directory.

- [ ] Task 1b — Fix carabiner blueprint registration
  - File: `carabiner/api/flask_blueprint.py` (check)
  - touches: [carabiner/api/flask_blueprint.py]
  - provides: [working blueprint]
  - Verify: `python -c "from carabiner.api.flask_blueprint import carabiner_bp; print('OK')"`
  - Logic: Check if blueprint registration pattern changed upstream. The blueprint registers on the Flask app in run_ui.py — verify the registration call still works with new A0 Flask setup.

- [ ] Task 1c — Audit ALL carabiner imports against new A0 structure
  - File: Multiple in `carabiner/` (check all)
  - touches: [any file in carabiner/ with broken imports]
  - provides: [all carabiner imports working]
  - Verify: `cd /Users/estebannunez/Projects/carabiner-os && python -c "import carabiner; print('OK')"` OR check each module
  - Logic: Beyond chats.py, grep entire carabiner/ for imports from `python.`, `from python.helpers`, `from python.api`, `from python.tools`, `from python.extensions`. Fix all to use new root-level paths.

### Wave 2 (parallel — independent of Wave 1)
- [ ] Task 2a — Update WebSocket namespace in frontend
  - File: `frontend/src/lib/socket-client.ts` (modify ~line 23)
  - touches: [frontend/src/lib/socket-client.ts]
  - provides: [correct WS namespace]
  - Verify: `grep "state_sync" frontend/src/ -r | wc -l` → 0
  - Commit: `fix(ws): update Socket.IO namespace from /state_sync to /webui`
  - Logic: Find the namespace or path config. Change `/state_sync` → `/webui`. Verify exact pattern by reading the file — it may be a namespace param or a path param.

- [ ] Task 2b — Update WebSocket namespace in backend extensions
  - File: `usr/extensions/` Python files (modify)
  - touches: [usr/extensions/*.py files with /state_sync]
  - provides: [correct backend WS namespace]
  - Verify: `grep -r "state_sync" usr/extensions/ | wc -l` → 0
  - Logic: Find all references to `/state_sync` in usr/extensions/ and update to `/webui`. Per scout report: 4 files, 4 lines total.

- [ ] Task 2c — Update WebSocket in action_card tool
  - File: Check if `python/tools/action_card.py` moved to `tools/action_card.py`
  - touches: [tools/action_card.py or equivalent]
  - provides: [correct WS in action cards]
  - Verify: `grep -r "state_sync" tools/ | wc -l` → 0
  - Logic: If action_card.py was in python/tools/ (ours), it may not exist in upstream tools/. If so, move it to the new tools/ location. Update any `/state_sync` refs.

### Wave 3 (depends on Wave 1 + Wave 2)
- [ ] Task 3a — Remove legacy python/ directory
  - depends_on: [Task 1a, Task 1b, Task 1c, Task 2c]
  - File: `python/` (delete entire directory)
  - touches: [python/]
  - provides: [clean directory structure]
  - Verify: `ls python/ 2>&1` → "No such file or directory"
  - Commit: `refactor: remove legacy python/ directory after A0 restructure`
  - Logic: All imports now point to root-level dirs. The python/ directory is dead weight. Delete it. Verify no remaining imports reference it: `grep -r "from python\." --include="*.py" | wc -l` → 0
  - Edge: If any non-carabiner code still references python/, fix those first.

- [ ] Task 3b — Verify run_ui.py carabiner integration
  - depends_on: [Task 1b]
  - File: `run_ui.py` (verify)
  - Verify: `grep "_init_carabiner_db\|carabiner_bp" run_ui.py`
  - Logic: Confirm run_ui.py still has: (1) carabiner DB init call, (2) carabiner blueprint registration. Both must work with the new A0 Flask/Uvicorn setup.

## Failure Scenarios
| When | Then | Error Type |
|------|------|-----------|
| `persist_chat` renamed in upstream helpers/ | Grep for function in helpers/ — use new name | ImportError |
| `/webui` namespace not matching upstream | Read upstream helpers/websocket.py for actual namespace | ConnectionError |
| action_card.py doesn't exist in upstream tools/ | Keep our version, move to tools/ manually | FileNotFoundError |
| Flask blueprint registration API changed | Read upstream run_ui.py for new registration pattern | RuntimeError |
| Other carabiner files import from python/ | Grep caught them in Task 1c — fix all | ImportError |

## Rejection Criteria (DO NOT)
- ❌ DO NOT modify any A0 core files (agent.py, models.py, etc.) — only fix carabiner layer
- ❌ DO NOT change frontend animation or UI code — only WebSocket config
- ❌ DO NOT delete python/ until ALL references are confirmed migrated (Wave 3 gate)
- ❌ DO NOT guess at the WebSocket namespace — read upstream code to confirm `/webui`
- ❌ DO NOT restructure carabiner/ itself — only fix its imports to point at new A0 paths

## Cross-Phase Context
- **Assumes**: Phase 3 merged upstream. Root-level `api/`, `helpers/`, `tools/`, `extensions/` exist. `python/` still exists but is stale. `.rune/a0-sync-patches.md` has import map.
- **Exports for Phase 5**: All imports fixed, WebSocket namespace updated, python/ removed. Ready for full stack verification.

## Acceptance Criteria
- [ ] Zero `from python.` imports in entire codebase: `grep -r "from python\." --include="*.py" | wc -l` → 0
- [ ] Zero `/state_sync` references: `grep -r "state_sync" --include="*.py" --include="*.ts" --include="*.tsx" | wc -l` → 0
- [ ] `python/` directory deleted
- [ ] `run_ui.py` has carabiner DB init + blueprint registration
- [ ] `python -c "from carabiner.api.chats import *"` succeeds
- [ ] Frontend TypeScript compiles: `cd frontend && pnpm build`

## Files Touched
- `carabiner/api/chats.py` — modify imports
- `carabiner/api/flask_blueprint.py` — verify/modify registration
- Any other `carabiner/**/*.py` with `from python.` imports — modify
- `frontend/src/lib/socket-client.ts` — modify namespace
- `usr/extensions/*.py` (4 files) — modify namespace
- `tools/action_card.py` — verify/move/modify
- `python/` — delete entire directory
- `run_ui.py` — verify carabiner integration
