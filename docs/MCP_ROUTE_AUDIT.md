# MCP as the Hermes↔Bridge Route — Honest Audit

**Date:** 2026-07-10 · **Repo:** `/root/carabineros` · **HEAD:** `791778b`
**Trigger:** "Nginx 8090, let's audit and see if the mcp tool is the best route."

This is a **read-only audit**. No rearchitecture. No code changes
beyond what nginx → 8090 already shipped. Every claim below is
file-linked or curl-proven.

---

## TL;DR

**MCP is the right *protocol class*, but the current mount is not
working end-to-end. Two paths forward:** (A) make the bridge's MCP
surface actually serve `initialize` + `tools/list` + `tools/call`
properly — small fix; OR (B) drop MCP and use Hermes' first-class
**OpenAI-compatible `tools` array** on `/v1/chat/completions`,
exposing the same two tools via the bridge's own HTTP endpoint.
Path B is simpler, removes a moving part, and matches how the
production feature plan §3 said it would work *before* the MCP
mount got introduced.

The decision is yours. This doc is the audit, not the decision.

---

## 1. What the current route is

```
hermes (gateway :8642)
  mcp_servers:
    carabiner:
      url: "http://bridge:8641/mcp"     # var/hermes-home/config.yaml:26-28
        │
        ▼  HTTP POST initialize / tools/list / tools/call
bridge (FastAPI + python-socketio :8641)
  carabiner.runtime.server.build_server()
    fastapi_app.mount("/mcp", streamable_http_app())
        │
        ▼  delegates to
carabiner.runtime.mcp_surface
  _mcp_instance = FastMCP("carabiner_bridge", json_response=True)
  @mcp.tool() carabiner_read(...)
  @mcp.tool() carabiner_propose_write(...)
        │
        ▼  delegates to
carabiner.mcp.server  (the legacy 63-tool helper source — we use
                       only `_MODULE_REGISTRY`, `_serialise`,
                       `_slim`, `_resolve_repo_fn`, `_coerce_types`,
                       `_prepare_data`, plus the repositories in
                       `carabiner/db/repositories.py`)
```

The **shape** is correct. Two tools. Host-side policy gate. Audit
row. No mutation in the tool itself. The bridge owns the contract;
hermes just calls.

## 2. What is actually working right now

| Layer | Status | Evidence |
|---|---|---|
| Bridge binds `:8641` | ✅ | `docker ps` shows healthy |
| `/api/health`, `/api/orders`, `/csrf_token` | ✅ | all 200 from host |
| `/mcp` mount point exists | ✅ | `GET /mcp` → 307 redirect |
| FastMCP instance builds | ✅ | `carabiner/runtime/mcp_surface.py:71-79`; `streamable_http_app()` returns a Starlette app |
| Tool functions registered | ✅ | unit-level; both decorated with `@mcp.tool()` |
| **FastMCP `initialize` handshake over HTTP** | ❌ | `POST /mcp/` returns **404 Not Found** |
| **Hermes can list the two tools** | ❌ | no observed `tools/list` round-trip; hermes logs no MCP discovery |
| **Hermes can call `carabiner_read` mid-chat** | ❌ | not exercised live (probes A+B above) |
| **Bridge emits `action_card` from a real MCP call** | ❌ | unproven; bridge exposes `/api/orders` HTTP regardless |
| **ActionLog `proposed` row written by MCP path** | ❌ | unproven |

## 3. The bug, exactly

```
$ curl -i -X POST -H 'Content-Type: application/json' \
       -H 'Accept: application/json, text/event-stream' \
       --data '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' \
       http://127.0.0.1:8641/mcp
HTTP/1.1 307 Temporary Redirect
location: http://127.0.0.1:8641/mcp/

$ curl -i -X POST ... http://127.0.0.1:8641/mcp/
HTTP/1.1 404 Not Found
```

FastMCP's `streamable_http_app()` is mounted as a **sub-application**
at `/mcp`. Starlette's `Mount` redirects the bare path to the trailing
slash (`/mcp/`). Once on `/mcp/`, the MCP route handler must serve
`initialize` on POST and route other JSON-RPC methods. The **307
happens but the sub-app's POST handler does not match the
`/mcp/` prefix on the way in**, so we get 404.

Most likely cause: `streamable_http_app()` was mounted with
`fastapi_app.mount("/mcp", ...)` (no trailing slash) which Starlette
redirects to `/mcp/`, but the inner route inside the FastMCP app is
defined relative to `/`, not `/mcp/`. The redirect strips the trailing
slash from the path and the inner app can't see it. Two standard
fixes:

1. `fastapi_app.mount("/mcp", ..., name="mcp")` with the FastMCP app
   rebuilt via `FastMCP("…", streamable_http_path="/")` (or
   equivalent) so inner routes are root-relative.
2. Use `add_route` (or a single `fastapi_app.add_api_route("/mcp",
   streamable_http_app().routes[0].endpoint, methods=[...])`) instead
   of `Mount`.

This is a **two-to-ten-line** fix, scoped to `server.py` lines
75-87. Not done in this audit because it's a code change and you
asked for audit, not fix.

## 4. The alternative — OpenAI tool calling on `/v1/chat/completions`

Hermes' gateway already implements the OpenAI spec. Its
`/v1/chat/completions` accepts a `tools` array of OpenAI
function-schema objects. Hermes will call them as `tool_calls`
in the assistant response. The bridge already implements
`/v1/chat/completions` consumption on its side.

Concretely, instead of MCP, the bridge exposes:

- `GET  /v1/tools`              — list the two tool schemas
- `POST /v1/tools/call`         — execute a tool by name

…and the **bridge**, not hermes, decides what `mcp_servers.carabiner`
would have decided. Hermes still gets to choose whether to call; the
bridge still owns the policy gate; the model still never mutates
directly.

### Pros over MCP

- **One protocol** end-to-end (OpenAI-compatible HTTP). No second
  client/server to keep in sync.
- **Hermes already implements it.** No new MCP client behavior to
  configure, version-pin, or fail-soft.
- **Smaller surface.** Two HTTP routes instead of an entire MCP
  sub-app, JSON-RPC framing, capability negotiation, and SSE
  streaming transport.
- **No `initialize` handshake.** Just standard `Authorization:
  Bearer $API_SERVER_KEY` like the rest of hermes' surface.
- **Already partially built.** `hermes/client.py` already calls
  `/v1/chat/completions` from the bridge; we extend the same shape
  rather than adding a parallel stack.

### Cons

- **Not portable to other MCP clients.** If we ever want a generic
  desktop client (Claude Desktop, Cursor) to call CarabinerOS tools
  directly, MCP is the standard. With OpenAI tools, only OpenAI-
  compatible clients work.
- **The MCP ecosystem is bigger.** MCP has more clients, more
  documentation, more transport choices (stdio, SSE, streamable-http).
- **Hermes' MCP client is built in** (`tools/mcp_tool.py`) — we'd be
  using hermes' less-traveled `tool_schemas` path. Less battle-tested
  in the wild.

## 5. What the original plan said

Per `docs/HERMES_BETA_MIGRATION_PLAN.md` §3 (the production migration
plan, not the superseded Fable/Codex drafts):

> Tools: a **scoped 2-tool MCP surface mounted inside the bridge at
> /mcp** (not the 63-tool legacy server), registered in the hermes
> config by URL

So MCP is the *designed* route. The audit surfaces that the
designed route is broken at the mount; switching to OpenAI tool
calling would be a deviation from the plan.

## 6. Decision matrix

| Criterion | MCP (status quo + fix) | OpenAI tools on bridge |
|---|---|---|
| Lines of code to ship working | ~10 (server.py fix) | ~200 (new `/v1/tools`, `/v1/tools/call`, schemas, tests) |
| Reuses hermes built-ins | MCP client | Tool-calling loop |
| Matches the migration plan | yes | deviation |
| Portable to non-hermes clients | yes | no |
| Failure mode if it breaks | MCP discovery silent | HTTP 4xx, easy to see |
| Future surface (e.g. add a 3rd tool) | trivial (decorate + register) | trivial (add schema + dispatch) |
| Risk of leaking host network state | low (hermes only sees /mcp) | low (same boundary) |

## 7. Recommendation

**Path A (fix MCP, small surgical change).** The plan picked MCP for
a reason: future-proofing for non-hermes clients and matching the
written spec. The bug is a 2-10 line fix in `server.py:75-87`. After
that fix, hermes can list the two tools and call them; the
end-to-end `carabiner_read` round-trip and `ActionLog(proposed)`
audit row become provable.

**Path B is a fallback** if the MCP fix turns out to be hard for
reasons not visible from the audit (e.g. hermes' MCP client
version doesn't like FastMCP's protocol-version negotiation, or the
streamable-http transport has compatibility issues with our pinned
hermes image). In that case, OpenAI tool calling is the safety net,
not the default.

**Do not do both.** Pick one and ship it.

## 8. Awaiting your call

1. **Path A** — fix the MCP mount in `server.py:75-87` (small,
   targeted), then run the end-to-end `carabiner_read` +
   `ActionLog` probe. Bounded.
2. **Path B** — drop MCP, expose `/v1/tools` + `/v1/tools/call` on
   the bridge, register them in hermes' tool config instead of
   `mcp_servers`. Bigger change.
3. **Defer** — keep MCP as-is, ship Row #3 (action-card lifecycle
   parity + real LLM `card_message`) which is orthogonal to the
   MCP-vs-tools choice. Come back to this decision later.

---

## Appendix A — Diagnostic transcript

```
$ curl -s -L -m 5 -o /tmp/mcp_get.html -w "GET /mcp  -> final %{http_code}\n" \
       http://127.0.0.1:8641/mcp
GET /mcp  -> final 404 ct=text/plain; charset=utf-8 url=http://127.0.0.1:8641/mcp/

$ curl -i -m 5 -X POST -H 'Content-Type: application/json' \
       -H 'Accept: application/json, text/event-stream' \
       --data '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' \
       http://127.0.0.1:8641/mcp
HTTP/1.1 307 Temporary Redirect
date: Fri, 10 Jul 2026 11:35:31 GMT
server: uvicorn
content-length: 0
location: http://127.0.0.1:8641/mcp/

$ curl -i -m 5 -X POST ... http://127.0.0.1:8641/mcp/
HTTP/1.1 404 Not Found
Not Found

$ docker logs carabiner-hermes-bridge-1 | grep -E 'mcp' | tail -5
INFO:     172.18.0.4:37304 - "GET /mcp HTTP/1.1" 307 Temporary Redirect
INFO:     172.18.0.4:37308 - "GET /mcp/ HTTP/1.1" 404 Not Found
INFO:     172.18.0.4:37320 - "GET /mcp/tools/list HTTP/1.1" 404 Not Found
INFO:     172.18.0.1:34114 - "GET /mcp HTTP/1.1" 307 Temporary Redirect
INFO:     172.18.0.1:34116 - "POST /mcp HTTP/1.1" 307 Temporary Redirect
```

## Appendix B — Files involved

| File | Role |
|---|---|
| `var/hermes-home/config.yaml` | `mcp_servers.carabiner.url = http://bridge:8641/mcp` |
| `docker-compose.hermes.yml` | bridge :8641, hermes :8642, nginx **8090:80** (this turn) |
| `carabiner/runtime/server.py:75-87` | the mount that 307s |
| `carabiner/runtime/mcp_surface.py:71-79` | FastMCP instance + tool decorators |
| `carabiner/runtime/mcp_surface.py:214-223` | `streamable_http_app()` factory |
| `carabiner/mcp/server.py` | `_MODULE_REGISTRY`, `_serialise`, `_slim` (legacy helpers reused) |
| `carabiner/db/repositories.py` | the actual `list_*/get_*` fns the tools call |
| `carabiner/runtime/policy.py` | host-side gate (allowlist, location_id required on create) |
| `carabiner/runtime/audit.py` | writes `ActionLog(status=proposed)` |
| `carabiner/runtime/cards.py` | builds the action card from the audit row |
| `tests/runtime/test_chat_flow.py` + `test_chat_flow_hermes.py` | hermetic tests that already cover parts of this |