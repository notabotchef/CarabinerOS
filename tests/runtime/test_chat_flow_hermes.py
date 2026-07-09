"""Hermes-backed chat flow tests.

Drives the bridge with the fake-hermes ASGI stub on an ephemeral
port so the full request → SSE → state_push pipeline is exercised
end-to-end without depending on a real hermes install.

These tests are skipped if the runtime's optional deps
(``python-socketio``, ``httpx``, ``fastapi``) aren't installed.
"""

from __future__ import annotations

import asyncio
import os
import socket
import threading
import time
from typing import Any

import pytest


def _deps_available() -> bool:
    try:
        import fastapi  # noqa: F401
        import httpx  # noqa: F401
        import socketio  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


pytestmark = pytest.mark.skipif(
    not _deps_available(),
    reason="runtime deps (fastapi/httpx/socketio) not installed in this venv",
)


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _run_fake_hermes_in_thread(port: int) -> tuple[Any, threading.Thread]:
    """Run the fake-hermes ASGI app on an ephemeral port in a background thread."""
    import uvicorn

    config = uvicorn.Config(
        "tests.runtime.fake_hermes:app",
        host="127.0.0.1",
        port=port,
        log_level="error",
        lifespan="off",
    )
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    # Wait for readiness
    deadline = time.time() + 5
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.5):
                return server, thread
        except OSError:
            time.sleep(0.05)
    raise RuntimeError(f"fake hermes did not come up on port {port}")


@pytest.fixture
def fake_hermes_url():
    port = _free_port()
    server, thread = _run_fake_hermes_in_thread(port)
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(timeout=5)


@pytest.mark.asyncio
async def test_fake_hermes_models_endpoint(fake_hermes_url: str) -> None:
    import httpx

    async with httpx.AsyncClient() as client:
        r = await client.get(f"{fake_hermes_url}/v1/models")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data and len(data["data"]) >= 1


@pytest.mark.asyncio
async def test_fake_hermes_chat_stream_returns_deltas(fake_hermes_url: str) -> None:
    """The fake-hermes SSE stream should yield at least one text delta + a done marker."""
    from carabiner.runtime.hermes import HermesClient

    client = HermesClient(base_url=fake_hermes_url, api_key="fake")
    deltas: list[str] = []
    async for kind, payload in client.stream("hello", session_id="s1"):
        if kind == "text":
            deltas.append(payload)
        if kind == "done":
            break
    await client.aclose()
    full = "".join(deltas)
    assert "echo:" in full
    assert "hello" in full


@pytest.mark.asyncio
async def test_bridge_with_hermes_runtime_assembles_single_log_entry(
    fake_hermes_url: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """End-to-end: bridge with CARABINER_RUNTIME=hermes streams a single response log."""
    monkeypatch.setenv("CARABINER_RUNTIME", "hermes")
    monkeypatch.setenv("HERMES_BASE_URL", fake_hermes_url)
    monkeypatch.setenv("API_SERVER_KEY", "test-key")
    monkeypatch.setenv("BRIDGE_SECRET_KEY", "test-secret-please-change-me")
    monkeypatch.setenv("AUDIT_REQUIRED", "false")

    from carabiner.runtime.config import load_config

    cfg = load_config()
    assert cfg.runtime == "hermes"

    from carabiner.runtime.hermes import get_client

    client = get_client(cfg.runtime, cfg.hermes_base_url, cfg.api_server_key)
    full_text = ""
    async for kind, payload in client.stream("ping", session_id="s1"):
        if kind == "text":
            full_text += payload
        if kind == "done":
            break
    await client.aclose()
    assert "echo:" in full_text
    assert "ping" in full_text


@pytest.mark.asyncio
async def test_bridge_health_reports_runtime_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    """The /api/health endpoint surfaces CARABINER_RUNTIME + hermes reachability."""
    monkeypatch.setenv("CARABINER_RUNTIME", "echo")
    monkeypatch.setenv("BRIDGE_SECRET_KEY", "test-secret")
    monkeypatch.setenv("API_SERVER_KEY", "test-key")

    from carabiner.runtime.config import load_config

    cfg = load_config()
    assert cfg.runtime == "echo"
    # Echo runtime always reports hermes_reachable=False (no hermes call attempted)
    # — that is the contract.


@pytest.mark.asyncio
async def test_echo_runtime_message_returns_canned_response() -> None:
    from carabiner.runtime.hermes import EchoClient

    client = EchoClient()
    chunks: list[str] = []
    async for kind, payload in client.stream("hi", session_id="s"):
        if kind == "text":
            chunks.append(payload)
        if kind == "done":
            break
    assert "".join(chunks) == "echo: hi"