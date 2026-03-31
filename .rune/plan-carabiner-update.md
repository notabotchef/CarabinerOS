# Feature: Carabiner-OS Full Update (Motion + Agent Zero Sync)

## Overview
Two-part update: (1) Migrate framer-motion → motion package across 29 frontend files, (2) Sync Agent Zero upstream (1882 commits behind) using A0's self-update, then adapt Carabiner's layer to the new directory structure (`python/` → root-level `api/`, `helpers/`, `tools/`, `extensions/`).

## Phases
| # | Name | Status | Plan File | Summary |
|---|------|--------|-----------|---------|
| 1 | Framer Motion → Motion | ✅ Done | plan-carabiner-update-phase1.md | Swap package, rename 29 imports |
| 2 | A0 Pre-Update Safety Net | ⬚ Pending | plan-carabiner-update-phase2.md | Backup, branch, snapshot carabiner layer |
| 3 | A0 Self-Update Execution | ⬚ Pending | plan-carabiner-update-phase3.md | Pull upstream main, resolve structure conflicts |
| 4 | Carabiner Layer Adaptation | ⬚ Pending | plan-carabiner-update-phase4.md | Fix imports, WebSocket namespace, run_ui.py |
| 5 | Verification & Smoke Test | ⬚ Pending | plan-carabiner-update-phase5.md | Build, lint, Docker stack, E2E check |

## Key Decisions
- **A0 update via git merge** (not self-update Docker flow) — we run from source, not Docker
- **Phase 1 first** — isolated frontend change, unblocks framer-motion debt regardless of A0
- **Preserve `carabiner/` layer intact** — only fix its import paths, never restructure it
- **WebSocket namespace `/state_sync` → `/webui`** — match upstream rename (commit a5620506)

## Architecture
```
Before: python/{api,helpers,tools,extensions}/ → carabiner/ reads from python/helpers
After:  {api,helpers,tools,extensions}/        → carabiner/ reads from helpers/
        frontend/ imports from "motion/react"   (was "framer-motion")
```

## Dependencies
- upstream/main at commit `fb02b5f4` — already fetched
- `motion` npm package — replaces `framer-motion`

## Risks
- **Merge conflicts in `run_ui.py`**: we added `_init_carabiner_db()` — manual resolve needed
- **WebSocket event name changes**: upstream may have renamed events beyond namespace
- **New A0 plugin system**: may require `carabiner` to register as a plugin — Phase 4 handles

## Outcome
- **What Was Planned**: 5-phase update bringing carabiner-os current with upstream A0 + modern motion package
- **Immediate Next Action**: Execute Phase 1 — swap framer-motion for motion in frontend
- **How to Measure**:

| Check | Command |
|-------|---------|
| Motion imports correct | `grep -r "framer-motion" frontend/src/ \| wc -l` → 0 |
| Frontend builds | `cd frontend && pnpm build` |
| A0 merge complete | `git log --oneline -1` shows merge commit |
| Docker stack healthy | `docker compose -f docker-compose.dev.yml up` → all services green |
