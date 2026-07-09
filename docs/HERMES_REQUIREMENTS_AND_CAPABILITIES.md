# Hermes Requirements & Capabilities (for CarabinerOS beta)

**Date:** 2026-07-09 · **Source audit:** §2 of `/root/.hermes/cache/documents/doc_9ff781471e8d_carabineros-hermes-migration-plan.md` (Fable 5 audit).

This document captures what the `hermes-agent` package actually provides, as verified from source on this machine on 2026-07-09. Every file-path citation is followed by `[VERIFIED]` or `[UNVERIFIED]` based on actual `ls`/`head` in this session.

**Verification status for this session:** the actual install is at **`/usr/local/lib/hermes-agent/`** (system Python venv, git checkout), **NOT** `/root/.hermes/hermes-agent/` as the Fable audit §2 stated. The P4 author originally cited the Fable path and flagged [UNVERIFIED]; main session then re-verified against the real install on this machine and flipped the tags. **Deltas vs the Fable audit:**

| Fable audit said | This machine has | Action |
|---|---|---|
| `~/.hermes/hermes-agent/` | `/usr/local/lib/hermes-agent/` | Update all citations to the real path |
| `hermes-agent==0.14.0` on PyPI | **v0.18.2** installed (commit `fac85518`, 2026-7-7, 47 commits behind upstream) | Pin to `hermes-agent==0.18.2` instead |
| `mcp==1.9.x` exact pin (Risk #3) | `mcp-1.26.0` is vendored in hermes-agent's venv | Pin `mcp==1.26.0` instead (or rely on hermes-agent's vendored copy) |
| `/v1/chat/completions`, `/v1/runs`, `/v1/models`, `/health` endpoints | All confirmed + extras: `/v1/responses`, `/v1/capabilities`, `/api/sessions`, `/v1/runs/{id}/events`, `/v1/runs/{id}/approval`, `/v1/runs/{id}/stop` | Update endpoint table to reflect actual surface |

These deltas apply to the bridge code in `carabiner/runtime/` and to `Dockerfile.hermes` and `scripts/run_hermes_beta.sh`.

---

## Pinned package

- **`hermes-agent==0.18.2`** is the version installed on this machine (per `hermes-agent --version`). The Fable audit said 0.14.0; this machine is **ahead**. Pin to whatever version is on the build host, but record the pin in `Dockerfile.hermes` so a fresh build is reproducible.
- The local install is a rolling git checkout: `hermes update` runs `git reset --hard origin/main`. That is **not reproducible**. The local checkout is currently 47 commits behind upstream — be ready to bump.
- **Beta policy:** pin via pip in a dedicated environment (`pip install hermes-agent==<VERSION>`) inside `Dockerfile.hermes` and `scripts/run_hermes_beta.sh`. The hermes configuration lives in `hermes/config.template.yaml` rendered into a gitignored `HERMES_HOME` (local: `var/hermes-home/`; Docker: a named volume mounted at `/opt/data`). The operator's personal `~/.hermes` is never modified.

---

## Gateway API server

**Surface:** an OpenAI-compatible HTTP API bound to `127.0.0.1:8642`. Mandatory `API_SERVER_KEY`; the gateway refuses to start without it.

**Citation:** `/usr/local/lib/hermes-agent/gateway/platforms/api_server.py` [VERIFIED — 219 KB, docstring lists every endpoint below; Fable audit's path `~/.hermes/hermes-agent/...` was wrong for this machine].

### Endpoints used by the beta

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/chat/completions` | Full agent **with tools**, SSE streaming, session continuity via `X-Hermes-Session-Id` header. Also `X-Hermes-Session-Key` for long-term memory scoping. |
| `POST` | `/v1/responses` | OpenAI Responses API format, stateful via `previous_response_id` |
| `GET`  | `/v1/responses/{response_id}` | Retrieve a stored response |
| `DELETE` | `/v1/responses/{response_id}` | Delete a stored response |
| `GET`  | `/v1/models` | Lists hermes-agent + any configured `model_routes` aliases |
| `GET`  | `/v1/capabilities` | Machine-readable API capabilities for external UIs |
| `GET/POST` | `/api/sessions` | List/create client-visible Hermes sessions |
| `GET/PATCH/DELETE` | `/api/sessions/{session_id}` | Read/update/delete a session |
| `GET`  | `/api/sessions/{session_id}/messages` | Read session message history |
| `POST` | `/api/sessions/{session_id}/fork` | Branch a session using SessionDB lineage |
| `POST` | `/api/sessions/{session_id}/chat[/stream]` | Chat with a persisted session |
| `POST` | `/v1/runs` | Async run kickoff (returns 202 + `run_id`) |
| `GET`  | `/v1/runs/{run_id}` | Retrieve current run status |
| `GET`  | `/v1/runs/{run_id}/events` | SSE event stream for the run |
| `POST` | `/v1/runs/{run_id}/approval` | HTTP-side approval (mirrors the shell-side dangerous-command approval) |
| `POST` | `/v1/runs/{run_id}/stop` | Cancel a running run |
| `GET`  | `/health` | Health check |
| `GET`  | `/health/detailed` | Rich status for cross-container dashboard probing |

### Key contract details for the bridge

- The request `model` field is **informational only**; the gateway resolves the model from its own config (`HERMES_MODEL` in the env is also informational — the real model lives in `hermes/config.template.yaml`). The bridge passes whatever the operator selected, but never trusts it for routing.
- SSE chunk shape drives the bridge parser; one live `curl -N` against the local gateway is required before finalizing the parser (Risk #2 in the migration plan).
- Auth: every request carries `Authorization: Bearer ${API_SERVER_KEY}`. Docker compose sets `API_SERVER_HOST=0.0.0.0` so the bridge container can reach it on `hermes:8642`.

---

## MCP client (in-bridge server)

The beta **does not** depend on the hermes subprocess's MCP client config in the legacy sense. Instead, the bridge exposes a **scoped 2-tool MCP server** at `/mcp` (FastMCP `streamable_http_app()`), and hermes's `mcp_servers` config points at it by URL.

### `mcp_servers` config shape

- **stdio:** `{"command": "...", "args": [...]}`
- **HTTP / streamable:** `{"url": "http://bridge:8641/mcp"}`

**Citation:** `/usr/local/lib/hermes-agent/tools/mcp_tool.py` [VERIFIED — 245 KB, supports stdio / StreamableHTTP / SSE; bridge mounts `streamable_http_app()` at `/mcp`; hermes connects via `mcp_servers.carabiner.url: "http://bridge:8641/mcp"`].

### Beta MCP surface (mounted inside the bridge)

| Tool | Purpose |
|---|---|
| `carabiner_read(resource, id?, filters?)` | Read across restaurants (delegates to `repositories.list_*` / `get_*`) |
| `carabiner_propose_write(resource, verb, data, reason)` | Policy gate → `ActionLog(status=proposed)` → emits `action_card` → returns "awaiting operator approval". **No mutation.** |

Mutation executes only in the `card_commit` socket handler with a policy **re-check**.

---

## Plugin + skills system

- Plugins register tools via `ctx.register_tool`, exposing OpenAI-style function-calling schemas.
- The skills system provides reusable procedural memory (Hermes's equivalent of CarabinerOS's `usr/skills/`).
- The beta does not introduce new in-process plugins; it consumes hermes's existing capabilities through the HTTP/MCP surface. Any CarabinerOS-specific skill additions go in `hermes/config.template.yaml`.

**Citation:** plugin/skill internals (no specific path cited beyond the high-level audit summary).

---

## Sessions / streaming / policy

- **Sessions** are SQLite-backed (`--resume` / `--continue` on the CLI; `X-Hermes-Session-Id` header over HTTP). The bridge maps each CarabinerOS `context` to a hermes session id and persists via the existing `FallbackChatStore` (`carabiner/chat_store.py`).
- **Streaming** comes in three flavors — SSE, in-process callbacks, and ACP `session_update`. The beta uses **SSE only**; ACP is rejected (see §Surfaces REJECTED).
- **Policy hooks:**
  - `pre_tool_call` shell hooks can **block** invocations.
  - Dangerous-command approval flow (shell-side).
  - HTTP-side approval via `POST /v1/runs/{id}/approval` (mirrors the shell flow for the bridge).
- The CarabinerOS **host-side policy** (`carabiner/runtime/policy.py`) sits in front of hermes and is **non-bypassable**: it runs on propose **and** on commit, with a re-check before mutation. The model cannot bypass it.

---

## Docker-ready

- **Official Dockerfile** + s6-overlay init (`/etc/s6-overlay/s6-rc.d/`); the hermes image runs as a supervised service tree.
- **`HERMES_HOME=/opt/data`** is the canonical data volume: holds config, sessions DB, skills, logs. Mounted as a named Docker volume in `docker-compose.hermes.yml`; rendered into `var/hermes-home/` for the local script path.
- **Compose env wiring:** `API_SERVER_HOST=0.0.0.0` so the bridge container can reach `hermes:8642`; `API_SERVER_KEY` shared with the bridge via the compose `environment:` block. The gateway refuses to start without `API_SERVER_KEY`.

---

## Surfaces REJECTED for the beta

| Surface | Why rejected |
|---|---|
| **ACP stdio adapter** | Richest structured stream, but the protocol is explicitly unstable and requires writing a separate ACP client. Adds a parallel transport without a clear beta win. |
| **`from run_agent import AIAgent` Python import** | Blocking, internal API, drifts with each release. Not a stable integration point — the API surface moves under us. |
| **`hermes proxy`** | A credential forwarder only — **not** the agent. Using it for the beta would silently drop all tool/MCP/policy capabilities. |

The accepted surface is **HTTP gateway + MCP client by URL**. Everything the beta needs (full agent with tools, sessions, SSE streaming, policy, MCP) is reachable through it.

---

**Re-verification checklist before merge (already VERIFIED on this machine 2026-07-09):**

- [x] `ls /usr/local/lib/hermes-agent/gateway/platforms/api_server.py` → file exists, 219 KB.
- [x] `ls /usr/local/lib/hermes-agent/tools/mcp_tool.py` → file exists, 245 KB.
- [x] `hermes-agent --version` → v0.18.2 (commit `fac85518`, 2026-7-7). Pin `Dockerfile.hermes` to `hermes-agent==0.18.2`.
- [x] mcp package: `/usr/local/lib/hermes-agent/venv/lib/python3.11/site-packages/mcp-1.26.0.dist-info/` ships vendored. Pin `mcp==1.26.0` or rely on hermes-agent's venv.
- [ ] On a fresh build host: `hermes gateway --help` (or equivalent) still binds `127.0.0.1:8642` and requires `API_SERVER_KEY`.