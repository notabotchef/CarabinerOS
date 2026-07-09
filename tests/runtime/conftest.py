"""Shared fixtures for the bridge runtime tests.

We don't touch the existing ``tests/conftest.py`` (it stubs the
``agent`` module and is shared with the legacy A0 tests). Instead we
build an isolated config + store for every test, and we run the
FastAPI app in-process via ``httpx.ASGITransport`` (no real socket
binding, no flaky port collisions).

For the socket tests we use a real ``socketio.AsyncClient`` against
the in-process ASGI app — python-socketio's ASGI mode supports this
with ``AsyncClient`` and an explicit ``socketio_path``.
"""

from __future__ import annotations

import os
import socket
from typing import AsyncIterator, Iterator

import pytest
import pytest_asyncio

# Force the runtime into "echo" + a deterministic secret so the
# derived ``runtime_id`` and CSRF tokens are reproducible. The
# load_config() call below reads the *current* process env, so we
# set these before any ``carabiner.runtime.*`` module imports.
os.environ.setdefault("CARABINER_RUNTIME", "echo")
os.environ.setdefault("BRIDGE_SECRET_KEY", "test-bridge-secret-do-not-use-in-prod")
os.environ.setdefault("BRIDGE_PORT", "8641")
os.environ.setdefault("AUDIT_REQUIRED", "true")


# ---- singletons: clean between tests ----------------------------------------


@pytest.fixture(autouse=True)
def _clean_singletons():
    """Reset the process-wide config + store before each test."""
    from carabiner.runtime import config as runtime_config
    from carabiner.runtime import state as runtime_state

    runtime_config.reset_config_cache()
    runtime_state.reset_store()
    yield
    runtime_state.reset_store()
    runtime_config.reset_config_cache()


# ---- ephemeral port (kept for the socketio test's ASGI path) ----------------


@pytest.fixture
def ephemeral_port() -> Iterator[int]:
    """Yield a free TCP port and release the socket on teardown.

    Used by the ASGI ``socketio.AsyncClient`` test path; the client
    binds to the port the ASGI app is mounted on.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    yield port


# ---- in-process FastAPI app -------------------------------------------------


@pytest_asyncio.fixture
async def app():
    """Return a freshly built FastAPI app (with a clean store + config)."""
    from carabiner.runtime import http_api
    from carabiner.runtime.config import load_config
    from carabiner.runtime.state import SnapshotStore

    cfg = load_config()
    store = SnapshotStore()
    return http_api.create_app(cfg=cfg, store=store)


@pytest_asyncio.fixture
async def http_client(app):
    """An ``httpx.AsyncClient`` bound to the in-process ASGI app."""
    import httpx

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        yield client


@pytest_asyncio.fixture
async def csrf_token(http_client) -> dict:
    """Fetch ``/csrf_token`` once and return the body."""
    r = await http_client.get("/csrf_token")
    assert r.status_code == 200, r.text
    return r.json()


# ---- composed ASGI app (FastAPI + socketio ASGIApp) -------------------------


@pytest_asyncio.fixture
async def composed_app():
    """Return the full composed app (FastAPI + socketio mounted)."""
    from carabiner.runtime.config import load_config
    from carabiner.runtime.server import create_app
    from carabiner.runtime.state import SnapshotStore

    cfg = load_config()
    store = SnapshotStore()
    return create_app(cfg=cfg, store=store)
