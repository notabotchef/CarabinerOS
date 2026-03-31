# Phase 2: A0 Pre-Update Safety Net

## Goal
Create safety nets before pulling 1882 upstream commits. Branch, backup state, document coupling points so Phase 3 merge can be rolled back cleanly.

## Data Flow
```
main branch → git branch feat/a0-sync (safety copy)
     ↓
carabiner/ layer → snapshot imports, coupling points
     ↓
run_ui.py → document custom _init_carabiner_db() patch
     ↓
usr/ directory → verify gitignored (survives merge)
     ↓
Ready for Phase 3 merge
```

## Code Contracts
No code changes in this phase. Pure preparation and documentation.

## Tasks

### Wave 1 (parallel — no dependencies)
- [ ] Task 1a — Create sync branch
  - File: N/A (git operation)
  - touches: [git refs]
  - provides: [feat/a0-sync branch]
  - Test: N/A
  - Verify: `git checkout -b feat/a0-sync && git log --oneline -1`
  - Commit: N/A (branch creation only)
  - Logic: Branch from current main. All merge work happens here. Only merge to main after Phase 5 passes.

- [ ] Task 1b — Document run_ui.py custom patch
  - File: `.rune/a0-sync-patches.md` (new)
  - touches: [.rune/a0-sync-patches.md]
  - provides: [patch documentation]
  - Test: N/A
  - Verify: `cat .rune/a0-sync-patches.md | head -5`
  - Commit: `docs: document carabiner patches to A0 core for merge`
  - Logic: Read `run_ui.py`, extract the `_init_carabiner_db()` addition and any other Carabiner-specific lines. Document exact line numbers and the patch content so it can be reapplied after merge.

- [ ] Task 1c — Snapshot carabiner import dependencies
  - File: `.rune/a0-sync-patches.md` (append)
  - touches: [.rune/a0-sync-patches.md]
  - provides: [import map]
  - Test: N/A
  - Verify: `grep -r "from python\." carabiner/ | wc -l`
  - Commit: (combined with 1b)
  - Logic: Grep all `from python.helpers`, `from python.api`, etc. in `carabiner/`. Document each import and its new path (`python.helpers.X` → `helpers.X`). Also document `usr/extensions/` Socket.IO namespace references.

### Wave 2 (depends on Wave 1)
- [ ] Task 2a — Verify usr/ directory is safe
  - depends_on: [Task 1a]
  - File: N/A (verification)
  - Verify: `git ls-files usr/ | wc -l` and check `.gitignore` for usr/ patterns
  - Logic: A0's update flow preserves `usr/`. Confirm our `usr/settings.json`, `usr/.env`, `usr/plugins/` won't be overwritten. If usr/ is tracked in git, note which files need manual preservation.

- [ ] Task 2b — Fetch and inspect upstream diff summary
  - depends_on: [Task 1a]
  - File: N/A (analysis)
  - Verify: `git diff --stat HEAD upstream/main -- agent.py models.py initialize.py run_ui.py | head -20`
  - Logic: Produce a summary of what A0 core files changed. Identify files with merge conflict risk (our modifications vs upstream changes). Key conflict points: run_ui.py (our patch), models.py (if we changed it), any python/ → root moves.

## Failure Scenarios
| When | Then | Error Type |
|------|------|-----------|
| Branch already exists | Delete and recreate: `git branch -D feat/a0-sync` | Git error |
| usr/ files are git-tracked | Note them — they'll conflict during merge | Merge conflict |
| More carabiner coupling than expected | Add to patch doc — more work in Phase 4 | Scope increase |

## Rejection Criteria (DO NOT)
- ❌ DO NOT modify any source code in this phase
- ❌ DO NOT merge upstream yet — that's Phase 3
- ❌ DO NOT delete any branches or reset any refs
- ❌ DO NOT skip the patch documentation — Phase 4 needs it

## Cross-Phase Context
- **Assumes**: Phase 1 complete (frontend motion migration committed)
- **Exports for Phase 3**: `feat/a0-sync` branch ready, patch documentation in `.rune/a0-sync-patches.md`
- **Exports for Phase 4**: Import map (python.X → X) and WebSocket namespace changes documented

## Acceptance Criteria
- [ ] `feat/a0-sync` branch exists, branched from latest main
- [ ] `.rune/a0-sync-patches.md` documents all custom A0 core patches
- [ ] All `carabiner/` → `python/` imports documented with new paths
- [ ] `usr/` directory safety confirmed
- [ ] Upstream diff summary reviewed — no surprises

## Files Touched
- `.rune/a0-sync-patches.md` — new (documentation only)
- Git refs — new branch `feat/a0-sync`
