# CarabinerOS

AI-powered restaurant management platform. Built on [Hermes](https://hermes-agent.nousresearch.com/docs) (`hermes-agent` ≥ v0.18.2) as the backend intelligence.

CarabinerOS replaces the spreadsheet-and-gut-feeling ops stack with an AI general manager that reads your data, drafts orders, tracks food cost, and manages prep — all through natural conversation.

> **Status — 2026-07-09.** Beta runtime is the in-repo bridge under `carabiner/runtime/`. The legacy Agent Zero backend (the `engine/agent-zero` submodule) is preserved for reference only and is **not required** for the beta. See `docs/FABLE_REPO_REAUDIT.md` for the audit trail and `docs/HERMES_BETA_MIGRATION_PLAN.md` for the current plan.

## Current Planning Docs

- [Fable repo re-audit](docs/FABLE_REPO_REAUDIT.md) — what this repo actually is (vs. what older Codex docs claimed).
- [Hermes requirements & capabilities](docs/HERMES_REQUIREMENTS_AND_CAPABILITIES.md) — what `hermes-agent` provides.
- [Hermes beta migration plan](docs/HERMES_BETA_MIGRATION_PLAN.md) — the active P0–P9 plan.
- [FreshcOS → CarabinerOS sync](docs/FRESHCOS_TO_CARABINEROS_SYNC.md) — **BLOCKED on access**; see unblock checklist.
- [Bridges test report](docs/HERMES_BETA_TEST_REPORT.md) — actual run results.

## Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion, shadcn/ui |
| **Intelligence backend** | Hermes (`hermes-agent` ≥ v0.18.2) — OpenAI-compatible gateway on `127.0.0.1:8642` |
| **Bridge** | `carabiner/runtime/` — FastAPI + python-socketio ASGI; FastMCP `streamable_http_app()` at `/mcp` |
| **Database** | PostgreSQL 16, SQLAlchemy 2.0 async, asyncpg |
| **Infra** | Docker Compose (`docker-compose.hermes.yml`), nginx reverse proxy (`nginx.hermes.conf`) |

## Architecture (beta)

```
Next.js frontend  ──HTTP /message_async, /chats, /csrf_token──▶  ┌────────────────────────────┐
                  ──Socket.IO /ws (state_push, action_card,      │  carabiner/runtime bridge   │──SSE /v1/chat/completions──▶ hermes-agent
                     card_commit/dismiss/message)──────────────▶ │  (FastAPI + python-socketio)│◀──MCP (streamable-http /mcp)── gateway :8642
                                                                 │  policy · audit · cards     │
                                                                 └──────────┬─────────────────┘
                                                                            ▼
                                                                     PostgreSQL (carabiner/db)
```

The bridge owns the frontend contract verbatim and delegates intelligence to a pinned hermes gateway. The Next.js frontend is unchanged; `A0_URL=http://localhost:8641` points it at the bridge instead of Agent Zero.

## Quick Start

```bash
git clone https://github.com/notabotchef/CarabinerOS.git
cd CarabinerOS

# Generate secrets
cp .env.example .env
openssl rand -hex 32   # paste into API_SERVER_KEY and BRIDGE_SECRET_KEY

# Full stack: PostgreSQL + bridge + hermes + frontend + nginx
docker compose -f docker-compose.hermes.yml up --build -d

# Open
# CarabinerOS:  http://localhost:8080
```

### Local dev loop (no nginx)

```bash
scripts/run_hermes_beta.sh   # starts bridge on :8641 + hermes on :8642; Ctrl-C to stop
cd frontend && A0_URL=http://localhost:8641 pnpm dev
```

> Note: the legacy Agent Zero backend (`engine/agent-zero` submodule) is preserved for reference only; the beta runtime is the Hermes bridge under `carabiner/runtime/`. See `docs/HERMES_BETA_RUNBOOK.md`.

## Checks

```bash
docker compose -f docker-compose.hermes.yml config
pytest tests/ -q
pytest tests/runtime/ -q                          # bridge-specific
cd frontend && pnpm test -- --runInBand
cd frontend && pnpm lint
```

Known current issue from the July 2026 audit: frontend lint may fail on `frontend/src/components/chat-composer.tsx:163`.

## Database

37 tables covering: locations, orders, inventory, prep lists, menu items, recipes (modernist format with components/steps/ingredients), invoices, food cost, daily P&L, budget periods, campaigns, action logs, and more.

## License

Proprietary. All rights reserved.