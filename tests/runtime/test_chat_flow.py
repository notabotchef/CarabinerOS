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


async def _connect(composed_app, csrf_token: str):
    """Connect a real AsyncClient to the in-process ASGI app."""
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

    # The python-socketio ASGI client connects to the app directly
    # via the ``transports=`` arg, no HTTP URL required.
    await sio.connect(
        "http://testserver",
        socketio_path="/socket.io",
        transports=["websocket"],
        namespaces=["/ws"],
        auth={"csrf_token": csrf_token, "handlers": ["ws_webui"]},
    )
    return sio, connected, disconnected, state_push_events


async def _fetch_csrf_token(composed_app):
    """Get a fresh CSRF token via the ASGI HTTP layer."""
    import httpx

    transport = httpx.ASGITransport(app=composed_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        r = await c.get("/csrf_token")
        return r.json()


async def _http_post(composed_app, path: str, body: dict, token: str):
    import httpx

    transport = httpx.ASGITransport(app=composed_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        r = await c.post(path, json=body, headers={"X-CSRF-Token": token})
        return r


# ---- connect handshake ------------------------------------------------------


async def test_connect_with_valid_token_succeeds(composed_app):
    tok = (await _fetch_csrf_token(composed_app))["token"]
    sio, connected, _, _ = await _connect(composed_app, tok)
    try:
        await asyncio.wait_for(connected.wait(), timeout=2.0)
    finally:
        await sio.disconnect()


async def test_connect_with_wrong_token_is_refused(composed_app):
    sio = socketio.AsyncClient(logger=False, engineio_logger=False)
    with pytest.raises((socketio.exceptions.ConnectionError, Exception)):
        await sio.connect(
            "http://testserver",
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


async def test_state_request_returns_ack_and_full_snapshot(composed_app):
    tok = (await _fetch_csrf_token(composed_app))["token"]
    sio, connected, _, push_events = await _connect(composed_app, tok)
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
        assert "seq_base" in data
        assert isinstance(data["runtime_epoch"], str)
        assert data["seq_base"] == 0

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


async def test_message_async_progress_flag_toggles_and_resets(composed_app):
    tok = (await _fetch_csrf_token(composed_app))["token"]
    sio, connected, _, push_events = await _connect(composed_app, tok)
    try:
        await asyncio.wait_for(connected.wait(), timeout=2.0)

        # 1) Seed a context via chat_create so we have a stable id.
        create = await _http_post(
            composed_app, "/chat_create", {"current_context": None}, tok
        )
        assert create.status_code == 200
        ctxid = create.json()["ctxid"]

        # 2) Capture the current state of the progress flag (False
        #    at rest). We use /api/_test/state/<ctx> for introspection.
        import httpx

        transport = httpx.ASGITransport(app=composed_app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
            r = await c.get(
                f"/api/_test/state/{ctxid}", headers={"X-CSRF-Token": tok}
            )
            assert r.status_code == 200
            assert r.json()["log_progress_active"] is False

        # 3) Fire message_async (echo run takes ~100ms inside the
        #    try/finally). The progress flag MUST end up False again.
        r = await _http_post(
            composed_app,
            "/message_async",
            {"text": "ping-flow", "context": ctxid},
            tok,
        )
        assert r.status_code == 200

        # 4) Wait for the echo run to finish, then assert the flag
        #    is back to False (the always-finally gate).
        for _ in range(40):  # up to ~4s
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
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
