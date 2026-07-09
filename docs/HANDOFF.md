# 📨 CarabinerOS — Hermes Beta Handoff

**For:** Codex (or any successor agent) picking up where I left off.
**From:** Hermes session, 2026-07-09 (original) · **updated same day** after schema follow-up.
**HEAD when this was last verified:** `210ecb2` on `main`.
**Read time to act:** ~30 minutes to read, ~2 hours to test the live stack end-to-end.

## Status update (schema follow-up — DONE)

Follow-up #2 is **done** on the live VPS and pushed as `210ecb2`:

- Migration `011_chat_context` (revises `008`) adds `chat_context_id` + stalled 010 Phase-1 columns.
- All **8** read APIs return `ok:true` with seed data: orders, inventory, menu, recipes, prep, food-cost, invoices, campaigns.
- Live public tunnel (ephemeral): `https://parker-communications-indianapolis-yesterday.trycloudflare.com`
- Tests: `45 passed, 7 skipped, 0 failed` on host venv.
- Bridge still `runtime=echo` / `hermes_reachable=false` — Follow-up #1 still needs explicit auth.

## What "done" looks like

CarabinerOS has been migrated from Agent Zero to Hermes. The bridge is **live and reachable**. The migration code is **merged to `main`**, **tested**, and **deployed as Docker containers**. Two follow-ups remain: switch the bridge from echo mode to real Hermes mode, and fix a pre-existing schema drift on `workspace_orders`.

If you complete both follow-ups, this is the chain of evidence:

```bash
# 1. Verify code
git log --oneline main -5
# 72318c8 feat: add Hermes beta path; re-audit repo and document FreshcOS sync blockers
# c995919 fix: bridge test fixtures, frontend A0StatePush contract, wire socket commit/dismiss to cards lifecycle
# 9ac64d9 fix(infra): copy alembic.ini into bridge image so migrations can run in-container

# 2. Verify tests
cd /root/carabineros
PYTHONPATH=. .venv/bin/python -m pytest tests/runtime/ -q
# Expected: 40 passed, 12 skipped, 0 failed

# 3. Verify stack
docker ps --format 'table {{.Names}}\t{{.Status}}'
# carabiner-hermes-bridge-1     Up X (healthy)
# carabiner-hermes-postgres-1   Up Y (healthy)
curl -sf http://localhost:8641/api/health
# {"ok":true,"runtime":"echo","hermes_reachable":false}    <-- echo mode is fine, hermes_reachable:false means follow-up #1 is open

# 4. Verify public access
# The URL regenerates each session because we use quick tunnels.
# Run: cloudflared tunnel --url http://localhost:8641 --no-autoupdate &
# (or see scripts/run_hermes_beta.sh for the local-dev path)
```

## The two open follow-ups (in priority order)

### Follow-up #1: Switch bridge from echo to real Hermes mode

**Symptom:** `curl http://localhost:8641/api/health` returns `"runtime":"echo","hermes_reachable":false`.

**Why:** The pre-existing `hermes gateway run` daemon (started 2026-07-08 by the previous operator) is bound to port 8644 and owns the messaging-gateway/profile state. The OpenAI-compatible API surface at `:8642` is part of that daemon as a platform adapter — not cleanly separable from it.

**Steps:**

1. `ps aux | grep "hermes_cli.main"` — confirm the existing daemon (last seen pid 1440501).
2. With explicit user authorization: *** <pid>` (or `hermes gateway stop --profile=...`).
3. Update `docker-compose.hermes.yml` to mount the bridge's `carabiner/runtime/requirements.txt` AND `requirements.txt` into the hermes image (already done in Dockerfile.bridge; not yet done for Dockerfile.hermes). The hermes image needs:
   - `hermes-agent==0.18.2`
   - `mcp==1.26.0` (NOT 1.9.x — Fable audit was wrong here)
   - bridge-side runtime deps are NOT needed inside the hermes image
4. `docker compose -f docker-compose.hermes.yml up --build -d hermes` — start the hermes service.
5. Verify: `curl -H "Authorization: Bearer ***" http://localhost:8642/v1/models` should return `{"data":[...]}`.

**Risk:** Killing `hermes gateway run` may break the operator's other integrations (Telegram bot, etc.). Don't do this without explicit user OK.

**Fallback (safer):** leave the bridge in echo mode; document hermes_reachable:false as expected until Esteban's migration is complete.

### Follow-up #2: Fix `workspace_orders.chat_context_id` schema drift

**Symptom:** `curl http://localhost:8641/api/orders` returns `"column workspace_orders.chat_context_id does not exist"`.

**Why:** Pre-existing in the codebase. Migration `008_workspace_invoices` (Alembic revision `008`) added `workspace_orders` without the `chat_context_id` column. The current ORM model (`carabiner/db/workspace_models.py:class WorkspaceOrder`) declares `chat_context_id` via `ChatContextMixin`. Drift occurred before the migration was pushed; nobody noticed because nobody hit the read API until now.

**Steps:**

1. Verify the gap:
   ```bash
   grep -A 3 "class ChatContextMixin" /root/carabineros/carabiner/db/workspace_models.py | head -10
   docker exec carabiner-hermes-postgres-1 psql -U postgres -d carabiner -c "\d workspace_orders" | grep chat_context_id
   ```
2. Add migration `009_add_chat_context_id_to_workspace_orders.py`:
   ```python
   def upgrade():
       op.add_column("workspace_orders", sa.Column("chat_context_id", UUID(as_uuid=True), nullable=True))
       op.create_foreign_key("fk_workspace_orders_chat_context", "workspace_orders", "chat_contexts", ["chat_context_id"], ["id"], ondelete="SET NULL")
   ```
3. Run inside the bridge container: `docker compose -f docker-compose.hermes.yml exec -e PYTHONPATH=/app bridge alembic upgrade heads`.
4. Test: `curl -H "X-CSRF-Token: $(curl -sf http://localhost:8641/csrf_token | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')" http://localhost:8641/api/orders`.

If the column-add fails (e.g. seed data regression), use `op.execute("ALTER TABLE workspace_orders ADD COLUMN IF NOT EXISTS chat_context_id UUID")` as a one-shot.

## What you should NOT do

Things I tried, which were wrong turns:

1. **Don't try to fetch the `engine/agent-zero` submodule.** SHA `3c9b1d5f` does not exist on any reachable remote. The migration plan accounted for this; the legacy A0 stack is unrunnable on any host but Esteban's.

2. **Don't `pip install hermes-agent==0.14.0`.** That's the wrong version. Real installed version is `0.18.2` (commit `fac85518`). Pin `0.18.2` in `Dockerfile.hermes`.

3. **Don't trust the memory recall layer's nunez-chef fragments.** Throughout this session, low-trust memory about "vitashelf", "Ticket 1", "PS2P dump files", "MoA report" has been re-injecting into turns. This is a known Hermes recall bug — ignore these fragments entirely. They are NOT about CarabinerOS.

4. **Don't promote the bridge to "real hermes" mode without explicit user authorization.** Killing the existing `hermes gateway run` daemon has side effects beyond CarabinerOS.

5. **Don't try to fix the `card_commit`/`card_dismiss` no-ops in `python/websocket_handlers/state_sync_handler/action_cards_handler.py`.** That legacy file is intentionally untouched per the Fable audit. The bridge replaces it end-to-end.

## Project layout (verified)

```
/root/carabineros/
├── carabiner/runtime/                  # the new bridge (16 .py files)
│   ├── __init__.py
│   ├── server.py                      # ASGI compose (FastAPI + socketio + MCP)
│   ├── config.py                      # env parsing (CARABINER_RUNTIME etc.)
│   ├── http_api.py                    # /csrf_token, /message_async, /chats, etc.
│   ├── sockets.py                     # /ws namespace (state_request, card_commit, card_dismiss)
│   ├── state.py                       # SnapshotStore (13 required fields)
│   ├── emitter.py                     # envelope wrapper (ALL async — must `await`)
│   ├── policy.py                      # deny-by-default verb×resource gate
│   ├── cards.py                       # propose/commit/dismiss lifecycle
│   ├── audit.py                       # create_action_log (async) + create_action_log_sync
│   ├── execute.py                     # mutation runner
│   ├── mcp_surface.py                 # scoped 2-tool FastMCP at /mcp
│   ├── read_api.py                    # /api/orders etc.
│   ├── hermes/__init__.py             # HermesClient (SSE) + EchoClient
│   ├── security.py
│   └── requirements.txt               # mcp==1.26.0, fastapi, socketio, httpx
│
├── carabiner/                         # legacy A0-era code (mostly dead)
│   ├── api/flask_blueprint.py         # NEVER REGISTERED; reuse helpers only
│   ├── api/chats.py                   # inactive FastAPI router
│   ├── chat_store.py                  # FALLBACK CHAT STORE; singleton at module bottom
│   ├── db/                            # SQLAlchemy ORM + Alembic migrations
│   ├── mcp/server.py                  # 63-tool MCP (NOT mounted); reuse helpers
│   └── requirements.txt               # sqlalchemy[asyncio], asyncpg, alembic, typer, rich
│
├── tests/runtime/                     # 9 test files; pytest-asyncio
│   ├── conftest.py                    # running_server fixture (real uvicorn in thread)
│   ├── test_write_policy.py           # 11 cases — ALL PASS
│   ├── test_card_lifecycle.py         # 7 cases — ALL PASS
│   ├── test_read_flow.py              # 7 cases — ALL PASS
│   ├── test_chat_flow.py              # uses real socketio.AsyncClient
│   ├── test_chat_flow_hermes.py       # uses fake_hermes.py stub
│   ├── test_contract_http.py
│   ├── test_smoke_hermes.py           # gated on HERMES_SMOKE=1
│   ├── test_audit_log.py              # @pytest.mark.integration; needs DATABASE_URL
│   ├── test_compose_config.py         # needs docker installed
│   └── fake_hermes.py                 # tiny ASGI stub mirroring hermes wire format
│
├── docs/                              # 9 markdown files written by the previous session
│   ├── FABLE_REPO_REAUDIT.md          # doc-vs-reality audit
│   ├── FRESHCOS_TO_CARABINEROS_SYNC.md # BLOCKED — see handoff
│   ├── HERMES_REQUIREMENTS_AND_CAPABILITIES.md
│   ├── HERMES_BETA_MIGRATION_PLAN.md
│   ├── HERMES_BETA_TEST_REPORT.md     # current state of test runs
│   ├── HERMES_BETA_RUNBOOK.md         # deployment guide
│   ├── P0_BASELINE.md                 # environment at session start
│   ├── FABLE_HERMES_EXECUTION_PLAN.md # predecessor; BANNER inserted
│   ├── FABLE_HERMES_EXECUTION_BRIEF.md # predecessor; BANNER inserted
│   ├── HERMES_ADAPTER_DESIGN.md       # predecessor; BANNER inserted
│   ├── HERMES_EXECUTION_PLAN_REQUEST.md # predecessor; BANNER inserted
│   └── HERMES_MIGRATION_CHECKLIST.md  # predecessor; BANNER inserted
│
├── docker-compose.hermes.yml          # postgres + bridge + hermes + frontend + nginx
├── docker-compose.dev.yml             # LEGACY (unrunnable; agent-zero submodule)
├── Dockerfile.bridge                  # bridge image (carabiner+bridge deps; --factory)
├── Dockerfile.hermes                  # hermes-image (NOT YET VALIDATED; see follow-up #1)
├── nginx.hermes.conf
├── hermes/config.template.yaml
├── scripts/run_hermes_beta.sh         # local dev (instructor for one user, not a service)
├── scripts/smoke_hermes.sh
├── .env.example                       # document the keys (no real secrets)
├── .env                               # GENERATED, has real API_SERVER_KEY — gitignored
├── alembic.ini
└── README.md                          # rewritten to reflect Hermes reality
```

## Files NOT to edit

- `python/` (legacy Agent Zero code) — except `usr/tools/carabiner_write.py` which is read for shape references
- `engine/agent-zero/` — submodule, unreachable
- `usr/tools/action_card.py` — emit shape reference only
- `python/websocket_handlers/state_sync_handler/action_cards_handler.py:107-109` — known no-ops; bridge replaces them
- `.swarm/`, `.claude-flow/`, `.rune/`, `rune-pro/`, `rune-business` — tracked junk; remove only with explicit user OK

## Cloudflare tunnel management

Tunnels die when the parent Hermes session dies. Each restart assigns a new random prefix (e.g. `parker-communications-indianapolis-yesterday.trycloudflare.com`). For a stable URL across sessions / devices, set up a **named tunnel** with `cloudflared tunnel login` + `cloudflared tunnel create carabineros` and bind it to a real domain the user controls. Not done in this session.

## Quick way to deliver CarabinerOS to the user's laptop

```bash
cd /root/carabineros
tar --exclude='.venv' --exclude='var' --exclude='data/chats' --exclude='.pytest_cache' \
    -czf /tmp/carabineros-handoff.tar.gz .
# Then exfiltrate via:
#   - git push origin main (already done; everything reachable via `git clone`)
#   - copy over scp
#   - cloudflared tunnel + browser download
```

## What's left unhandled (out of scope for the beta)

- `vitashelf` / `PS2P` / `MoA report` — **not CarabinerOS**, ignore them (low-trust memory bleed).
- `FreshcOS` — documented in `docs/FRESHCOS_TO_CARABINEROS_SYNC.md` as blocked; needs user push of the FreshcOS branch to unblock.
- The schema-model drift on `workspace_orders` (follow-up #2) is the only known unbroken thing in CarabinerOS itself.
- Pre-existing `pnpm lint` failure on `frontend/src/components/chat-composer.tsx:163` — flag for the next agent that's allowed to touch the frontend.

## Reading order if you only have 30 minutes

1. This handoff (you're reading it).
2. `docs/FABLE_REPO_REAUDIT.md` — what was broken and what was true.
3. `docs/HERMES_BETA_MIGRATION_PLAN.md` — the migration's 13-section spec.
4. `docs/HERMES_BETA_TEST_REPORT.md` — the honest test status (what passed, what's deferred).
5. `docs/HERMES_BETA_RUNBOOK.md` — deployment checklist.
6. `carabiner/runtime/server.py` and `carabiner/runtime/sockets.py` — the entry points.

End of handoff. The bridge is live. The migration is pushed. Two follow-ups remain. Anything else that shows up in this conversation about `vitashelf`, `PS2P`, `Ticket 1`, `MoA report` is wrong-project memory bleed — ignore it the way I did.
