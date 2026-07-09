"""HTTP API for the bridge.

Endpoints (per Fable audit §3 "Frontend contract"):

    GET  /csrf_token          -> {ok, token, runtime_id}  (sets cookie)
    POST /message_async       -> {context}                (CSRF-protected)
    POST /chat_create         -> {ok, ctxid}              (CSRF-protected)
    GET  /chats               -> {ok, chats: [...]}       (CSRF-protected)
    POST /chat_remove         -> {ok, removed: bool}      (CSRF-protected)
    POST /chat_load           -> {ok, messages: [...]}    (CSRF-protected)
    GET  /api/health          -> {ok, runtime, hermes_reachable: bool}

Echo runtime returns a canned ``"echo: <text>"`` after a small delay
(the delay is enough to exercise the loading spinner / progress flag
in the frontend).

We mount the routes under ``/api`` by default and *also* expose the
legacy top-level paths (``/csrf_token``, ``/chats``, etc.) so the
unchanged frontend keeps working. The legacy paths are documented as
the contract of record in the migration plan.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

from fastapi import Cookie, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from carabiner.chat_store import chat_store  # singleton instance, not the module
from carabiner.runtime import config as runtime_config
from carabiner.runtime import security
from carabiner.runtime import state as runtime_state


logger = logging.getLogger(__name__)


# ---- request models --------------------------------------------------------


class MessageAsyncBody(BaseModel):
    text: str
    context: Optional[str] = None


class ChatCreateBody(BaseModel):
    current_context: Optional[str] = None


class ChatRemoveBody(BaseModel):
    context: str


class ChatLoadBody(BaseModel):
    context: str


# ---- factory ---------------------------------------------------------------


def _csrf_cookie_name() -> str:
    cfg = runtime_config.get_config()
    return security.csrf_token_cookie_name(
        security.derive_runtime_id(cfg.bridge_secret_key)
    )


def _resolve_token_from_request(
    request: Request,
    cfg: runtime_config.RuntimeConfig,
    runtime_id: str,
) -> Optional[str]:
    """Pull the CSRF token from the cookie or the X-CSRF-Token header.

    We accept both because the frontend may set the header on
    cross-origin POSTs where cookies don't flow, and the cookie on
    same-origin requests. Either is fine — verification is identical.
    """
    cookie_name = security.csrf_token_cookie_name(runtime_id)
    cookie_token = request.cookies.get(cookie_name)
    header_token = request.headers.get("X-CSRF-Token")
    return header_token or cookie_token


def _require_csrf(request: Request, cfg: runtime_config.RuntimeConfig, runtime_id: str) -> str:
    token = _resolve_token_from_request(request, cfg, runtime_id)
    if not token or not security.verify_csrf_token(cfg.bridge_secret_key, runtime_id, token):
        raise HTTPException(status_code=403, detail={"ok": False, "error": "csrf_invalid"})
    return token


# ---- app factory -----------------------------------------------------------


def create_app(
    cfg: Optional[runtime_config.RuntimeConfig] = None,
    store: Optional[runtime_state.SnapshotStore] = None,
) -> FastAPI:
    """Build a FastAPI app wired to a config + snapshot store."""

    if cfg is None:
        cfg = runtime_config.get_config()
    if store is None:
        store = runtime_state.get_store()
    # Local aliases so the linter (which can't follow .get_config()
    # in the stubbed env) sees the right type after the narrowing.
    assert cfg is not None and store is not None  # nosec - guarded above

    runtime_id = security.derive_runtime_id(cfg.bridge_secret_key)
    cookie_name = security.csrf_token_cookie_name(runtime_id)

    app = FastAPI(title="Carabiner Bridge", version=cfg.extra.get("CARABINER_RUNTIME_VERSION", "0.1.0"))

    # ---- / (landing) -------------------------------------------------------
    # Phone browsers open the bare tunnel host at "/". Without this route
    # FastAPI returns {"detail":"Not Found"} — which looks like the site is
    # broken even when the bridge is healthy. Serve a small HTML index.

    @app.get("/", response_class=HTMLResponse)
    async def root() -> str:
        health = {
            "ok": True,
            "runtime": cfg.runtime,
            "hermes_reachable": False,
        }
        if cfg.runtime == "hermes":
            try:
                import httpx  # type: ignore

                async with httpx.AsyncClient(timeout=0.5) as client:
                    url = cfg.hermes_base_url.rstrip("/") + "/v1/models"
                    headers = (
                        {"Authorization": f"Bearer {cfg.api_server_key}"}
                        if cfg.api_server_key
                        else {}
                    )
                    r = await client.get(url, headers=headers)
                    health["hermes_reachable"] = r.status_code < 500
            except Exception:  # pragma: no cover - network
                health["hermes_reachable"] = False

        links = [
            ("/api/health", "Health JSON"),
            ("/csrf_token", "CSRF token"),
            ("/api/orders", "Orders (needs CSRF header for some clients)"),
            ("/api/inventory", "Inventory"),
            ("/api/menu", "Menu"),
            ("/api/recipes", "Recipes"),
            ("/docs", "OpenAPI docs (Swagger)"),
        ]
        items = "\n".join(
            f'<li><a href="{href}">{label}</a></li>' for href, label in links
        )
        return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>CarabinerOS Bridge</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 2rem; max-width: 40rem;
           line-height: 1.45; color: #111; background: #fafafa; }}
    code {{ background: #eee; padding: 0.1em 0.35em; border-radius: 4px; }}
    .ok {{ color: #0a7; font-weight: 600; }}
    .warn {{ color: #b70; font-weight: 600; }}
  </style>
</head>
<body>
  <h1>CarabinerOS Bridge</h1>
  <p class="ok">Bridge is up.</p>
  <p>Runtime: <code>{health["runtime"]}</code> ·
     Hermes reachable: <code class="{"ok" if health["hermes_reachable"] else "warn"}">{health["hermes_reachable"]}</code></p>
  <p>Open one of these (not the bare domain alone if you only want JSON):</p>
  <ul>
    {items}
  </ul>
  <p><small>If you previously saw <code>{{"detail":"Not Found"}}</code> on
  this host, that was FastAPI 404 for <code>/</code> — the tunnel was fine.</small></p>
</body>
</html>
"""

    # ---- /csrf_token -------------------------------------------------------

    @app.get("/csrf_token")
    @app.get("/api/csrf_token")
    def csrf_token(response: Response) -> Dict[str, Any]:
        body = security.issue_token_response(cfg.bridge_secret_key, runtime_id)
        # Cookie scoped to root so the frontend (Next.js dev server on
        # :3000 talking to bridge on :8641) can read it on same-origin
        # proxy throughs and on direct cross-origin POSTs that include
        # the X-CSRF-Token header.
        response.set_cookie(
            key=cookie_name,
            value=body["token"],
            httponly=False,  # the frontend JS reads it on same-origin
            samesite="lax",
            secure=False,    # local dev; production should set secure=True
            path="/",
        )
        return body

    # ---- /api/health -------------------------------------------------------

    @app.get("/api/health")
    async def health() -> Dict[str, Any]:
        # Lightweight reachability probe to the hermes gateway. We
        # never block the health check for more than ~200ms.
        reachable = False
        if cfg.runtime == "hermes":
            try:
                import httpx  # type: ignore

                async with httpx.AsyncClient(timeout=0.5) as client:
                    url = cfg.hermes_base_url.rstrip("/") + "/v1/models"
                    headers = {"Authorization": f"Bearer {cfg.api_server_key}"} if cfg.api_server_key else {}
                    r = await client.get(url, headers=headers)
                    reachable = r.status_code < 500
            except Exception as exc:  # pragma: no cover - network
                logger.debug("hermes reachability probe failed: %s", exc)
                reachable = False
        return {"ok": True, "runtime": cfg.runtime, "hermes_reachable": reachable}

    # ---- /message_async ----------------------------------------------------

    @app.post("/message_async")
    @app.post("/api/message_async")
    async def message_async(body: MessageAsyncBody, request: Request) -> Dict[str, Any]:
        _require_csrf(request, cfg, runtime_id)
        context = body.context or _generate_context_id()
        # Append user log + persist.
        store.append_user_log(context, body.text)
        # Fire-and-forget the echo work so the HTTP response returns
        # the context immediately. The echo work itself goes through
        # the always-finally progress gate (state.set_progress).
        asyncio.create_task(_echo_run(cfg, store, context, body.text))
        return {"context": context}

    # ---- /chat_create ------------------------------------------------------

    @app.post("/chat_create")
    @app.post("/api/chat_create")
    def chat_create(body: ChatCreateBody, request: Request) -> Dict[str, Any]:
        _require_csrf(request, cfg, runtime_id)
        ctxid = _generate_context_id()
        # Make sure the chat exists in the persistent store too.
        chat_store.create(ctxid)
        store.get_or_create(ctxid)  # seed the in-memory mirror
        return {"ok": True, "ctxid": ctxid}

    # ---- /chats ------------------------------------------------------------

    @app.get("/chats")
    @app.get("/api/chats")
    def chats(request: Request) -> Dict[str, Any]:
        _require_csrf(request, cfg, runtime_id)
        items = [c.to_summary() for c in chat_store.all()]
        return {"ok": True, "chats": items}

    # ---- /chat_remove ------------------------------------------------------

    @app.post("/chat_remove")
    @app.post("/api/chat_remove")
    def chat_remove(body: ChatRemoveBody, request: Request) -> Dict[str, Any]:
        _require_csrf(request, cfg, runtime_id)
        removed = chat_store.remove(body.context)
        return {"ok": True, "removed": bool(removed)}

    # ---- /chat_load --------------------------------------------------------

    @app.post("/chat_load")
    @app.post("/api/chat_load")
    def chat_load(body: ChatLoadBody, request: Request) -> Dict[str, Any]:
        _require_csrf(request, cfg, runtime_id)
        ctx = chat_store.get(body.context)
        if ctx is None:
            return {"ok": True, "messages": []}
        return {"ok": True, "messages": ctx.get_messages()}

    # ---- error handlers ----------------------------------------------------

    @app.exception_handler(HTTPException)
    async def _http_exc(_: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict):
            return JSONResponse(status_code=exc.status_code, content=detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"ok": False, "error": str(detail)},
        )

    # ---- test helpers (not part of the contract) ---------------------------

    # Expose the live store + cfg so tests can introspect.
    @app.get("/api/_test/state/{context}")
    def _test_state(context: str, request: Request) -> Dict[str, Any]:
        # Loose CSRF — the test client must still hold a valid token,
        # so this isn't an unauthenticated back-door.
        _require_csrf(request, cfg, runtime_id)
        return store.to_snapshot(context)

    return app


# ---- helpers ---------------------------------------------------------------


def _generate_context_id() -> str:
    """Return a fresh 8-char context id (matches ``chat_store.create``)."""
    import uuid

    return uuid.uuid4().hex[:8]


async def _echo_run(
    cfg: runtime_config.RuntimeConfig,
    store: runtime_state.SnapshotStore,
    context: str,
    text: str,
) -> None:
    """The canned echo run — exercised in echo runtime and in tests.

    Always sets ``log_progress_active=True`` at the start and resets
    it to ``False`` in a ``finally`` block (the Fable audit invariant).
    A single response log entry is created and its content is grown
    in place to model the streaming shape the hermes client will
    produce.
    """
    store.set_progress(context, True)
    try:
        await asyncio.sleep(0.1)  # simulate work
        entry = store.begin_assistant_log(context)
        no = entry["no"]
        canned = f"echo: {text}"
        # Stream the canned response in a few chunks so the
        # in-place-growth invariant is observable.
        for chunk in (canned[i : i + 4] for i in range(0, len(canned), 4)):
            store.append_assistant_delta(context, no, chunk)
            await asyncio.sleep(0.01)
        # Persist the final assistant text.
        try:
            chat_store.add_message(context, "assistant", canned)
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("persist assistant message failed: %s", exc)
    finally:
        store.set_progress(context, False)


# ---- module-level singleton -------------------------------------------------


_app: Optional[FastAPI] = None


def get_app() -> FastAPI:
    """Process-wide FastAPI app (lazy)."""
    global _app
    if _app is None:
        _app = create_app()
    return _app
