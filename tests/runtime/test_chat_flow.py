"""Real Socket.IO chat-flow tests.

Drives the bridge with a real ``socketio.AsyncClient`` against the
in-process ASGI app. These tests exercise the wire protocol end-to-end:

  - connect handshake (csrf_token + handlers)
  - state_request → ack + immediate state_push
  - snapshot shape (every required field from the Fable audit)
  - message_async → progress flag toggles True then back to False

The ASGI client pattern uses ``socketio.AsyncClient`` with an
explicit ``socketio_path`` and the in-process ASGI app. We don't
bind a real socket.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict

import pytest
import socketio  # python-socketio


pytestmark = pytest.mark.asyncio


# Field set the Fable audit §3 frontend-contract requires on a
# snapshot. Tests that build a snapshot must produce all of these.
REQUIRED_SNAPSHOT_FIELDS = {
    "deselect_chat",
    "context",
    "contexts",
    "tasks",
    "logs",
    "log_guid",
    "log_version",
    "log_progress",
    "log_progress_active",
    "paused",
    "notifications",
    "notifications_guid",
    "notifications_version",
}


async def _connect(base_url: str, csrf_token: str):
    """Connect a real AsyncClient to a running bridge (base_url like ``http://127.0.0.1:NNNN``)."""
    sio = socketio.AsyncClient(logger=False, engineio_logger=False)

    connected = asyncio.Event()
    disconnected = asyncio.Event()
    state_push_events: list[dict] = []

    @sio.event(namespace="/ws")
    def connect():
        connected.set()

    @sio.event(namespace="/ws")
    def disconnect():
        disconnected.set()

    @sio.on("state_push", namespace="/ws")
    def _on_state_push(data):
        state_push_events.append(data)

    await sio.connect(
        base_url,
        socketio_path="/socket.io",
        transports=["websocket"],
        namespaces=["/ws"],
        auth={"csrf_token": csrf_token, "handlers": ["ws_webui"]},
    )
    return sio, connected, disconnected, state_push_events


# Backwards-compat alias — old tests passed ``composed_app`` and relied
# on the ASGI transport. We keep the new signature (base_url) but
# accept an ASGI app for the legacy callers that still need it.
async def _connect_at(base_url_or_app, csrf_token: str):
    """Compat shim — accepts a base_url string OR an ASGI app.

    If given an ASGI app (anything truthy that isn't a str), falls
    back to legacy httpx.ASGITransport mode and connects to a local
    ephemeral server started for that app.
    """
    if isinstance(base_url_or_app, str):
        return await _connect(base_url_or_app, csrf_token)
    # Legacy ASGI-app path — start a one-shot server.
    import socket as _socket

    import uvicorn

    from carabiner.runtime.config import load_config
    from carabiner.runtime.server import create_app
    from carabiner.runtime.state import SnapshotStore

    cfg = load_config()
    store = SnapshotStore()
    app = create_app(cfg=cfg, store=store)
    s = _socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error", lifespan="off")
    server = uvicorn.Server(config)
    task = asyncio.create_task(server.serve())
    # Wait
    deadline = asyncio.get_event_loop().time() + 5.0
    while asyncio.get_event_loop().time() < deadline:
        try:
            with _socket.create_connection(("127.0.0.1", port), timeout=0.5):
                break
        except OSError:
            await asyncio.sleep(0.05)
    try:
        return await _connect(f"http://127.0.0.1:{port}", csrf_token)
    finally:
        server.should_exit = True
        await task


async def _fetch_csrf_token_at(base_url: str):
    """Get a fresh CSRF token via real HTTP at the given base_url."""
    import httpx

    async with httpx.AsyncClient(base_url=base_url) as c:
        r = await c.get("/csrf_token")
        return r.json()


async def _http_post_at(base_url: str, path: str, body: dict, token: str):
    import httpx

    async with httpx.AsyncClient(base_url=base_url) as c:
        r = await c.post(path, json=body, headers={"X-CSRF-Token": token})
        return r


# ---- connect handshake ------------------------------------------------------


async def test_connect_with_valid_token_succeeds(running_server):
    tok = (await _fetch_csrf_token_at(running_server))["token"]
    sio, connected, _, _ = await _connect_at(running_server, tok)
    try:
        await asyncio.wait_for(connected.wait(), timeout=2.0)
    finally:
        await sio.disconnect()


async def test_connect_with_wrong_token_is_refused(running_server):
    sio = socketio.AsyncClient(logger=False, engineio_logger=False)
    with pytest.raises((socketio.exceptions.ConnectionError, Exception)):
        await sio.connect(
            running_server,
            socketio_path="/socket.io",
            transports=["websocket"],
            namespaces=["/ws"],
            auth={"csrf_token": "not-a-real-token", "handlers": ["ws_webui"]},
        )
    # The client should not be connected on the /ws namespace.
    # python-socketio raises on the underlying transport failure.
    try:
        await sio.disconnect()
    except Exception:
        pass


# ---- state_request ---------------------------------------------------------


async def test_state_request_returns_ack_and_full_snapshot(running_server):
    tok = (await _fetch_csrf_token_at(running_server))["token"]
    sio, connected, _, push_events = await _connect_at(running_server, tok)
    try:
        await asyncio.wait_for(connected.wait(), timeout=2.0)
        ack = await sio.call(
            "state_request",
            {"log_from": 0, "context": "default"},
            namespace="/ws",
            timeout=2.0,
        )
        assert isinstance(ack, dict)
        assert ack.get("ok") is True
        data = ack.get("data") or {}
        assert "runtime_epoch" in data
        assert "seq" in data
        assert isinstance(data["runtime_epoch"], str)
        assert data["seq"] == 0

        # Give the broadcast a beat to land in our event list.
        for _ in range(20):
            if push_events:
                break
            await asyncio.sleep(0.05)
        assert push_events, "expected at least one state_push"
        envelope = push_events[0]
        # Envelope shape (carabiner.runtime.emitter)
        for k in ("handlerId", "eventId", "ts", "data"):
            assert k in envelope, f"missing envelope key: {k}"
        snapshot = envelope["data"]["snapshot"]
        # Required fields per Fable audit §3
        missing = REQUIRED_SNAPSHOT_FIELDS - set(snapshot.keys())
        assert not missing, f"snapshot missing required fields: {missing}"
        # Type sanity checks
        assert snapshot["deselect_chat"] is False
        assert snapshot["context"] == "default"
        assert isinstance(snapshot["contexts"], list)
        assert isinstance(snapshot["tasks"], list)
        assert isinstance(snapshot["logs"], list)
        assert isinstance(snapshot["notifications"], list)
        assert isinstance(snapshot["log_progress_active"], bool)
    finally:
        await sio.disconnect()


# ---- message_async progress gate (the always-finally invariant) -----------


async def test_message_async_progress_flag_toggles_and_resets(running_server):
    tok = (await _fetch_csrf_token_at(running_server))["token"]
    sio, connected, _, push_events = await _connect_at(running_server, tok)
    try:
        await asyncio.wait_for(connected.wait(), timeout=2.0)

        # 1) Seed a context via chat_create so we have a stable id.
        create = await _http_post_at(
            running_server, "/chat_create", {"current_context": None}, tok
        )
        assert create.status_code == 200
        ctxid = create.json()["ctxid"]

        # 2) Capture the current state of the progress flag (False at rest).
        import httpx

        async with httpx.AsyncClient(base_url=running_server) as c:
            r = await c.get(
                f"/api/_test/state/{ctxid}", headers={"X-CSRF-Token": tok}
            )
            assert r.status_code == 200
            assert r.json()["log_progress_active"] is False

        # 3) Fire message_async (echo run takes ~100ms inside the
        #    try/finally). The progress flag MUST end up False again.
        r = await _http_post_at(
            running_server,
            "/message_async",
            {"text": "ping-flow", "context": ctxid},
            tok,
        )
        assert r.status_code == 200

        # 4) Wait for the echo run to finish, then assert the flag
        #    is back to False (the always-finally gate).
        snap: dict = {}
        for _ in range(40):  # up to ~4s
            async with httpx.AsyncClient(base_url=running_server) as c:
                r = await c.get(
                    f"/api/_test/state/{ctxid}",
                    headers={"X-CSRF-Token": tok},
                )
                snap = r.json()
            if snap["log_progress_active"] is False and any(
                "echo: ping-flow" in (l.get("content") or "") for l in snap["logs"]
            ):
                break
            await asyncio.sleep(0.1)
        else:  # pragma: no cover
            pytest.fail("log_progress_active never returned to False")

        # 5) Snapshot must contain exactly one assistant log with the
        #    full content (in-place growth, same `no`).
        assistant = [l for l in snap["logs"] if l.get("type") == "response"]
        assert len(assistant) == 1
        assert assistant[0]["content"] == "echo: ping-flow"
        # And the user log is present.
        user_logs = [l for l in snap["logs"] if l.get("type") == "user"]
        assert any(l.get("content") == "ping-flow" for l in user_logs)

        # 6) Belt-and-braces: the always-finally gate. After the
        #    request completes the flag MUST be False.
        assert snap["log_progress_active"] is False
    finally:
        await sio.disconnect()
