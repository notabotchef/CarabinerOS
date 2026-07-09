"""Read-flow tests — exercise the MCP surface (carabiner_read) with mocked repos."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from carabiner.runtime import mcp_surface


def test_record_tool_invocation_appends() -> None:
    mcp_surface.active_run_registry.clear()
    mcp_surface.record_tool_invocation("run-1", "carabiner_read", {"resource": "orders"}, "ok")
    mcp_surface.record_tool_invocation("run-1", "carabiner_read", {"resource": "inventory"}, "ok")
    invocations = mcp_surface.drain_run_registry("run-1")
    assert len(invocations) == 2
    assert invocations[0]["tool"] == "carabiner_read"


def test_drain_run_registry_removes_entry() -> None:
    mcp_surface.active_run_registry.clear()
    mcp_surface.record_tool_invocation("run-x", "carabiner_read", {}, "ok")
    drained = mcp_surface.drain_run_registry("run-x")
    assert len(drained) == 1
    assert mcp_surface.drain_run_registry("run-x") == []  # empty after drain


def test_record_tool_invocation_is_thread_safe() -> None:
    """Sanity check — concurrent appends don't corrupt the list."""
    import threading

    mcp_surface.active_run_registry.clear()

    def worker(i: int) -> None:
        for _ in range(10):
            mcp_surface.record_tool_invocation("run-mt", "carabiner_read", {"i": i}, "ok")

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    drained = mcp_surface.drain_run_registry("run-mt")
    assert len(drained) == 50


def test_carabiner_read_returns_slimmed_json() -> None:
    """The read tool delegates to carabiner.mcp.server and returns slimmed rows."""

    fake_row = MagicMock()
    fake_row.id = "abc-123"
    fake_row.vendor = "US Foods"
    fake_row.total = 100.0

    async def fake_list(**kwargs):
        return [fake_row]

    fake_mcp_server = MagicMock()
    fake_mcp_server._ensure_db = AsyncMock()
    fake_mcp_server._MODULE_REGISTRY = {"orders": {"list": "list_orders", "get": "get_orders"}}
    fake_mcp_server._slim = MagicMock(side_effect=lambda rows: rows)
    fake_mcp_server._serialise = MagicMock(side_effect=lambda x: {"id": x.id, "vendor": x.vendor, "total": x.total})

    fake_repos = MagicMock()
    fake_repos.list_orders = fake_list
    fake_repos.get_orders = AsyncMock(return_value=fake_row)

    with patch.dict(
        "sys.modules",
        {
            "carabiner.mcp.server": fake_mcp_server,
            "carabiner.db.repositories": fake_repos,
        },
    ):
        mcp = mcp_surface.get_mcp()
        tool = mcp._tool_manager._tools["carabiner_read"]
        result = _run(tool.fn(resource="orders", filters=None, run_id="r1"))
    parsed = json.loads(result)
    assert parsed["count"] == 1
    assert parsed["data"][0]["id"] == "abc-123"
    # Invocation recorded
    invocations = mcp_surface.drain_run_registry("r1")
    assert any(i["tool"] == "carabiner_read" and i["result_kind"] == "ok" for i in invocations)


def test_carabiner_propose_write_allowed_returns_awaiting_approval() -> None:
    fake_card = {"id": "card-1", "status": "proposed", "module": "orders", "action": "create"}
    with patch("carabiner.runtime.cards.propose", return_value=fake_card) as mock_propose:
        mcp = mcp_surface.get_mcp()
        tool = mcp._tool_manager._tools["carabiner_propose_write"]
        result = _run(
            tool.fn(
                resource="orders",
                verb="create",
                data=json.dumps({"location_id": "loc-1", "vendor": "US Foods"}),
                reason="r",
                run_id="r2",
            )
        )
    parsed = json.loads(result)
    assert parsed["status"] == "awaiting_approval"
    assert parsed["card"]["id"] == "card-1"
    mock_propose.assert_called_once()


def test_carabiner_propose_write_denied_returns_denial_reason() -> None:
    mcp = mcp_surface.get_mcp()
    tool = mcp._tool_manager._tools["carabiner_propose_write"]
    result = _run(
        tool.fn(
            resource="foo",  # unknown resource
            verb="create",
            data=json.dumps({"location_id": "x"}),
            reason="r",
            run_id="r3",
        )
    )
    parsed = json.loads(result)
    assert parsed["status"] == "denied"
    assert parsed["reason"] == "unknown_resource"


def test_carabiner_propose_write_missing_location_id_denied() -> None:
    mcp = mcp_surface.get_mcp()
    tool = mcp._tool_manager._tools["carabiner_propose_write"]
    result = _run(
        tool.fn(
            resource="orders",
            verb="create",
            data=json.dumps({"vendor": "US Foods"}),  # no location_id
            reason="r",
        )
    )
    parsed = json.loads(result)
    assert parsed["status"] == "denied"
    assert parsed["reason"] == "missing_location_id"


def _run(coro):
    import asyncio

    return asyncio.run(coro)