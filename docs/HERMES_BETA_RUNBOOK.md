# Hermes Beta Runbook — 2026-07-09

**Scope:** a fresh checkout of `/root/carabineros` post-P9 commit, on a host with Python 3.11+, Docker, Postgres (optional), and the hermes-agent package.

## TL;DR

```bash
# 1. Clone + enter
git clone https://github.com/notabotchef/CarabinerOS.git
cd CarabinerOS

# 2. Generate secrets + write .env
cp .env.example .env
sed -i.bak "s|^API_SERVER_KEY=.*|API_SERVER_KEY=$(openssl rand -hex 32)|" .env
sed -i.bak "s|^BRIDGE_SECRET_KEY=.*|BRIDGE_SECRET_KEY=$(openssl rand -hex 32)|" .env

# 3a. Docker path (full stack)
docker compose -f docker-compose.hermes.yml up --build -d
# Open http://localhost:8080

# 3b. Local-dev path (no docker)
scripts/run_hermes_beta.sh                # Ctrl-C to stop
cd frontend && A0_URL=http://localhost:8641 pnpm dev
```

## Step-by-step

### 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11+ | bridge code targets 3.11.15 |
| `uv` or `pip` | latest | `uv` is recommended (handles PEP 668) |
| `docker` + `docker compose` | 24+ | only for the full-stack path |
| `pnpm` | 9+ | only for frontend dev |
| `hermes-agent` | `>=0.18.2` | `pip install hermes-agent==0.18.2` for the local-dev path; Docker image has it pinned |
| Postgres 16 | (optional) | only for `tests/runtime/test_audit_log.py` integration tests |

### 2. Clone

The repo's `engine/agent-zero` git submodule is **unreachable** on remote (Fable audit §1) — fresh clones will fail at submodule init. **Skip submodule init**; the beta runtime does not need it.

```bash
git clone --no-recurse-submodules https://github.com/notabotchef/CarabinerOS.git
cd CarabinerOS
```

### 3. Configure secrets

```bash
cp .env.example .env
openssl rand -hex 32   # paste into API_SERVER_KEY
openssl rand -hex 32   # paste into BRIDGE_SECRET_KEY
# If using real models, also fill in ANTHROPIC_API_KEY or NOUS_API_KEY.
```

### 4. Local dev (no docker)

```bash
# One-shot script: renders var/hermes-home/, starts bridge + hermes.
scripts/run_hermes_beta.sh
```

Expected output (after ~10 s):

```
Rendered: /root/carabineros/var/hermes-home/config.yaml
Starting bridge on :8641 (CARABINER_RUNTIME=hermes)...
Starting hermes-agent on :8642...
Ready: http://localhost:8641/api/health
Ready: http://localhost:8642/v1/models
===============================================
Hermes beta ready:
  bridge  = http://localhost:8641
  hermes  = http://localhost:8642
  API key = ab12cd34...(see $VAR_DIR)
  Ctrl-C  to stop.
===============================================
```

In another terminal:

```bash
cd frontend && A0_URL=http://localhost:8641 pnpm dev
# Frontend at http://localhost:3000
```

### 5. Local smoke (no docker)

With `scripts/run_hermes_beta.sh` running:

```bash
scripts/smoke_hermes.sh
# [smoke] GET http://localhost:8642/v1/models
# [smoke] OK — 1 model(s) available
# [smoke] POST http://localhost:8642/v1/chat/completions (stream=true)
# [smoke] OK — N SSE data event(s)
# [smoke] PASSED
```

### 6. Docker path (full stack)

```bash
docker compose -f docker-compose.hermes.yml up --build -d
# Open http://localhost:8080
```

Health endpoints:

- Bridge: `curl http://localhost:8641/api/health`
- Hermes: `curl -H "Authorization: Bearer $API_SERVER_KEY" http://localhost:8642/v1/models`

Tear down:

```bash
docker compose -f docker-compose.hermes.yml down -v
```

### 7. Run the test suite

```bash
# Bridge deps (one time)
uv venv .venv && source .venv/bin/activate
uv pip install -r carabiner/runtime/requirements.txt

# All bridge tests (skips real-Postgres + real-hermes unless env is set)
pytest tests/runtime/ -q

# All tests
pytest tests/ -q
```

Specific suites:

```bash
pytest tests/runtime/test_write_policy.py -q         # pure policy tests, no deps
pytest tests/runtime/test_card_lifecycle.py -q      # mocked audit + execution
pytest tests/runtime/test_read_flow.py -q           # mocked MCP, no DB
pytest tests/runtime/test_chat_flow_hermes.py -q    # fake-hermes ASGI stub on ephemeral port
pytest tests/runtime/test_chat_flow.py -q           # real python-socketio AsyncClient
pytest tests/runtime/test_contract_http.py -q       # FastAPI + httpx.ASGITransport

# Integration (requires Postgres)
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/carabiner_test \
  pytest tests/runtime/test_audit_log.py -q -m integration

# Live hermes smoke
HERMES_SMOKE=1 API_SERVER_KEY=... HERMES_BASE_URL=http://localhost:8642 \
  pytest tests/runtime/test_smoke_hermes.py -q

# Compose config validation
pytest tests/runtime/test_compose_config.py -q
```

### 8. Architecture cheat sheet

```
Next.js frontend  ──HTTP /message_async, /chats, /csrf_token──▶  ┌────────────────────────────┐
                  ──Socket.IO /ws (state_push, action_card,      │  carabiner/runtime bridge   │──SSE /v1/chat/completions──▶ hermes-agent
                     card_commit/dismiss/message)──────────────▶ │  (FastAPI + python-socketio)│◀──MCP (streamable-http /mcp)── gateway :8642
                                                                 │  policy · audit · cards     │
                                                                 └──────────┬─────────────────┘
                                                                            ▼
                                                                     PostgreSQL (carabiner/db)
```

- **Bridge on :8641** owns the frontend contract verbatim.
- **Hermes on :8642** runs as a separate process; bridge talks to it via SSE (`POST /v1/chat/completions` with `X-Hermes-Session-Id` header) and registers the scoped 2-tool MCP surface via URL (`mcp_servers.carabiner.url: "http://bridge:8641/mcp"`).
- **Policy** is host-side in `carabiner/runtime/policy.py` — verb × resource allowlist, enforced on propose AND on commit. The model cannot bypass it.
- **Audit** writes to `ActionLog` (`carabiner/db/workspace_models.py:388`) before the mutation on propose, and after on commit/dismiss. With `AUDIT_REQUIRED=true` (default), the bridge fails closed if the audit write raises.

### 9. Switching runtimes mid-session

- `CARABINER_RUNTIME=echo` — bridge uses canned responder, no hermes call. Useful for frontend dev without model keys.
- `CARABINER_RUNTIME=hermes` — bridge drives the real hermes gateway.
- Switch with: `export CARABINER_RUNTIME=hermes` then restart the bridge.

### 10. Rollback

- The legacy Agent Zero backend (`engine/agent-zero` submodule) is **not required** for the beta. The legacy `docker-compose.dev.yml` + `nginx.dev.conf` are untouched for reference. To roll back the runtime path, switch `A0_URL` back to the Agent Zero URL and use `docker-compose.dev.yml`.
- Migration of `carabiner/runtime/` is reversible: `git revert <commit-sha>` removes the bridge code; the legacy A0 stack is the parent commit.

### 11. Known issues + open questions

- `engine/agent-zero` submodule SHA `3c9b1d5f` is unreachable on remote (Fable audit §1). The legacy compose path is **unrunnable on any host other than Esteban's** until the agent-zero fork is pushed.
- FreshcOS is **documented as blocked** (see `docs/FRESHCOS_TO_CARABINEROS_SYNC.md`); the beta proceeds without it.
- `pnpm lint` may fail on `frontend/src/components/chat-composer.tsx:163` (pre-existing, not introduced by the migration).
- The bridge's `mcp_surface.py` may fall back from `streamable_http_app()` to `sse_app()` if the installed `mcp` package predates streamable-http. Both transports are supported by hermes-agent (verified at `/usr/local/lib/hermes-agent/tools/mcp_tool.py`).

### 12. Escalation

- **Bridge won't start:** check `CARABINER_RUNTIME`, `BRIDGE_PORT`, and that the venv has `fastapi`, `uvicorn[standard]`, `python-socketio`, `httpx` installed.
- **Hermes unreachable:** `curl http://localhost:8642/health` (no auth needed). If 5xx, check `var/hermes-home/hermes.log`.
- **Action cards not committing:** check `ActionLog` rows in Postgres for the `proposed` entry; the bridge fails closed on audit failure with `AUDIT_REQUIRED=true`.
- **MCP tools not discovered by hermes:** confirm `mcp_servers.carabiner.url` in the hermes config matches the bridge's address (Docker: `http://bridge:8641/mcp`; local: `http://localhost:8641/mcp`).