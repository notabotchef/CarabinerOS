"""Tests for the action card emission extension.

Validates JSON extraction, card detection, normalization, and the
end-to-end emit flow (with a mocked Socket.IO server).
"""

from __future__ import annotations

import json
import sys
import types
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Import the extension module under test
# ---------------------------------------------------------------------------
sys.path.insert(0, ".")  # ensure project root is on path

from usr.extensions.tool_execute_after._30_action_card_emit import (
    ActionCardEmit,
    _extract_all_json_objects,
    _find_json_blocks,
    _is_action_card,
    _normalize_card,
)


# ---------------------------------------------------------------------------
# _extract_all_json_objects tests
# ---------------------------------------------------------------------------


class TestExtractAllJsonObjects:
    def test_raw_json_object(self):
        card = {"type": "info", "module": "orders", "action": "create", "summary": "Test"}
        result = _extract_all_json_objects(json.dumps(card))
        assert len(result) == 1
        assert result[0]["type"] == "info"

    def test_raw_json_array(self):
        cards = [
            {"type": "info", "module": "orders", "action": "create", "summary": "A"},
            {"type": "urgent", "module": "prep", "action": "update", "summary": "B"},
        ]
        result = _extract_all_json_objects(json.dumps(cards))
        assert len(result) == 2

    def test_markdown_code_block(self):
        text = 'Here is the card:\n```json\n{"type": "info", "module": "orders", "action": "create", "summary": "Test"}\n```\n'
        result = _extract_all_json_objects(text)
        assert len(result) == 1
        assert result[0]["summary"] == "Test"

    def test_json_embedded_in_prose(self):
        text = (
            'I created this card for you:\n'
            '{"type": "action", "module": "inventory", "action": "update", "summary": "Low stock"}\n'
            'Both cards are ready.'
        )
        result = _extract_all_json_objects(text)
        assert len(result) == 1
        assert result[0]["module"] == "inventory"

    def test_nested_json_objects(self):
        card = {
            "type": "info",
            "module": "orders",
            "action": "create",
            "summary": "Test",
            "changes": [{"op": "+", "text": "added item"}],
        }
        text = json.dumps(card)
        result = _extract_all_json_objects(text)
        assert len(result) == 1
        assert result[0]["changes"] == [{"op": "+", "text": "added item"}]

    def test_empty_text(self):
        assert _extract_all_json_objects("") == []

    def test_no_json(self):
        assert _extract_all_json_objects("Just some regular text, no JSON here.") == []

    def test_invalid_json(self):
        assert _extract_all_json_objects("{not valid json}") == []

    def test_multiple_code_blocks(self):
        text = (
            '```json\n{"type": "info", "module": "a", "action": "create", "summary": "X"}\n```\n'
            'And another:\n'
            '```json\n{"type": "urgent", "module": "b", "action": "update", "summary": "Y"}\n```'
        )
        result = _extract_all_json_objects(text)
        assert len(result) == 2


# ---------------------------------------------------------------------------
# _is_action_card tests
# ---------------------------------------------------------------------------


class TestIsActionCard:
    def test_valid_card(self):
        assert _is_action_card({"type": "info", "module": "orders", "action": "create", "summary": "test"})

    def test_missing_field(self):
        assert not _is_action_card({"type": "info", "module": "orders"})

    def test_extra_fields_ok(self):
        assert _is_action_card({
            "type": "info", "module": "orders", "action": "create",
            "summary": "test", "extra": "field",
        })

    def test_no_card_response(self):
        assert not _is_action_card({"no_card": True, "reason": "read-only"})


# ---------------------------------------------------------------------------
# _normalize_card tests
# ---------------------------------------------------------------------------


class TestNormalizeCard:
    def test_generates_id_if_missing(self):
        card = _normalize_card({"type": "info", "module": "a", "action": "b", "summary": "c"})
        assert "id" in card
        # Should be a valid UUID
        uuid.UUID(card["id"])

    def test_preserves_existing_id(self):
        card = _normalize_card({"id": "my-id", "type": "info", "module": "a", "action": "b", "summary": "c"})
        assert card["id"] == "my-id"

    def test_status_always_new(self):
        card = _normalize_card({"type": "info", "module": "a", "action": "b", "summary": "c", "status": "old"})
        assert card["status"] == "new"

    def test_defaults(self):
        card = _normalize_card({"type": "info", "module": "a", "action": "b", "summary": "c"})
        assert card["detail"] == ""
        assert card["changes"] == []
        assert card["stats"] == []
        assert card["priority"] == 0
        assert card["deadline"] is None
        assert card["source"] == "reactive"


# ---------------------------------------------------------------------------
# ActionCardEmit.execute tests
# ---------------------------------------------------------------------------


def _make_agent(sio=None):
    """Create a minimal mock agent with config.additional."""
    agent = MagicMock()
    agent.config.additional = {}
    if sio:
        agent.config.additional["sio"] = sio
    agent.number = 0
    return agent


def _make_response(message: str):
    """Create a mock Response with a .message attribute."""
    resp = MagicMock()
    resp.message = message
    return resp


@pytest.mark.asyncio
async def test_emits_valid_card():
    """Extension emits action_card when response contains valid card JSON."""
    sio = AsyncMock()
    agent = _make_agent(sio=sio)

    card_json = json.dumps({
        "type": "action",
        "module": "orders",
        "action": "create",
        "summary": "New produce order drafted",
    })
    response = _make_response(card_json)

    ext = ActionCardEmit(agent=agent)
    await ext.execute(response=response, tool_name="call_subordinate")

    sio.emit.assert_called_once()
    call_args = sio.emit.call_args
    assert call_args[0][0] == "action_card"
    assert call_args[1]["namespace"] == "/state_sync"
    emitted_card = call_args[0][1]["card"]
    assert emitted_card["type"] == "action"
    assert emitted_card["module"] == "orders"
    assert emitted_card["status"] == "new"


@pytest.mark.asyncio
async def test_skips_when_no_card_json():
    """Extension does nothing when response has no card JSON."""
    sio = AsyncMock()
    agent = _make_agent(sio=sio)

    response = _make_response("I looked up the inventory and found 42 items.")

    ext = ActionCardEmit(agent=agent)
    await ext.execute(response=response, tool_name="call_subordinate")

    sio.emit.assert_not_called()


@pytest.mark.asyncio
async def test_skips_no_card_response():
    """Extension skips the Expo no_card sentinel."""
    sio = AsyncMock()
    agent = _make_agent(sio=sio)

    response = _make_response(json.dumps({"no_card": True, "reason": "read-only query"}))

    ext = ActionCardEmit(agent=agent)
    await ext.execute(response=response, tool_name="call_subordinate")

    sio.emit.assert_not_called()


@pytest.mark.asyncio
async def test_emits_card_from_any_tool():
    """Extension works for any tool, not just call_subordinate."""
    sio = AsyncMock()
    agent = _make_agent(sio=sio)

    card_json = json.dumps({
        "type": "update",
        "module": "inventory",
        "action": "update",
        "summary": "Stock levels updated",
    })
    response = _make_response(card_json)

    ext = ActionCardEmit(agent=agent)
    await ext.execute(response=response, tool_name="inventory_check")

    sio.emit.assert_called_once()


@pytest.mark.asyncio
async def test_fallback_sio_import():
    """Extension falls back to importing sio from run_ui when not in config."""
    mock_sio = AsyncMock()
    agent = _make_agent(sio=None)  # no sio in config

    card_json = json.dumps({
        "type": "info",
        "module": "orders",
        "action": "create",
        "summary": "Test fallback",
    })
    response = _make_response(card_json)

    ext = ActionCardEmit(agent=agent)
    with patch(
        "usr.extensions.tool_execute_after._30_action_card_emit._get_sio_fallback",
        return_value=mock_sio,
    ):
        await ext.execute(response=response, tool_name="call_subordinate")

    mock_sio.emit.assert_called_once()
    # Should have cached sio in config for next time
    assert agent.config.additional["sio"] is mock_sio


@pytest.mark.asyncio
async def test_no_emit_when_no_sio():
    """Extension logs warning and skips when no sio is available at all."""
    agent = _make_agent(sio=None)

    card_json = json.dumps({
        "type": "info",
        "module": "orders",
        "action": "create",
        "summary": "No sio test",
    })
    response = _make_response(card_json)

    ext = ActionCardEmit(agent=agent)
    with patch(
        "usr.extensions.tool_execute_after._30_action_card_emit._get_sio_fallback",
        return_value=None,
    ):
        # Should not raise, just log warning
        await ext.execute(response=response, tool_name="call_subordinate")


@pytest.mark.asyncio
async def test_handles_emit_exception():
    """Extension catches and logs emit errors without raising."""
    sio = AsyncMock()
    sio.emit.side_effect = RuntimeError("connection lost")
    agent = _make_agent(sio=sio)

    card_json = json.dumps({
        "type": "info",
        "module": "orders",
        "action": "create",
        "summary": "Error test",
    })
    response = _make_response(card_json)

    ext = ActionCardEmit(agent=agent)
    # Should not raise
    await ext.execute(response=response, tool_name="call_subordinate")


@pytest.mark.asyncio
async def test_multiple_cards_in_response():
    """Extension emits multiple cards when response contains several."""
    sio = AsyncMock()
    agent = _make_agent(sio=sio)

    text = (
        '```json\n{"type": "info", "module": "orders", "action": "create", "summary": "Card A"}\n```\n'
        'And another:\n'
        '```json\n{"type": "urgent", "module": "prep", "action": "update", "summary": "Card B"}\n```'
    )
    response = _make_response(text)

    ext = ActionCardEmit(agent=agent)
    await ext.execute(response=response, tool_name="call_subordinate")

    assert sio.emit.call_count == 2


@pytest.mark.asyncio
async def test_skips_none_response():
    """Extension skips when response is None."""
    agent = _make_agent()
    ext = ActionCardEmit(agent=agent)
    await ext.execute(response=None, tool_name="test")


@pytest.mark.asyncio
async def test_skips_empty_message():
    """Extension skips when response.message is empty."""
    agent = _make_agent()
    response = _make_response("")
    ext = ActionCardEmit(agent=agent)
    await ext.execute(response=response, tool_name="test")
