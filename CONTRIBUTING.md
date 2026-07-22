# CONTRIBUTING.md

Guidelines for contributing to CarabinerOS. The CarabinerOS beta runtime is the
Hermes bridge under `carabiner/runtime/` (see `docs/HERMES_BETA_RUNBOOK.md`).
The legacy Agent Zero backend is preserved under `docs/_archive/` for reference
only; this document describes the current runtime.

## Quick Start

### 1. Fork and Clone

```bash
git clone https://github.com/notabotchef/CarabinerOS.git
cd CarabinerOS
```

### 2. Generate Secrets

```bash
cp .env.example .env
openssl rand -hex 32   # paste into API_SERVER_KEY and BRIDGE_SECRET_KEY
```

> No submodules. The Agent Zero git submodule was removed during the Hermes
> migration (see `docs/FABLE_REPO_REAUDIT.md`). The CarabinerOS repo is now
> standalone.

### 3. Start the Full Stack

```bash
docker compose -f docker-compose.hermes.yml up --build -d
```

This spins up five services.

| Service | Port | Purpose |
|---------|------|---------|
| nginx | 8090 | Reverse proxy (main access point) |
| Next.js frontend | 3000 | Dev server (API proxies to bridge) |
| Bridge (FastAPI + Socket.IO) | 8641 | Carries the frontend contract + MCP surface |
| Hermes gateway | 8642 | OpenAI-compatible chat API |
| PostgreSQL | 5432 | Database |

### 4. Seed the Database (optional)

```bash
bash scripts/seed_fixture_data.sh
```

Seeds the workspace tables (`workspace_inventory`, `workspace_invoices`,
`workspace_food_cost`, `workspace_campaigns`, `inbox_items`) with deterministic
fixtures. Re-runnable; idempotent on the `(org_id, item_name)` key.

### 5. Open the App

- **CarabinerOS:** http://localhost:8090

## Development Workflow

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable, deployable state. Never commit directly. |
| `docs/*` | Documentation changes |
| `feat/*` | New features |
| `fix/*` | Bug fixes |
| `refactor/*` | Code restructuring without behavior changes |

### The TDD Cycle

1. **Write tests first** — add or update tests in `tests/` for the behavior you want
2. **Run tests (should fail)** — `pytest tests/` confirms the new behavior isn't covered
3. **Implement** — write the minimum code to make the tests pass
4. **Run tests (should pass)** — `pytest tests/` green
5. **Commit** — conventional commit message, small focused commits

### Running One Test File

```bash
pytest tests/test_http_auth_csrf.py
```

### Running the Frontend Dev Server

```bash
cd frontend && pnpm dev
```

Requires the bridge running on port 8641. The Next.js dev server proxies all
API requests to `A0_URL` (default `http://localhost:8641`, the bridge). If the
bridge is not running, every API call will 502. The `frontend/next.config.ts`
rewrite table documents every proxied path.

### Running the Backend Directly

```bash
bash scripts/run_hermes_beta.sh          # bridge + hermes together
# or for hermetic dev (no hermes gateway):
CARABINER_RUNTIME=echo bash scripts/run_hermes_beta.sh
```

From the project root. Uses Python 3.11+ with the `.venv/` virtual environment
(see `carabiner/runtime/requirements.txt`).

## Coding Conventions

### Python

- **Naming:** snake_case variables and functions, PascalCase classes
- **Imports:** absolute from project root (`from python.helpers import ...`, `from carabiner.db import ...`)
- **Type hints:** modern union syntax (`str | None`), full annotations on all public APIs
- **Tests:** function-based pytest, `@pytest.mark.asyncio` for async tests, separate `tests/` directory

### TypeScript

- **Naming:** PascalCase components, camelCase functions/handlers, kebab-case filenames
- **Imports:** `@/*` maps to `./src/*`
- **Components:** server components by default, `"use client"` only when hooks or browser APIs are needed
- **Design tokens:** see `CLAUDE.md` and `docs/DESIGN_TOKENS.md`. No custom hex colors in classNames, no `rounded-2xl`, no `shadow-lg`

### API Responses

All API endpoints return:
```json
{"ok": true, "data": ...}
```
or
```json
{"ok": false, "error": "description"}
```

### Commits

Use conventional commits:
```
feat(orders): add location_id filter to list endpoint
fix(frontend): guard against envelope-wrapped action_card payloads
docs: add gstack-recommended documentation structure
refactor(db): extract repository pattern for InventoryItem
```

## Pull Request Process

### Before Opening a PR

1. **Tests pass** — `pytest tests/`
2. **Lint passes** — `cd frontend && pnpm lint`
3. **Docs updated** — CLAUDE.md, ARCHITECTURE.md, or CHANGELOG.md if the change warrants it
4. **Squash if needed** — one meaningful commit per PR when possible

### PR Template

```markdown
## What changed
One sentence summary.

## Why
Why this matters. What problem does it solve for the user?

## How to test
1. Step one
2. Step two
3. Expected result

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console errors
- [ ] Works on mobile viewport (if applicable)
```

### Review

- Request review from at least one maintainer
- Address review comments in focused follow-up commits
- Squash and merge after approval

## Project Structure

```
carabineros/
├── carabiner/              # Domain code (restaurant logic)
│   ├── runtime/            # Hermes bridge: FastAPI + Socket.IO + MCP surface
│   ├── db/                 # SQLAlchemy models, repos, alembic migrations
│   │   ├── models.py       # Operational ORM (22 tables)
│   │   └── workspace_models.py  # Frontend-driven UI tables
│   ├── mcp/                # MCP server helpers (carabiner_read, carabiner_propose_write)
│   └── cli/                # Typer + Rich CLI commands
├── frontend/               # Next.js 16 app (App Router, React 19, Tailwind 4)
│   └── src/app/            # Pages for each module
├── docs/
│   ├── HERMES_BETA_RUNBOOK.md   # Beta runtime guide (this is the source of truth)
│   ├── HERMES_REQUIREMENTS_AND_CAPABILITIES.md
│   ├── FABLE_REPO_REAUDIT.md    # Repo audit trail
│   └── _archive/                # Legacy A0-era docs (do not edit)
├── tests/
│   └── runtime/            # Bridge-specific tests
├── scripts/                # run_hermes_beta.sh, seed_fixture_data.sh, smoke_*.sh
├── nginx.hermes.conf       # Public-edge proxy (mounts /api, /socket.io, /mcp → bridge)
├── docker-compose.hermes.yml    # Full stack orchestration
├── var/hermes-home/        # Hermes profile (gitignored, seeded from ~/.hermes)
└── CLAUDE.md               # AI agent instructions for the codebase
```

> The legacy Agent Zero backend (`engine/agent-zero`) and A0-era configs were
> removed during the Hermes migration. See `docs/FABLE_REPO_REAUDIT.md`.
> Archived docs live under `docs/_archive/` for reference only.

## Troubleshooting

### Frontend API calls return 502

The Next.js dev server proxies to the bridge via nginx. If the bridge is not
running, every `/api/*` call will return 502 from nginx. Start the bridge
first.

```bash
docker compose -f docker-compose.hermes.yml up -d bridge     # terminal 1
cd frontend && A0_URL=http://localhost:8641 pnpm dev         # terminal 2
```

Note: first hit per page takes 5-30s during Next.js Turbopack compilation;
subsequent hits are sub-100ms.

### Docker services won't start

Check logs for the failing service:
```bash
docker compose -f docker-compose.hermes.yml logs --tail=50 <service>
# services: postgres, bridge, hermes, frontend, nginx
```

Common cause: leftover containers from a previous run.
```bash
docker compose -f docker-compose.hermes.yml down --remove-orphans
docker compose -f docker-compose.hermes.yml up --build
```

### MCP server "command not found"

The bridge uses `carabiner/runtime/mcp_surface.py` (FastMCP), not the legacy
`usr/settings.json` MCP server. The MCP surface is mounted at `/mcp` via the
bridge and is reached by Hermes at `http://bridge:8641/mcp` (compose DNS) or
`http://127.0.0.1:8641/mcp` (host). See `docs/HERMES_BETA_RUNBOOK.md`.

### Database connection refused

PostgreSQL must be healthy:
```bash
docker compose -f docker-compose.hermes.yml exec postgres pg_isready -U postgres
```

If it is not ready, give it 10 seconds after starting the stack before seeding.

## First-Time Contributor Smoke Test

If you just cloned the project, these commands should all succeed in order:

```bash
docker compose -f docker-compose.hermes.yml up -d
sleep 15
docker compose -f docker-compose.hermes.yml exec postgres pg_isready -U postgres
bash scripts/smoke_post_war_room.sh        # 15/15 read-only checks
curl http://localhost:8090/api/health      # returns {"ok":true,"runtime":"hermes",...}
```

If any step fails, open an issue with the error output. We fix setup problems fast.
