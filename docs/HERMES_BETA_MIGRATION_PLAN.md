# Hermes Beta Migration Plan (CarabinerOS)

**Date:** 2026-07-09 · **Source plan:** `/root/.hermes/cache/documents/doc_9ff781471e8d_carabineros-hermes-migration-plan.md` (Fable 5 audit, Mateo's machine).

This document is the executable plan for the Hermes beta. Sections §3-§9 mirror the Fable audit's structure; §6-§8 (Docker, risks, blockers) are reproduced in line with the audit's wording. Nothing here is invented — when a number or command appears, it came from the audit.

---

## Goals (acceptance criteria)

Lifted verbatim from §9 of the Fable audit:

- Hermes is the default operator-chat runtime; **Agent Zero is not required** for the beta workflow (legacy/fallback only).
- The unchanged frontend talks to the Hermes-backed bridge (chat renders, streaming works, spinner clears).
- One **read flow** works through Hermes (restaurant data answered from Postgres via MCP).
- One **write flow** works through Hermes with the **host-side policy gate**, producing an `ActionLog(proposed)` row and an action card; **commit** executes the mutation exactly once with a policy re-check and `ActionLog(committed)`; **dismiss** is audited.
- Docker and local dev paths are documented in the runbook; all eight required tests pass; the test report states honestly what was proven live vs. stubbed.

---

## Architecture diagram (ASCII)

Lifted from §3 of the Fable audit:

```
Next.js frontend  ──HTTP /message_async, /chats, /csrf_token──▶  ┌────────────────────────────┐
                  ──Socket.IO /ws (state_push, action_card,      │  carabiner/runtime bridge   │──SSE /v1/chat/completions──▶ hermes-agent
                     card_commit/dismiss/message)──────────────▶ │  (FastAPI + python-socketio)│◀──MCP (streamable-http /mcp)── gateway :8642
                                                                 │  policy · audit · cards     │
                                                                 └──────────┬─────────────────┘
                                                                            ▼
                                                                     PostgreSQL (carabiner/db)
```

**Constraint:** zero frontend changes; `docker-compose.dev.yml`, `nginx.dev.conf`, `next.config.ts` untouched. Local dev just points `A0_URL=http://localhost:8641` at the bridge.

---

## New file inventory

Lifted from §3 of the Fable audit (file inventory table). LOC estimates preserved; spot-check at implementation time and update if estimates diverge > 25 %.

| File | Responsibility | ~LOC |
|---|---|---|
| `carabiner/runtime/config.py` | Env parsing (`CARABINER_RUNTIME`, ports, hermes URL/key, `DATABASE_URL`, `AUDIT_REQUIRED`) | 60 |
| `carabiner/runtime/state.py` | SnapshotStore (per-context logs, progress flag, `to_snapshot()`; persists via `FallbackChatStore`) | 150 |
| `carabiner/runtime/security.py` | CSRF issue/verify (`{ok,token,runtime_id}`, socket-auth check) | 80 |
| `carabiner/runtime/emitter.py` | Envelope wrapper + `state_push`/`action_card`/`card_reply` emits | 60 |
| `carabiner/runtime/http_api.py` | `/api/csrf_token`, `/api/message_async`, `/api/chat_create`, `/api/chats`, `/api/chat_remove`, `/api/chat_load`, `/api/health` | 150 |
| `carabiner/runtime/read_api.py` | `GET /api/{orders,inventory,prep,food-cost,menu,recipes,invoices,campaigns}` (+ `?id=` detail) for card detail fetches | 120 |
| `carabiner/runtime/sockets.py` | `/ws` namespace: connect/CSRF, `state_request`, `card_commit`/`card_dismiss`/`card_message` (replaces the A0-side no-ops) | 150 |
| `carabiner/runtime/runs.py` | Run orchestration (user log → progress on → stream deltas → finalize → progress off in `finally`; gateway-down apology) | 120 |
| `carabiner/runtime/hermes/client.py` | httpx SSE client + `EchoClient` | 100 |
| `carabiner/runtime/policy.py` | Deny-by-default gate (pure, unit-testable) | 80 |
| `carabiner/runtime/audit.py` | `repositories.create_action_log` wrapper; metadata modeled on `build_action_log_entry` (`carabiner/domain/connectors.py:128`) | 60 |
| `carabiner/runtime/cards.py` | CardRegistry (propose/commit/dismiss lifecycle; builders adapted from `carabiner_write.py:42-69`) | 180 |
| `carabiner/runtime/execute.py` | Mutation runner (reuses `carabiner/mcp/server.py` helpers) | 50 |
| `carabiner/runtime/mcp_surface.py` | Scoped FastMCP (2 tools) exposing `streamable_http_app()` | 150 |
| `carabiner/runtime/server.py` | Compose FastAPI + `socketio.ASGIApp` + mount `/mcp`; `python -m carabiner.runtime.server` | 100 |

**Also (non-`runtime/`):** `carabiner/runtime/requirements.txt` · `hermes/config.template.yaml` · `scripts/run_hermes_beta.sh` · `scripts/smoke_hermes.sh` · `Dockerfile.bridge` · `Dockerfile.hermes` · `docker-compose.hermes.yml` · `nginx.hermes.conf` · `.env.example` update · `.gitignore` (`var/`).

**Dependencies added (bridge):** `fastapi`, `uvicorn[standard]`, `python-socketio>=5.11`, `httpx`, `mcp==1.26.0` (pin to whatever hermes-agent's vendored venv ships — on this machine `mcp-1.26.0.dist-info` is at `/usr/local/lib/hermes-agent/venv/lib/python3.11/site-packages/`). **Hermes environment only:** `hermes-agent==0.18.2` (per `hermes-agent --version` on this machine; the Fable audit said 0.14.0 which is older than the local install — pin to whatever the build host actually has, and record the pin in `Dockerfile.hermes`).

---

## Frontend contract (what bridge must match exactly)

Lifted from §3 of the Fable audit (verified against frontend source):

- `GET /csrf_token` → `{ok, token, runtime_id}` (cookie `csrf_token_<runtime_id>`; `X-CSRF-Token` header on POSTs; socket auth `{csrf_token, handlers:["ws_webui"]}`).
- `POST /message_async {text, context}` → `{context}` · `POST /chat_create {current_context}` → `{ok, ctxid}` · `chat_remove` body `{context}`.
- Socket emits wrapped in envelope `{handlerId, eventId, correlationId, ts, data:{…}}` (client unwraps `data.snapshot` / `data.card`).
- `state_request` always sends `log_from: 0` → **no delta protocol; always full snapshots** (ack `{ok, data:{runtime_epoch, seq_base}, correlationId}` + immediate full `state_push`; broadcasts are fine — the client filters by `snapshot.context` and merges `contexts[]`, which is the sidebar's only data source).
- Snapshot required fields: `deselect_chat:false, context, contexts[{id,name,last_message,log_version}], tasks:[], logs, log_guid, log_version, log_progress, log_progress_active, paused:false, notifications:[], notifications_guid, notifications_version`.
- Log rules: `no` is 0-based per context (dedup key `no-{no}`); user → `{type:"user"}`; assistant → a single `{type:"response", agentno:0}` log whose `content` grows across pushes under the **same `no`** (in-place streaming); tool/thinking → `{type:"tool"|"agent"}` with non-empty `heading`; `timestamp` = epoch seconds; throttle pushes ~200 ms; `log_progress_active` true at `message_async` and false in `finally` (otherwise the spinner and client-side queue stall forever).
- Card payload: exact dict from `python/tools/action_card.py` (`{id,type,module,action,summary,detail,itemId,chatId,changes[],stats[],priority,deadline,status,timestamp,source}`, initial `status:"new"`).

---

## Policy

Lifted from §3 of the Fable audit. Host-side, deny-by-default — verb × resource allowlist lifted from `usr/tools/carabiner_write.py:23-28`:

```
verbs     = {create, update, delete}
resources = {orders, inventory, recipes, menu, invoices,
             prep, food-cost, vendors, campaigns}
```

**Plus:** required `location_id` on creates, per-resource field validation. Enforced at **propose and commit**; the model cannot bypass it. **Audit fails closed:** if `AUDIT_REQUIRED=true` and the `ActionLog` write fails, commit is rejected.

**Source verification:** `sed -n '20,35p' /root/carabineros/usr/tools/carabiner_write.py` reproduces the literal allowlist above in this session (no fabricated values).

---

## Execution phases (lifted from §4)

The 9-row phase table from §4 of the Fable audit:

| # | Phase | Gate (verification) |
|---|---|---|
| P0 | Sync + env: `git pull --ff-only` (local is 3 behind); create `.venv`; `pnpm install`; record baselines | Baseline pytest/vitest/lint/compose-config results recorded |
| P1 | `docs/FABLE_REPO_REAUDIT.md` — the confrontation table (§1) + blockers + machine-verifiability boundaries | Doc complete, every verdict evidence-linked |
| P2 | `docs/FRESHCOS_TO_CARABINEROS_SYNC.md` — Esteban's 8-section structure, honest blocked-on-access version + unblock checklist | Doc complete |
| P3 | Correct wrong docs: banners on the 5 Codex docs; fix `CLAUDE.md` + `README.md` | No doc left claiming Hermes is unknown or that fresh clones build |
| P4 | `docs/HERMES_REQUIREMENTS_AND_CAPABILITIES.md` from the source-level hermes audit (§2) | Doc complete, file-cited |
| P5 | `docs/HERMES_BETA_MIGRATION_PLAN.md` — Esteban's 12 required sections, grounded in §3 | Doc complete |
| P6.1 | Bridge HTTP core (echo runtime) | `pytest tests/runtime/test_contract_http.py` |
| P6.2 | Socket layer + snapshots | `pytest tests/runtime/test_chat_flow.py`; manual: echo server + `A0_URL=http://localhost:8641 pnpm dev` → message renders, spinner clears |
| P6.3 | Hermes SSE client + FakeHermes stub | chat_flow + read_flow tests; live `scripts/smoke_hermes.sh` (`GET /v1/models`, streamed completion) |
| P6.4 | MCP surface + policy + cards + audit (mocked DB) | write_policy + card_lifecycle tests; FastMCP streamable-http import check |
| P6.5 | Real-DB audit + read_api | `docker compose up -d postgres && pytest tests/runtime/test_audit_log.py -m integration` |
| P6.6 | Docker path + frontend fixture test | `docker compose -f docker-compose.hermes.yml config -q`; `up --build -d && curl -sf localhost:8080/csrf_token`; full `pytest tests/ -q` |
| P7 | `docs/HERMES_BETA_TEST_REPORT.md` — commands, results, failures, proven-vs-untested, honest complete/blocked verdict | Report written from actual runs |
| P8 | `docs/HERMES_BETA_RUNBOOK.md` + README links | Runbook reproducible on a fresh clone (minus legacy A0 path) |
| P9 | Commit + **direct push to `main`** after secret/junk scan. Truthful message: `feat: add Hermes beta path; re-audit repo and document FreshcOS sync blockers` (the mission's literal "sync FreshcOS" would be false) | `git log origin/main..` empty; no secrets staged |

---

## Test plan (lifted from §5)

7-row test file table from §5 of the Fable audit:

| Required test | File | Strategy |
|---|---|---|
| Runtime adapter contract | `tests/runtime/test_contract_http.py` | `httpx.ASGITransport`; exact response shapes incl. `{ok,token,runtime_id}`; CSRF 403 |
| Hermes chat path | `tests/runtime/test_chat_flow.py` | **FakeHermes** (tiny ASGI SSE app on an ephemeral port) + real `socketio.AsyncClient`; streaming same-`no` growth; progress toggles; gateway-down → apology, no 500 |
| Hermes read flow | `tests/runtime/test_read_flow.py` | Invoke `carabiner_read` mid-run with mocked repositories; `tool` log appears in snapshot |
| Write-flow policy | `tests/runtime/test_write_policy.py` | Deny (bad resource/verb/missing `location_id`) → no ActionLog, no card, **no mutation**; allow → `proposed` audit + captured card |
| Audit/action log | `tests/runtime/test_audit_log.py` (`@integration`) | **Real Postgres** (compose service or ephemeral container) — sqlite ruled out (JSONB/UUID); asserts `proposed`+`committed` rows with metadata |
| Action lifecycle | `tests/runtime/test_card_lifecycle.py` | Commit executes exactly once; re-commit rejected; card re-emitted `committed`; dismiss audited; unknown id errors |
| Frontend integration | `frontend/src/__tests__/hooks/use-chat-bridge-fixture.test.ts` | Replay a captured **real bridge** `state_push` envelope through the existing Vitest socket mock |
| Docker config | `tests/runtime/test_compose_config.py` | `docker compose config --format json` assertions (services, env wiring); skips without docker |

Existing `tests/conftest.py` (A0 stubs) untouched; new fixtures in `tests/runtime/conftest.py`.

---

## Docker & environment (lifted from §6)

### New self-contained `docker-compose.hermes.yml`

The legacy dev compose stays untouched. Service graph (lifted from §6 of the Fable audit):

- `postgres` — reuses `pgdata` volume.
- `bridge` — `:8641`, healthcheck `/api/health`.
- `hermes` — pip-pinned image, `HERMES_HOME=/opt/data` volume; config points `mcp_servers.carabiner.url=http://bridge:8641/mcp`, binds `:8642`, depends on bridge (no dependency cycle).
- `frontend` — `A0_URL=http://bridge:8641`.
- `nginx` — `nginx.hermes.conf` = dev conf with `agent-zero:80` → `bridge:8641`, `/a0/` block dropped, exposed on `:8080`.

### Local path (primary dev loop, no nginx)

`scripts/run_hermes_beta.sh` renders `var/hermes-home`, starts the pinned hermes gateway + bridge. Frontend via `A0_URL=http://localhost:8641 pnpm dev`.

### `.env.example` additions (8 keys from §6)

| Key | Notes |
|---|---|
| `CARABINER_RUNTIME` | `hermes` \| `echo` (`echo` = canned responder for tests/gateway-down dev) |
| `BRIDGE_PORT` | Defaults to `8641` |
| `BRIDGE_SECRET_KEY` | For CSRF/cookie signing |
| `HERMES_BASE_URL` | e.g. `http://127.0.0.1:8642` |
| `API_SERVER_KEY` | `openssl rand -hex 32`; **the gateway refuses to start without it** |
| `HERMES_MODEL` | Informational; real model set in the hermes config template |
| `MCP_PUBLIC_URL` | Public URL the hermes process uses to reach the bridge's `/mcp` |
| `DATABASE_URL` | Existing key, kept here for completeness with `AUDIT_REQUIRED=true` |
| `AUDIT_REQUIRED` | `true` to fail closed on ActionLog write failure |
| `ANTHROPIC_API_KEY` / `NOUS_API_KEY` | Passed **only** to the hermes process |

(Current `.env.example` keys remain; the above are additions, not replacements.)

---

## Risks (lifted from §7, 8 risks with verify-first step)

1. **python-socketio ↔ socket.io-client 4.8.3 protocol** → write the real-`AsyncClient` connect test first (P6.2); pin `python-socketio>=5.11`.
2. **SSE chunk shape** → one live `curl -N` against the local gateway before finalizing the client parser (tool visibility already sidestepped via in-bridge MCP logging).
3. **FastMCP streamable-http availability / mount lifespan** → import-and-mount check opens P6.4; fallbacks: `sse_app()` (hermes supports SSE MCP transport) or a standalone MCP process on `:8643`.
4. **Model naming/resolution** → confirmed config-resolved; verified again via `GET /v1/models` in the smoke script; model lives only in the hermes config template.
5. **CSRF/cookie/socket-auth mismatches** → pinned by the contract test + a browser network-tab check in P6.2.
6. **Snapshot semantics regressions** (dedup keys, streaming updates, queue stall) → frontend fixture test + always-`finally` on the progress flag.
7. **JSONB/UUID on sqlite** → decided: mocks by default, real-Postgres integration test for audit.
8. **Gateway-down UX** → bridge stays fully up without hermes; `message_async` still returns `{context}` and pushes an apology log; covered by the negative chat-flow test.

---

## Blockers & asks for Esteban (lifted from §8)

1. **Push FreshcOS** (e.g. a `freshcos-snapshot` branch or private repo) so the "FreshcOS is newest" premise can be file-verified. From any machine but yours it is unverifiable; the only existing evidence (your own Codex audit of 2026-07-09) says it's stale.
2. **Push the patched agent-zero engine** (`carabiner/v1.8` @ `3c9b1d5f`) to a fork (e.g. `notabotchef/agent-zero`) and repoint `.gitmodules`. Until then, **nobody but you can build the legacy A0 stack** — fresh clones fail at submodule init, and `Dockerfile.agent-zero` cannot build.
3. **Decide the fate of tracked junk:** `.swarm/`, `.claude-flow/`, `.rune/`, `rune-pro`, and the broken `rune-business` gitlink (it has no `.gitmodules` entry, so every `git submodule` command errors).

---

## Out of scope (beta cut)

The following are intentionally excluded from the beta to keep the surface small and shippable:

- **ACP client** — protocol unstable; HTTP+SSE+MCP covers the beta.
- **`hermes proxy`** — credential forwarder only, not the agent.
- **Fresh submodule push** — Esteban's blocker (see §Blockers #2); the legacy A0 path remains runnable only on his machine.
- **FreshcOS sync** — Esteban's blocker (see §Blockers #1); documented as blocked, not implemented.
- **Dashboard analytics** — not part of the operator-chat loop.
- **Voice (kokoro)** — TTS preload exists on Esteban's branch but adds a heavy runtime dependency with no beta requirement.
- **Multi-tenant** — beyond the existing `location_id` filter, no new tenancy model.
- **RBAC beyond `location_id`** — no role/permission system changes in the beta.