# CONTRIBUTING.md

Guidelines for contributing to CarabinerOS. Whether you a joining the project for the first time or shipping your tenth feature branch, this document walks you through the setup, workflow, and conventions.

## Quick Start

### 1. Fork and Clone

```bash
git clone https://github.com/Nunezchef/AgentCarabinerOS.git
cd AgentCarabinerOS
```

### 2. Initialize Submodules

```bash
git submodule update --init --recursive
```

Agent Zero is included as a git submodule. This is mandatory on first clone.

### 3. Start the Full Stack

```bash
docker compose -f docker-compose.dev.yml up --build
```

This spins up four services.

| Service | Port | Purpose |
|---------|------|---------|
| nginx | 8080 | Reverse proxy (main access point) |
| Next.js frontend | 3000 | Dev server (API proxies to backend) |
| Python backend | 5000 | Flask/Uvicorn + Socket.IO |
| PostgreSQL | 5432 | Database |

### 4. Seed the Database (optional)

```bash
docker compose exec agent-zero bash -c \
  'source /opt/venv-a0/bin/activate && PYTHONPATH=/cos python -m carabiner.db.seed_realistic --no-confirm'
```

Creates 3,037 realistic records for Carabiner Tapas (March 2026 data). Without this the database is empty.

### 5. Open the App

- **CarabinerOS:** http://localhost:8080
- **Agent Zero direct:** http://localhost:8080/a0/

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

Requires the backend running on port 5000. The Next.js dev server proxies all API requests to `A0_URL` (default http://localhost:5000). If the backend is not running, every API call will 500.

### Running the Backend Directly

```bash
python run_ui.py
```

From the project root. Uses Python 3.10+ with the `.venv/` virtual environment.

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
carabiner-os/
├── carabiner/              # Domain code (restaurant logic)
│   ├── api/                # Flask routes and REST endpoints
│   ├── cli/                # Typer + Rich CLI commands
│   ├── db/                 # SQLAlchemy models, repos, migrations
│   ├── services/           # Business logic
│   ├── agents/             # Multi-agent profiles and prompts
│   └── knowledge/          # CLI reference docs for AI RAG
├── engine/agent-zero/      # Git submodule (framework, read-only)
├── frontend/               # Next.js 16 app
│   └── src/app/            # Pages for each module
├── docs/                   # All project documentation
│   ├── ARCHITECTURE.md     # System design and component breakdown
│   ├── CONTRIBUTING.md     # This file
│   ├── CHANGELOG.md        # Version history
│   └── README.md           # Documentation overview
├── usr/                    # A0 runtime config (plugins, agents, settings)
├── tests/                  # Backend test suite
├── docker-compose.dev.yml  # Full stack orchestration
└── CLAUDE.md               # AI agent instructions for the codebase
```

## Troubleshooting

### Frontend API calls return 500

The Next.js dev server proxies to the Flask backend. If the backend is not running, every `/api/*` call will fail. Start the backend first.

```bash
python run_ui.py        # terminal 1
cd frontend && pnpm dev # terminal 2
```

### Docker services won't start

Check logs for the failing service:
```bash
docker compose -f docker-compose.dev.yml logs --tail=50 agent-zero
docker compose -f docker-compose.dev.yml logs --tail=50 frontend
```

Common cause: leftover containers from a previous run.
```bash
docker compose -f docker-compose.dev.yml down --remove-orphans
docker compose -f docker-compose.dev.yml up --build
```

### MCP server "command not found"

`usr/settings.json` uses `.venv/bin/python` (relative path). This requires starting the backend from the project root. For a machine-specific override, copy `usr/settings.local.json.example` to `usr/settings.local.json` and adjust paths.

### Database connection refused

PostgreSQL must be healthy:
```bash
docker compose exec db pg_isready
```

If it is not ready, give it 10 seconds after starting the stack before seeding.

## First-Time Contributor Smoke Test

If you just cloned the project, these commands should all succeed in order:

```bash
git submodule update --init --recursive
docker compose -f docker-compose.dev.yml up -d
sleep 15
docker compose exec db pg_isready
curl http://localhost:8080/api/health  # or any GET endpoint
```

If any step fails, open an issue with the error output. We fix setup problems fast.
