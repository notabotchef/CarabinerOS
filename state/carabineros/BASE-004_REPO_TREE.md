# BASE-004 — Canonical Repository Tree

**Status**: COMPLETE
**Branch**: ticket/BASE-004-repo-tree (on strategic-implementation)
**Date**: 2026-07-22

## Classification Legend

- **ACTIVE** — In-use product code, actively maintained
- **TRANSITIONAL** — Being migrated or refactored; temporary state
- **LEGACY** — Old code retained for reference; not actively maintained
- **ARCHIVE** — Historical artifacts, superseded plans, old docs
- **GENERATED** — Build artifacts, lockfiles, auto-generated content
- **RUNTIME_SECRET** — Credentials, keys, environment files (never committed)
- **DELETE_CANDIDATE** — Confirmed dead code; safe for removal
- **UNKNOWN** — Not yet classified

## Top-Level Directory Classification

| Path | Classification | Notes |
|------|---------------|-------|
| `CLAUDE.md` | ACTIVE | ECC agent instructions; current |
| `CONTRIBUTING.md` | ACTIVE | Contribution guidelines; current |
| `DESIGN_TOKENS.md` | ACTIVE | Mandatory design token spec for frontend |
| `Dockerfile.bridge` | ACTIVE | Bridge container build definition |
| `Dockerfile.hermes` | ACTIVE | Hermes gateway container build definition |
| `README.md` | ACTIVE | Project README (being aligned in CFG-001) |
| `alembic.ini` | ACTIVE | Alembic migration config |
| `carabiner/` | ACTIVE | Core product: ORM, repositories, MCP, CLI, services |
| `data/` | ACTIVE | Data fixtures and seed data |
| `docker-compose.hermes.yml` | ACTIVE | Docker Compose stack definition |
| `docs/` | ACTIVE | Product documentation (being reorganized in DOC-001) |
| `engine/` | DELETE_CANDIDATE | Empty or dead (was Agent Zero engine) |
| `frontend/` | ACTIVE | Next.js 16 frontend application |
| `hermes/` | ACTIVE | Hermes-related product code |
| `hermes-src/` | ARCHIVE | Hermes source code (bundled in Docker image) |
| `nginx.hermes.conf` | ACTIVE | Nginx reverse proxy configuration |
| `python/` | DELETE_CANDIDATE | Dead (was Agent Zero python tools) |
| `scripts/` | ACTIVE | Operational and startup scripts |
| `state/` | ACTIVE | Program state files (this directory) |
| `tests/` | ACTIVE | Test suite |
| `tools/` | DELETE_CANDIDATE | Dead (was Agent Zero tools) |
| `usr/` | ACTIVE | User-space agent definitions |
| `var/` | ACTIVE | Runtime state, rollback backups, hermes home |

## Sub-Directory Details

### carabiner/ (ACTIVE)

| Path | Classification | Notes |
|------|---------------|-------|
| `carabiner/__init__.py` | ACTIVE | Package init |
| `carabiner/api/` | TRANSITIONAL | Legacy Flask API (being evaluated in API-001) |
| `carabiner/chat_store.py` | ACTIVE | Chat persistence (FallbackChatStore) |
| `carabiner/cli/` | ACTIVE | CLI entry points |
| `carabiner/db/` | ACTIVE | ORM models, migrations, repositories |
| `carabiner/demo_fixtures/` | ACTIVE | Demo data fixtures |
| `carabiner/domain/` | ACTIVE | Domain logic |
| `carabiner/mcp/` | ACTIVE | MCP server (being compared with runtime/mcp_surface.py in MCP-001) |
| `carabiner/requirements.txt` | ACTIVE | Python dependencies |
| `carabiner/runtime/` | ACTIVE | Hermes beta runtime (FastAPI bridge, Socket.IO, policy, state) |
| `carabiner/services/` | ACTIVE | Business services |

### frontend/ (ACTIVE)

| Path | Classification | Notes |
|------|---------------|-------|
| `frontend/src/app/` | ACTIVE | Next.js App Router pages |
| `frontend/src/components/` | ACTIVE | React components |
| `frontend/src/hooks/` | ACTIVE | Custom React hooks |
| `frontend/src/lib/` | ACTIVE | Utilities, types, mock data |
| `frontend/src/__tests__/` | ACTIVE | Frontend test suite |
| `frontend/node_modules/` | GENERATED | Dependencies (gitignored) |
| `frontend/.next/` | GENERATED | Build output (gitignored) |

### docs/ (ACTIVE — being reorganized)

| Path | Classification | Notes |
|------|---------------|-------|
| `docs/01-product/` | ACTIVE | Product documentation |
| `docs/02-market-intelligence/` | ACTIVE | Market research |
| `docs/03-development/` | ACTIVE | Development docs, roadmap, plans |
| `docs/04-go-to-market/` | ACTIVE | GTM strategy |
| `docs/05-operations/` | ACTIVE | Operations docs |
| `docs/_archive/` | ARCHIVE | Superseded plans and old docs |
| `docs/agents/` | ACTIVE | Agent definitions |
| `docs/row5/` | ACTIVE | Row5 card builder design |

### tests/ (ACTIVE)

| Path | Classification | Notes |
|------|---------------|-------|
| `tests/runtime/` | ACTIVE | Bridge runtime tests (119 passed, 8 skipped) |
| `tests/test_mcp_type_coercion.py` | ACTIVE | MCP type coercion tests (12 passed) |
| `tests/conftest.py` | ACTIVE | Test configuration |

### var/ (ACTIVE)

| Path | Classification | Notes |
|------|---------------|-------|
| `var/hermes-home/` | RUNTIME_SECRET | Hermes config + credentials (gitignored) |
| `var/rollback/` | ACTIVE | Backup snapshots |

## Delete Candidates (Confirmed Dead)

1. `engine/` — Empty or dead (was Agent Zero engine)
2. `python/` — Dead (was Agent Zero python tools)
3. `tools/` — Dead (was Agent Zero tools)

These are flagged for REPO-001 (remove only confirmed dead files) in Phase 7.
