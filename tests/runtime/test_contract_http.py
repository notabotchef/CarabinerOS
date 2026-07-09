"""HTTP contract tests for the bridge.

Verifies the exact response shapes the Fable audit §3 frontend
contract calls out. Uses ``httpx.ASGITransport`` to drive the FastAPI
app in-process — no real socket, no port collisions, no flake.
"""

from __future__ import annotations

import asyncio

import pytest


pytestmark = pytest.mark.asyncio


async def test_csrf_token_returns_required_shape(http_client):
    r = await http_client.get("/csrf_token")
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) >= {"ok", "token", "runtime_id"}
    assert body["ok"] is True
    assert isinstance(body["token"], str) and "." in body["token"]
    assert isinstance(body["runtime_id"], str) and len(body["runtime_id"]) >= 6


async def test_csrf_token_sets_cookie(http_client, csrf_token):
    runtime_id = csrf_token["runtime_id"]
    cookie_name = f"csrf_token_{runtime_id}"
    # The ASGITransport test client surfaces cookies on the client.
    assert cookie_name in http_client.cookies
    assert http_client.cookies[cookie_name] == csrf_token["token"]


async def test_message_async_without_csrf_returns_403(http_client):
    # Fresh client — no cookies, no X-CSRF-Token header.
    r = await http_client.post("/message_async", json={"text": "hello"})
    assert r.status_code == 403
    body = r.json()
    assert body.get("ok") is False
    assert "csrf" in (body.get("error") or "").lower()


async def test_message_async_with_csrf_returns_context_and_echo_log(
    http_client, csrf_token
):
    headers = {"X-CSRF-Token": csrf_token["token"]}
    r = await http_client.post(
        "/message_async",
        json={"text": "ping"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "context" in body
    ctx = body["context"]
    assert isinstance(ctx, str) and len(ctx) >= 6

    # The echo run is fire-and-forget; wait for it to land.
    for _ in range(40):  # up to ~4s
        snap_resp = await http_client.get(
            f"/api/_test/state/{ctx}", headers=headers
        )
        assert snap_resp.status_code == 200
        snap = snap_resp.json()
        if any("echo: ping" in (log.get("content") or "") for log in snap.get("logs", [])):
            break
        await asyncio.sleep(0.1)
    else:  # pragma: no cover - surfaces failure loudly
        pytest.fail("Echo log did not appear within timeout")

    # The progress flag must be back to False (always-finally gate).
    assert snap["log_progress_active"] is False
    # And there must be exactly one user log + one assistant log
    # (in-place streaming — same `no` per the invariant).
    logs = snap["logs"]
    assert any(l.get("type") == "user" and l.get("content") == "ping" for l in logs)
    assistant_logs = [l for l in logs if l.get("type") == "response"]
    assert len(assistant_logs) == 1
    assert assistant_logs[0]["content"] == "echo: ping"


async def test_health_returns_runtime_and_reachability(http_client):
    r = await http_client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body.get("ok") is True
    assert body.get("runtime") == "echo"
    # We're in echo mode, so hermes is irrelevant (always false).
    assert body.get("hermes_reachable") is False


async def test_chat_create_returns_8_char_ctxid(http_client, csrf_token):
    headers = {"X-CSRF-Token": csrf_token["token"]}
    r = await http_client.post(
        "/chat_create",
        json={"current_context": None},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    ctxid = body.get("ctxid")
    assert isinstance(ctxid, str)
    assert len(ctxid) == 8
