"""Tests for the action_card tool."""

import sys
import uuid
from pathlib import Path
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

ENGINE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ENGINE_DIR))

from tools.action_card import ActionCard, _validate_changes, _validate_stats


# ---------------------------------------------------------------------------
# Fixture: inject fake helpers.ws_manager with AsyncMock send_data
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_send_data():
    fake_module = ModuleType("helpers.ws_manager")
    send_data_mock = AsyncMock()
    fake_module.send_data = send_data_mock  # type: ignore[attr-defined]

    original_ws = sys.modules.get("helpers.ws_manager")
    original_helpers = sys.modules.get("helpers")

    if "helpers" not in sys.modules:
        sys.modules["helpers"] = ModuleType("helpers")
    sys.modules["helpers.ws_manager"] = fake_module

    try:
        yield send_data_mock
    finally:
        if original_ws is not None:
            sys.modules["helpers.ws_manager"] = original_ws
        else:
            sys.modules.pop("helpers.ws_manager", None)
        if original_helpers is None:
            sys.modules.pop("helpers", None)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_tool(args: dict) -> ActionCard:
    """Create an ActionCard tool instance with mocked agent."""
    agent = MagicMock()
    agent.config.additional = {}
    tool = ActionCard(
        agent=agent,
        name="action_card",
        method=None,
        args=args,
        message="",
        loop_data=None,
    )
    return tool


def _valid_args(**overrides) -> dict:
    """Return a minimal valid args dict, with optional overrides."""
    base = {
        "type": "action",
        "module": "orders",
        "action": "create",
        "summary": "PO #100 created for Test Vendor",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Validation: _validate_changes
# ---------------------------------------------------------------------------

def test_validate_changes_valid():
    changes = [
        {"op": "+", "text": "Added item"},
        {"op": "!", "text": "Warning"},
        {"op": "\u2192", "text": "Moved"},
    ]
    result = _validate_changes(changes)
    assert len(result) == 3
    assert result[0] == {"op": "+", "text": "Added item"}
    assert result[2] == {"op": "\u2192", "text": "Moved"}


def test_validate_changes_filters_invalid():
    changes = [
        {"op": "x", "text": "bad op"},
        {"op": "+", "text": ""},          # empty text
        {"op": "+"},                       # missing text
        "not a dict",
        {"op": "+", "text": "good"},
    ]
    result = _validate_changes(changes)
    assert len(result) == 1
    assert result[0]["text"] == "good"


def test_validate_changes_empty():
    assert _validate_changes([]) == []


# ---------------------------------------------------------------------------
# Validation: _validate_stats
# ---------------------------------------------------------------------------

def test_validate_stats_valid():
    stats = [
        {"label": "Total", "value": "$500"},
        {"label": "Items", "value": "12"},
    ]
    result = _validate_stats(stats)
    assert len(result) == 2
    assert result[0] == {"label": "Total", "value": "$500"}


def test_validate_stats_filters_invalid():
    stats = [
        {"label": "", "value": "x"},      # empty label
        {"label": "A", "value": ""},       # empty value
        "not a dict",
        {"label": "Good", "value": "1"},
    ]
    result = _validate_stats(stats)
    assert len(result) == 1
    assert result[0]["label"] == "Good"


# ---------------------------------------------------------------------------
# Required field validation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_missing_summary_returns_error():
    tool = _make_tool({"type": "action", "module": "orders", "action": "create"})
    resp = await tool.execute()
    assert "summary" in resp.message.lower()
    assert resp.break_loop is False


@pytest.mark.asyncio
async def test_missing_module_returns_error():
    tool = _make_tool({"type": "action", "action": "create", "summary": "test"})
    resp = await tool.execute()
    assert "module" in resp.message.lower()
    assert resp.break_loop is False


@pytest.mark.asyncio
async def test_invalid_type_returns_error():
    tool = _make_tool(_valid_args(type="banana"))
    resp = await tool.execute()
    assert "type" in resp.message.lower()
    assert "banana" in resp.message


@pytest.mark.asyncio
async def test_invalid_action_returns_error():
    tool = _make_tool(_valid_args(action="explode"))
    resp = await tool.execute()
    assert "action" in resp.message.lower()
    assert "explode" in resp.message


# ---------------------------------------------------------------------------
# Successful emit — via send_data (namespace /ws, default)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_emit_success(mock_send_data):
    tool = _make_tool(_valid_args(
        detail="Test detail",
        priority=1,
        source="proactive",
        changes=[{"op": "+", "text": "new item"}],
        stats=[{"label": "Total", "value": "$100"}],
    ))
    resp = await tool.execute()

    assert "emitted successfully" in resp.message.lower()
    assert resp.break_loop is False

    mock_send_data.assert_called_once()
    call_args = mock_send_data.call_args
    assert call_args[0][0] == "action_card"
    # send_data defaults to endpoint_name="/ws" — no explicit namespace kwarg
    assert "namespace" not in call_args[1]

    card = call_args[0][1]["card"]
    assert card["type"] == "action"
    assert card["module"] == "orders"
    assert card["action"] == "create"
    assert card["summary"] == "PO #100 created for Test Vendor"
    assert card["detail"] == "Test detail"
    assert card["priority"] == 1
    assert card["source"] == "proactive"
    assert card["status"] == "new"
    assert card["changes"] == [{"op": "+", "text": "new item"}]
    assert card["stats"] == [{"label": "Total", "value": "$100"}]
    assert isinstance(card["timestamp"], int)
    assert "id" in card
    assert "chatId" in card


@pytest.mark.asyncio
async def test_emit_defaults(mock_send_data):
    """Verify defaults for optional fields."""
    tool = _make_tool({"module": "prep", "summary": "Test"})
    resp = await tool.execute()

    assert "emitted successfully" in resp.message.lower()
    card = mock_send_data.call_args[0][1]["card"]
    assert card["type"] == "info"          # default type
    assert card["action"] == "update"      # default action
    assert card["priority"] == 0           # default priority
    assert card["source"] == "reactive"    # default source
    assert card["status"] == "new"
    assert card["detail"] == ""
    assert card["changes"] == []
    assert card["stats"] == []
    assert card["itemId"] is None
    assert card["deadline"] is None
    assert "chatId" in card


# ---------------------------------------------------------------------------
# Card shape matches frontend ActionCard interface
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_card_has_all_interface_fields(mock_send_data):
    """Every field from the frontend ActionCard interface must be present."""
    tool = _make_tool(_valid_args(
        itemId="order-123",
        deadline="2026-03-21T17:00:00Z",
    ))
    await tool.execute()
    card = mock_send_data.call_args[0][1]["card"]

    expected_keys = {
        "id", "type", "module", "action", "summary", "detail",
        "itemId", "chatId", "changes", "stats", "priority", "deadline",
        "status", "timestamp", "source",
    }
    assert set(card.keys()) == expected_keys


# ---------------------------------------------------------------------------
# ws_manager unavailable
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_ws_manager_returns_warning():
    """If helpers.ws_manager can't be imported, returns a graceful error."""
    tool = _make_tool(_valid_args())

    original = sys.modules.pop("helpers.ws_manager", None)
    try:
        resp = await tool.execute()
    finally:
        if original is not None:
            sys.modules["helpers.ws_manager"] = original

    assert "not available" in resp.message.lower() or "could not emit" in resp.message.lower()
    assert resp.break_loop is False


# ---------------------------------------------------------------------------
# Emit failure
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_emit_exception_returns_error(mock_send_data):
    tool = _make_tool(_valid_args())
    mock_send_data.side_effect = ConnectionError("socket dead")
    resp = await tool.execute()
    assert "emit failed" in resp.message.lower()
    assert resp.break_loop is False


# ---------------------------------------------------------------------------
# Priority coercion
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_priority_string_coerced_to_int(mock_send_data):
    tool = _make_tool(_valid_args(priority="2"))
    await tool.execute()
    card = mock_send_data.call_args[0][1]["card"]
    assert card["priority"] == 2


@pytest.mark.asyncio
async def test_invalid_priority_defaults_to_zero(mock_send_data):
    tool = _make_tool(_valid_args(priority=99))
    await tool.execute()
    card = mock_send_data.call_args[0][1]["card"]
    assert card["priority"] == 0


@pytest.mark.asyncio
async def test_non_numeric_priority_defaults_to_zero(mock_send_data):
    tool = _make_tool(_valid_args(priority="high"))
    await tool.execute()
    card = mock_send_data.call_args[0][1]["card"]
    assert card["priority"] == 0


# ---------------------------------------------------------------------------
# Source validation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_invalid_source_defaults_to_reactive(mock_send_data):
    tool = _make_tool(_valid_args(source="unknown"))
    await tool.execute()
    card = mock_send_data.call_args[0][1]["card"]
    assert card["source"] == "reactive"
