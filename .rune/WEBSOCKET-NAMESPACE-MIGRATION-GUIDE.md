# WebSocket Namespace Migration Guide
**Status:** Contingency Plan  
**Trigger:** When Agent Zero merges namespace change (commit a5620506 or later)  
**Current State:** CarabinerOS uses `/state_sync` namespace (active, functional)  
**Target State:** `/webui` namespace (A0 upstream standard)  

---

## Summary

Agent Zero recently refactored its WebSocket infrastructure, renaming the primary namespace from `/state_sync` to `/webui`. The change is in upstream commit `a5620506` ("refactor: rename state_sync namespace to webui and simplify handler event registration").

CarabinerOS currently uses the old `/state_sync` namespace. When this codebase updates to the latest A0, a coordinated namespace migration is required.

**Effort:** ~2 hours (12 files, straightforward string replacements + testing)

---

## Files to Update

### Frontend (1 file)

**`frontend/src/lib/socket-client.ts`**

```typescript
// BEFORE (line 23)
stateSyncSocket = io(`${A0_SOCKET_URL}/state_sync`, {

// AFTER
stateSyncSocket = io(`${A0_SOCKET_URL}/webui`, {
```

**Impact:** All frontend Socket.IO connections route through this file. No other frontend changes needed.

---

### Backend Extensions (5 files)

Extensions live in `usr/extensions/` and emit Socket.IO events. Each has a `namespace="/state_sync"` argument.

#### 1. `usr/extensions/tool_execute_after/_10_chef_status.py`

```python
# BEFORE
}, namespace="/state_sync")

# AFTER
}, namespace="/webui")
```

#### 2. `usr/extensions/tool_execute_after/_30_action_card_emit.py`

```python
# BEFORE
namespace="/state_sync",

# AFTER
namespace="/webui",
```

#### 3. `usr/extensions/monologue_end/_10_chef_status.py`

```python
# BEFORE
}, namespace="/state_sync")

# AFTER
}, namespace="/webui")
```

#### 4. `usr/extensions/tool_execute_before/_10_chef_status.py`

```python
# BEFORE
}, namespace="/state_sync")

# AFTER
}, namespace="/webui")
```

**Impact:** A0 agent extensions emit events to frontend via Socket.IO. These extensions run when tools execute. No logic changes needed, just namespace string.

---

### Backend Tools (1 file)

#### `python/tools/action_card.py`

Update 2 locations:

```python
# BEFORE (docstring)
Socket.IO on the /state_sync namespace.

# AFTER
Socket.IO on the /webui namespace.

# ---

# BEFORE (function call, line ~XX)
namespace="/state_sync",

# AFTER
namespace="/webui",
```

**Impact:** Action card tool emits to frontend. Part of restaurant notification system.

---

### Tests (6 files)

Tests reference the namespace explicitly. Update all `/state_sync` → `/webui`:

1. **`tests/test_websocket_root_namespace.py`**
   - Namespace dict keys: `"/state_sync": [...]` → `"/webui": [...]`

2. **`tests/test_websocket_namespaces.py`**
   - Multiple locations: namespace="  strings, docstrings, assertions
   - Search for `state_sync` and replace with `webui`

3. **`tests/test_action_card_tool.py`**
   - Assertion: `namespace"] == "/state_sync"` → `== "/webui"`

4. **`tests/test_action_card_emit.py`**
   - Assertion: `namespace"] == "/state_sync"` → `== "/webui"`

5. **`tests/test_websocket_handlers.py`** (if exists)
   - Similar namespace references

6. **`tests/test_socket_io_...py`** (any other Socket.IO tests)
   - Update namespace references

**Impact:** Tests verify Socket.IO event routing. Update ensures tests pass after namespace change.

---

## Migration Checklist

### Pre-Migration
- [ ] Verify A0 has merged the namespace change (check upstream commit a5620506 or later)
- [ ] Create feature branch: `git checkout -b chore/websocket-namespace-migration`
- [ ] Read A0 release notes for any other Socket.IO changes

### Migration (Execute in order)

#### Phase 1: Backend
- [ ] Update `python/tools/action_card.py` (docstring + emit call)
- [ ] Update `usr/extensions/tool_execute_after/_10_chef_status.py`
- [ ] Update `usr/extensions/tool_execute_after/_30_action_card_emit.py`
- [ ] Update `usr/extensions/monologue_end/_10_chef_status.py`
- [ ] Update `usr/extensions/tool_execute_before/_10_chef_status.py`

#### Phase 2: Frontend
- [ ] Update `frontend/src/lib/socket-client.ts` line 23
- [ ] Verify no other Socket.IO client code exists (`grep -r "io(" frontend/src --include="*.ts*"`)

#### Phase 3: Tests
- [ ] Update all test files (6 files listed above)
- [ ] Run full test suite: `pytest tests/ -v`
- [ ] Verify Socket.IO tests pass

#### Phase 4: Integration
- [ ] Start backend: `python run_ui.py`
- [ ] Start frontend: `cd frontend && pnpm dev`
- [ ] Open browser console, check for Socket.IO connection errors
- [ ] Verify action cards appear in notification panel
- [ ] Verify chef status updates in top bar
- [ ] Test mini-chat (should work if Socket.IO connected)

### Post-Migration
- [ ] All tests pass
- [ ] No 404 errors in browser console for Socket.IO
- [ ] Commit: `git commit -m "chore: migrate Socket.IO namespace from /state_sync to /webui"`
- [ ] Push to feature branch, create PR
- [ ] Request code review focusing on namespace references

---

## Automated Migration (Optional)

If you want to use sed to automate most replacements:

```bash
# Dry run (show what would change)
grep -r "/state_sync" --include="*.py" --include="*.ts" --include="*.tsx" \
  frontend/src python/tools usr/extensions tests

# Execute migration (be cautious — test before and after)
find . \( -path ./node_modules -prune -o -path ./.venv -prune -o \
  \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" \) -print \) | \
  xargs sed -i '' 's|/state_sync|/webui|g'

# Verify
grep -r "/state_sync" --include="*.py" --include="*.ts" --include="*.tsx" frontend/src python/tools usr/extensions tests
# Should return: (no results)
```

**⚠️ WARNING:** Dry run first, review changes, commit incrementally.

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| Namespace mismatch causing connection failure | High if not coordinated | Test in dev before production. Watch browser console. |
| Event routing breaks | Medium | Full integration test: send message, verify state_push arrives |
| Tests fail with old A0 | Low | Tests should fail pre-migration, pass post-migration. Expected. |
| Partial migration (some files miss update) | Medium | `grep -r "/state_sync"` catch-all before commit |

---

## Rollback Plan

If migration fails:

```bash
git checkout feature-branch~1
# or
git revert <migration-commit>
```

The change is fully reversible — just string replacements.

---

## Related Architecture

For context on WebSocket usage in CarabinerOS:

- **Entry point:** `frontend/src/lib/socket-client.ts` (Socket.IO client setup)
- **Hooks:** `frontend/src/hooks/use-socket.ts`, `use-action-cards.ts`
- **Backend handlers:** `python/websocket_handlers/state_sync_handler/`
- **Real-time features:** Action cards, chef status, mini-chat, state_push (log updates)

---

## Questions?

If this guide is unclear or A0 makes additional changes beyond namespace:
1. Check A0 release notes: https://github.com/agent0ai/agent-zero/releases
2. Compare A0 `run_ui.py` with CarabinerOS version
3. Review A0 commit a5620506 for additional context

---

**Status:** Ready to execute when trigger condition met.  
**Last Updated:** 2026-03-31
