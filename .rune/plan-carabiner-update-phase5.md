# Phase 5: Verification & Smoke Test

## Goal
Verify the entire stack works end-to-end after the A0 sync and motion migration. Build, lint, Docker compose, and basic smoke tests.

## Data Flow
```
pnpm build (frontend) → verify Next.js 16 compiles
     ↓
python syntax check → verify all imports resolve
     ↓
docker compose up → PostgreSQL + Backend + Frontend + Nginx
     ↓
Smoke test: health endpoint, Socket.IO connection, chat API
     ↓
Merge feat/a0-sync → main
```

## Code Contracts
No new code. Verification and merge only.

## Tasks

### Wave 1 (parallel — independent checks)
- [ ] Task 1a — Frontend build
  - File: N/A (verification)
  - Verify: `cd frontend && pnpm install && pnpm build`
  - Logic: Catches broken imports (motion, Socket.IO), TypeScript errors, Next.js config issues.

- [ ] Task 1b — Frontend lint
  - File: N/A (verification)
  - Verify: `cd frontend && pnpm lint`
  - Logic: ESLint flat config with Next.js 16 rules.

- [ ] Task 1c — Python import check
  - File: N/A (verification)
  - Verify: `python -c "import agent; import models; import initialize; from carabiner.api.flask_blueprint import carabiner_bp; print('ALL OK')"`
  - Logic: Verify core A0 modules and carabiner layer import without errors.

- [ ] Task 1d — No legacy references
  - File: N/A (verification)
  - Verify: Three checks:
    - `grep -r "from python\." --include="*.py" | wc -l` → 0
    - `grep -r "framer-motion" frontend/src/ | wc -l` → 0
    - `grep -r "state_sync" --include="*.py" --include="*.ts" | wc -l` → 0

### Wave 2 (depends on Wave 1 passing)
- [ ] Task 2a — Docker compose stack
  - depends_on: [Task 1a, Task 1c]
  - File: N/A (infrastructure)
  - Verify: `docker compose -f docker-compose.dev.yml up -d && sleep 10 && docker compose -f docker-compose.dev.yml ps`
  - Logic: All services should show "running". If any fail, check logs: `docker compose -f docker-compose.dev.yml logs <service> --tail 50`
  - Edge: New A0 may have changed Docker config. Check if `docker-compose.dev.yml` needs updates for new directory structure.

- [ ] Task 2b — Health endpoint check
  - depends_on: [Task 2a]
  - Verify: `curl -s http://localhost:5000/api/health | python -m json.tool` (or equivalent A0 health endpoint)
  - Logic: Backend should respond with 200 and status JSON.

- [ ] Task 2c — Database migration check
  - depends_on: [Task 2a]
  - Verify: `cd /Users/estebannunez/Projects/carabiner-os && python -c "from carabiner.db.models import Base; print('Models loaded:', len(Base.metadata.tables), 'tables')"`
  - Logic: All 27 ORM models should load. If Alembic migrations need updating for new A0 schema, run them.

### Wave 3 (depends on Wave 2)
- [ ] Task 3a — Merge to main
  - depends_on: [Task 2a, Task 2b, Task 2c]
  - File: N/A (git)
  - Verify: `git checkout main && git merge feat/a0-sync && git log --oneline -3`
  - Commit: Merge commit auto-generated
  - Logic: Only merge if all Wave 1-2 checks pass. This is the point of no return for main.
  - Edge: If any check failed, fix on feat/a0-sync first, re-verify, then merge.

- [ ] Task 3b — Final verification on main
  - depends_on: [Task 3a]
  - Verify: `cd frontend && pnpm build && cd .. && python -c "import agent; print('OK')"`
  - Logic: One last build check after merge to main.

## Failure Scenarios
| When | Then | Error Type |
|------|------|-----------|
| Frontend build fails | Check error — likely missed import rename | Build error |
| Python import fails | Grep for the broken import, fix path | ImportError |
| Docker services fail to start | Check docker-compose.yml for path changes from A0 restructure | Docker error |
| Database migration mismatch | Run `alembic upgrade head` in carabiner context | Alembic error |
| Health endpoint 404 | A0 may have changed API routes — check upstream api/ | Route change |

## Rejection Criteria (DO NOT)
- ❌ DO NOT merge to main if ANY verification check fails
- ❌ DO NOT skip the Docker compose test — it catches runtime issues that static checks miss
- ❌ DO NOT force push or rewrite history on main
- ❌ DO NOT delete feat/a0-sync branch after merge — keep for rollback reference

## Cross-Phase Context
- **Assumes**: Phase 1 (motion), Phase 3 (merge), Phase 4 (adaptation) all complete on feat/a0-sync
- **Exports**: Clean main branch with modern A0 + motion + working carabiner layer

## Acceptance Criteria
- [ ] `pnpm build` succeeds (frontend)
- [ ] `pnpm lint` passes (frontend)
- [ ] All Python core imports work
- [ ] Zero legacy references (python., framer-motion, state_sync)
- [ ] Docker stack runs (all services healthy)
- [ ] Health endpoint returns 200
- [ ] Carabiner DB models load (27 tables)
- [ ] feat/a0-sync merged to main
- [ ] Final build check on main passes

## Files Touched
- `docker-compose.dev.yml` — possibly modify if A0 changed Docker paths
- Git refs — merge feat/a0-sync → main
