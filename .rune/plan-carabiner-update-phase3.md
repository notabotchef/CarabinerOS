# Phase 3: A0 Self-Update Execution (Git Merge)

## Goal
Merge upstream/main into feat/a0-sync branch. Resolve conflicts. The A0 core files (`agent.py`, `models.py`, `initialize.py`, `run_ui.py`) and restructured directories (`api/`, `helpers/`, `tools/`, `extensions/`) land in our repo.

## Data Flow
```
upstream/main (fb02b5f4) ──merge──→ feat/a0-sync
     ↓                                    ↓
python/ removed upstream          our python/ still exists
api/, helpers/, tools/ added      conflicts on run_ui.py
     ↓                                    ↓
Resolve: keep upstream structure + reapply carabiner patches from .rune/a0-sync-patches.md
```

## Code Contracts
No new code. Merge resolution only. Post-merge state must have:
- Root-level `api/`, `helpers/`, `tools/`, `extensions/` (from upstream)
- `python/` directory DELETED (upstream removed it) OR kept temporarily if carabiner still needs it (Phase 4 fixes refs)
- `run_ui.py` with upstream changes PLUS our `_init_carabiner_db()` patch reapplied
- `carabiner/` directory untouched by merge (it's ours only)
- `frontend/` directory untouched by merge (it's ours only)

## Tasks

### Wave 1 (sequential — merge is atomic)
- [ ] Task 1a — Allow unrelated histories merge
  - File: N/A (git operation)
  - touches: [git refs]
  - provides: [merge capability]
  - Verify: `git checkout feat/a0-sync`
  - Logic: Since repos have unrelated histories, the merge needs `--allow-unrelated-histories`. This will create conflicts on every shared file.

- [ ] Task 1b — Execute merge with strategy
  - depends_on: [Task 1a]
  - File: N/A (git operation)
  - touches: [all A0 core files]
  - provides: [merged codebase]
  - Verify: `git merge upstream/main --allow-unrelated-histories --no-commit`
  - Logic: Use `--no-commit` to inspect conflicts before committing. List all conflicted files with `git diff --name-only --diff-filter=U`.
  - Edge: If too many conflicts (>50 files), consider `git checkout upstream/main -- api/ helpers/ tools/ extensions/ agent.py models.py initialize.py` to accept upstream wholesale for A0 core, then reapply patches.

### Wave 2 (depends on Wave 1)
- [ ] Task 2a — Resolve run_ui.py conflict
  - depends_on: [Task 1b]
  - File: `run_ui.py` (conflict resolution)
  - touches: [run_ui.py]
  - provides: [working run_ui.py with carabiner init]
  - Verify: `python -c "import ast; ast.parse(open('run_ui.py').read()); print('OK')"`
  - Commit: (part of merge commit)
  - Logic: Accept upstream version, then reapply `_init_carabiner_db()` call from `.rune/a0-sync-patches.md`. The patch adds Carabiner DB initialization before the Flask app starts.

- [ ] Task 2b — Resolve models.py conflict
  - depends_on: [Task 1b]
  - File: `models.py` (conflict resolution)
  - touches: [models.py]
  - provides: [working models.py]
  - Verify: `python -c "import ast; ast.parse(open('models.py').read()); print('OK')"`
  - Logic: Accept upstream version wholesale. Our models.py had no custom changes (confirmed by scout). Upstream adds: `api_key` field on ModelConfig, `@extensible` decorator on `get_api_key()`, empty content fix, removes browser_use_monkeypatch.

- [ ] Task 2c — Resolve other A0 core conflicts
  - depends_on: [Task 1b]
  - File: `agent.py`, `initialize.py`, other conflicted files
  - touches: [agent.py, initialize.py, conf/*, prompts/*]
  - provides: [clean A0 core]
  - Verify: `git diff --name-only --diff-filter=U | wc -l` → 0
  - Logic: Accept upstream for ALL A0 core files — we had no custom changes to agent.py or initialize.py. For conf/ and prompts/, accept upstream. Our custom configs are in usr/ (safe).

### Wave 3 (depends on Wave 2)
- [ ] Task 3a — Handle python/ directory
  - depends_on: [Task 2a, Task 2b, Task 2c]
  - File: `python/` directory
  - touches: [python/]
  - provides: [clean directory state]
  - Logic: Upstream removed `python/` and moved contents to root-level dirs. After merge, `python/` may still exist with our tracked files. Keep it for now — Phase 4 will update carabiner imports, then we remove python/. Do NOT delete yet.

- [ ] Task 3b — Commit the merge
  - depends_on: [Task 3a]
  - Verify: `git status` shows no conflicts, then `git commit -m "merge: sync Agent Zero upstream/main (1882 commits)"`
  - Logic: All conflicts resolved, merge committed. The codebase now has both old python/ (ours) and new root-level dirs (upstream).

## Failure Scenarios
| When | Then | Error Type |
|------|------|-----------|
| Merge has 100+ conflicts | Use accept-theirs strategy for A0 core, manual for run_ui.py only | Git conflict |
| python/ and helpers/ both exist | Expected — Phase 4 migrates, Phase 5 cleans up | Not an error |
| Merge breaks Python imports | Expected — imports reference old python.helpers paths | Phase 4 fixes |
| New upstream files conflict with carabiner/ | Shouldn't happen — carabiner/ is ours only. If it does, keep ours | Unexpected |

## Rejection Criteria (DO NOT)
- ❌ DO NOT delete carabiner/ directory or any of its files
- ❌ DO NOT delete frontend/ directory or any of its files
- ❌ DO NOT delete usr/ directory
- ❌ DO NOT accept upstream for run_ui.py without reapplying carabiner patch
- ❌ DO NOT try to fix import paths in this phase — that's Phase 4
- ❌ DO NOT delete python/ directory yet — Phase 4 needs it for reference

## Cross-Phase Context
- **Assumes**: Phase 2 created `feat/a0-sync` branch and `.rune/a0-sync-patches.md` with patch docs
- **Exports for Phase 4**: Merged codebase with upstream A0 structure + old python/ still present. Carabiner imports still point to `python.helpers` (broken). WebSocket namespace still `/state_sync` (broken).

## Acceptance Criteria
- [ ] Merge committed on feat/a0-sync branch
- [ ] Zero unresolved conflicts (`git diff --name-only --diff-filter=U` → empty)
- [ ] `run_ui.py` has upstream code PLUS `_init_carabiner_db()` patch
- [ ] `agent.py`, `models.py`, `initialize.py` match upstream
- [ ] Root-level `api/`, `helpers/`, `tools/` directories exist
- [ ] `carabiner/` and `frontend/` directories intact and unmodified
- [ ] Python syntax valid: `python -c "import ast; ast.parse(open('run_ui.py').read())"`

## Files Touched
- `run_ui.py` — conflict resolution (upstream + our patch)
- `models.py` — accept upstream
- `agent.py` — accept upstream
- `initialize.py` — accept upstream
- `api/`, `helpers/`, `tools/`, `extensions/` — new from upstream
- Various `conf/`, `prompts/`, `plugins/` — accept upstream
