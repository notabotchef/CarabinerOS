"""ASGI composition for the bridge.

Wires together:

- :mod:`carabiner.runtime.http_api` (FastAPI on ``/api`` + legacy
  top-level paths for the unchanged frontend)
- :mod:`carabiner.runtime.sockets` (python-socketio AsyncServer on
  the ``/ws`` namespace, mounted at ``/socket.io``)
- An MCP surface mount at ``/mcp`` (the real FastMCP ships in P6.4;
  we mount a tiny placeholder so the ASGI tree is complete)

Entry point:

    python -m carabiner.runtime.server

Defaults to ``CARABINER_RUNTIME=echo`` and ``BRIDGE_PORT=8641`` when
those env vars are unset, so a fresh ``python -m carabiner.runtime.server``
just works in echo mode (handy for dev + the smoke script).
"""

from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import Any, Optional

import uvicorn  # type: ignore

from carabiner.runtime import config as runtime_config
from carabiner.runtime import http_api
from carabiner.runtime import sockets
from carabiner.runtime import state as runtime_state


logger = logging.getLogger(__name__)


# Lazy imports for socketio so the http_api module can be imported
# without python-socketio being installed (test environments).
def _build_socketio_app(cfg: runtime_config.RuntimeConfig, store: runtime_state.SnapshotStore):
    import socketio  # type: ignore

    sio_server = sockets.build_server(cfg=cfg, store=store, async_mode="asgi")
    # The /ws namespace is registered by build_server; we mount the
    # ASGI app at /socket.io (the path the frontend socket-client.ts
    # connects to).
    return socketio.ASGIApp(sio_server, socketio_path="/socket.io")


def create_app(
    cfg: Optional[runtime_config.RuntimeConfig] = None,
    store: Optional[runtime_state.SnapshotStore] = None,
) -> Any:
    """Return the composed ASGI app (FastAPI + socketio ASGIApp + mcp mount)."""

    if cfg is None:
        cfg = runtime_config.get_config()
    if store is None:
        store = runtime_state.get_store()
    assert cfg is not None and store is not None  # nosec

    # Build the FastAPI app (HTTP routes).
    fastapi_app = http_api.create_app(cfg=cfg, store=store)

    # Drive the FastMCP session-manager lifespan from FastAPI's lifespan.
    # Without this, FastMCP's StreamableHTTPSessionManager raises
    # "Task group is not initialized" because uvicorn only runs the
    # outer (FastAPI) lifespan — the mounted sub-app's lifespan is
    # never entered.
    @asynccontextmanager
    async def _mcp_lifespan(app: Any):
        from carabiner.runtime.mcp_surface import get_mcp

        mcp = get_mcp()
        async with mcp.session_manager.run():
            yield

    # Replace any existing lifespan with the composed one.
    existing = fastapi_app.router.lifespan_context

    @asynccontextmanager
    async def _composed_lifespan(app: Any):
        # Start the brief scheduler alongside FastMCP so it shares the
        # bridge's event loop and the live socketio server.
        from carabiner.runtime.brief_config import BriefConfig
        from carabiner.runtime.brief_scheduler import get_scheduler

        scheduler = get_scheduler(BriefConfig.from_env())
        async with _mcp_lifespan(app):
            try:
                await scheduler.start()
            except Exception as exc:  # noqa: BLE001
                logger.warning("brief_scheduler: failed to start: %s", exc)
            try:
                async with existing(app):
                    yield
            finally:
                try:
                    await scheduler.stop()
                except Exception as exc:  # noqa: BLE001
                    logger.warning("brief_scheduler: failed to stop: %s", exc)

    fastapi_app.router.lifespan_context = _composed_lifespan

    # Mount the socket.io ASGI app at /socket.io.
    sio_asgi = _build_socketio_app(cfg, store)
    fastapi_app.mount("/socket.io", sio_asgi)

    # Mount the read-only module router at /api.
    from carabiner.runtime.read_api import router as read_router

    fastapi_app.include_router(read_router)

    # Mount the scoped 2-tool MCP surface at /mcp. Tries
    # ``streamable_http_app()`` first; falls back to ``sse_app()``
    # if the installed mcp package predates streamable-http.
    #
    # Mount at the trailing-slash path (``/mcp/``) so Starlette does
    # not redirect bare ``/mcp`` → ``/mcp/`` and lose the inner route
    # match. FastMCP's streamable_http_app returns a Starlette app with
    # its inner routes at ``/mcp`` (no slash). The trailing-slash mount
    # makes the redirect a no-op and lets the inner router see every
    # request.
    try:
        from carabiner.runtime.mcp_surface import streamable_http_app

        fastapi_app.mount("/mcp/", streamable_http_app())
    except Exception as exc:  # noqa: BLE001
        logger.warning("streamable_http_app mount failed (%s); falling back to sse_app", exc)
        try:
            from carabiner.runtime.mcp_surface import sse_app

            fastapi_app.mount("/mcp/", sse_app())
        except Exception as exc2:  # noqa: BLE001
            logger.error("mcp surface could not be mounted (%s); /mcp returns 503", exc2)

            @fastapi_app.get("/mcp")
            async def _mcp_unavailable() -> dict:
                return {"ok": False, "error": "mcp surface unavailable", "reason": str(exc2)}

            @fastapi_app.post("/mcp")
            async def _mcp_unavailable_post() -> dict:
                return {"ok": False, "error": "mcp surface unavailable", "reason": str(exc2)}

    return fastapi_app


# ---- entry point ------------------------------------------------------------


def main() -> int:
    """``python -m carabiner.runtime.server`` entrypoint."""
    logging.basicConfig(
        level=os.environ.get("CARABINER_LOG_LEVEL", "INFO"),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    cfg = runtime_config.get_config()
    store = runtime_state.get_store()
    app = create_app(cfg=cfg, store=store)
    host = os.environ.get("CARABINER_HOST", "0.0.0.0")
    logger.info("Starting Carabiner bridge (runtime=%s) on %s:%d", cfg.runtime, host, cfg.bridge_port)
    uvicorn.run(app, host=host, port=cfg.bridge_port, log_level="info")
    return 0


if __name__ == "__main__":
    sys.exit(main())
