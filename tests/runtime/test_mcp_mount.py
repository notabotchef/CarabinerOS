"""Hermetic-ish probe: confirm the bridge /mcp surface answers MCP
``initialize``, ``notifications/initialized``, and ``tools/list``.

This test does **not** start a docker stack — it expects a bridge
already running on ``http://127.0.0.1:8641``. Marked with the
``integration`` marker so the default ``pytest -q`` run skips it.

Run explicitly with::

    pytest tests/runtime/test_mcp_mount.py -m integration -q

This is the live proof that Row #1's "carabiner_read is callable by
hermes" gap is closed — the MCP mount works end-to-end. ``tools/call``
is exercised by ``tests/runtime/test_chat_flow_hermes.py`` in the
full pipeline (hermes → MCP → bridge → repository).
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

import pytest

URL = "http://127.0.0.1:8641/mcp/"
HDR = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}


def _rpc(method: str, params=None, id_: int = 1):
    body = {"jsonrpc": "2.0", "id": id_, "method": method}
    if params is not None:
        body["params"] = params
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers=HDR, method="POST")
    with urllib.request.urlopen(req, timeout=8) as r:
        return r.status, json.loads(r.read())


@pytest.mark.integration
def test_mcp_initialize_returns_carabiner_bridge() -> None:
    status, init = _rpc(
        "initialize",
        {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "hermetic-probe", "version": "0"},
        },
        id_=1,
    )
    assert status == 200, f"initialize -> {status}"
    si = init["result"]["serverInfo"]
    assert si["name"] == "carabiner_bridge", f"serverInfo.name={si['name']!r}"


@pytest.mark.integration
def test_mcp_tools_list_includes_both_scoped_tools() -> None:
    # initialize first (required before notifications/initialized)
    _rpc(
        "initialize",
        {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "hermetic-probe", "version": "0"},
        },
        id_=1,
    )
    # notifications/initialized (FastMCP returns 202)
    req = urllib.request.Request(
        URL,
        data=json.dumps(
            {"jsonrpc": "2.0", "method": "notifications/initialized"}
        ).encode(),
        headers=HDR,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=4) as r:
            assert r.status in (200, 202, 204)
    except urllib.error.HTTPError as exc:
        assert exc.code in (200, 202, 204), f"notifications/initialized -> {exc.code}"

    status, lst = _rpc("tools/list", id_=2)
    assert status == 200, f"tools/list -> {status}"
    names = [t["name"] for t in lst["result"]["tools"]]
    assert "carabiner_read" in names, (
        f"carabiner_read not in tools/list: {names}"
    )
    assert "carabiner_propose_write" in names, (
        f"carabiner_propose_write not in tools/list: {names}"
    )