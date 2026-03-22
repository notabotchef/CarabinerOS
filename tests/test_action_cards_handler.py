"""Tests for ActionCardsHandler card_message -> A0 routing.

Validates:
- _build_card_prompt constructs proper prompts with/without card context
- _handle_message routes to A0 and emits card_reply
- Timeout and error fallbacks return user-friendly messages
- Missing text returns MISSING_TEXT error
"""

from __future__ import annotations

import asyncio
import sys
import threading
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from python.websocket_handlers.state_sync_handler.action_cards_handler import (
    ActionCardsHandler,
    _build_card_prompt,
    _FALLBACK_ERROR_MSG,
    _FALLBACK_TIMEOUT_MSG,
    _FALLBACK_UNAVAILABLE_MSG,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _FakeSocketIO:
    async def emit(self, *_args, **_kwargs):
        return None

    async def disconnect(self, *_args, **_kwargs):
        return None


def _make_handler() -> ActionCardsHandler:
    ActionCardsHandler._reset_instance_for_testing()
    handler = ActionCardsHandler.get_instance(_FakeSocketIO(), threading.RLock())
    # Stub broadcast so it doesn't require a real manager
    handler.broadcast = AsyncMock()
    return handler


# ---------------------------------------------------------------------------
# _build_card_prompt tests
# ---------------------------------------------------------------------------


class TestBuildCardPrompt:
    def test_no_card_context_returns_plain_text(self):
        assert _build_card_prompt("hello", None) == "hello"

    def test_no_card_context_empty_dict(self):
        result = _build_card_prompt("hello", {})
        assert "hello" in result

    def test_full_card_context(self):
        card = {
            "type": "urgent",
            "module": "inventory",
            "summary": "Low stock on salmon",
            "detail": "Only 2 lbs remaining",
        }
        result = _build_card_prompt("What should I order?", card)
        assert "urgent" in result
        assert "inventory" in result
        assert "Low stock on salmon" in result
        assert "Only 2 lbs remaining" in result
        assert "What should I order?" in result

    def test_partial_card_context_no_detail(self):
        card = {"type": "action", "module": "prep", "summary": "Prep list ready"}
        result = _build_card_prompt("confirm", card)
        assert "action" in result
        assert "prep" in result
        assert "Prep list ready" in result
        assert "confirm" in result

    def test_card_context_no_summary(self):
        card = {"type": "info", "module": "orders"}
        result = _build_card_prompt("tell me more", card)
        assert "info" in result
        assert "orders" in result
        assert "tell me more" in result


# ---------------------------------------------------------------------------
# _handle_message integration tests (mock _get_a0_response)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_missing_text_returns_error():
    handler = _make_handler()
    result = await handler.process_event(
        "card_message", {"cardId": "card-123"}, "sid-1"
    )
    payload = result.as_result(handler_id="test", fallback_correlation_id=None)
    assert payload["ok"] is False
    assert payload["error"]["code"] == "MISSING_TEXT"


@pytest.mark.asyncio
async def test_missing_card_id_returns_error():
    handler = _make_handler()
    result = await handler.process_event("card_message", {"text": "hi"}, "sid-1")
    payload = result.as_result(handler_id="test", fallback_correlation_id=None)
    assert payload["ok"] is False
    assert payload["error"]["code"] == "MISSING_CARD_ID"


@pytest.mark.asyncio
async def test_successful_a0_response():
    handler = _make_handler()
    handler._get_a0_response = AsyncMock(
        return_value="Order 5 cases of salmon from Pacific Catch."
    )

    result = await handler.process_event(
        "card_message",
        {
            "cardId": "card-abc",
            "text": "What should I order?",
            "card": {"type": "urgent", "module": "inventory", "summary": "Low stock"},
        },
        "sid-1",
    )

    payload = result.as_result(handler_id="test", fallback_correlation_id=None)
    assert payload["ok"] is True
    assert payload["data"]["status"] == "replied"

    # Verify broadcast was called with card_reply
    handler.broadcast.assert_called_once()
    call_args = handler.broadcast.call_args
    assert call_args[0][0] == "card_reply"
    reply_data = call_args[0][1]
    assert reply_data["cardId"] == "card-abc"
    assert reply_data["message"]["role"] == "assistant"
    assert reply_data["message"]["text"] == "Order 5 cases of salmon from Pacific Catch."
    assert "timestamp" in reply_data["message"]


@pytest.mark.asyncio
async def test_a0_called_with_card_context_prompt():
    """Verify that card context is included in the prompt sent to A0."""
    handler = _make_handler()
    handler._get_a0_response = AsyncMock(return_value="Sure thing.")

    await handler.process_event(
        "card_message",
        {
            "cardId": "card-abc",
            "text": "What should I do?",
            "card": {"type": "urgent", "module": "inventory", "summary": "Low stock"},
        },
        "sid-1",
    )

    # Check the prompt passed to _get_a0_response includes card context
    prompt = handler._get_a0_response.call_args[0][0]
    assert "urgent" in prompt
    assert "inventory" in prompt
    assert "Low stock" in prompt
    assert "What should I do?" in prompt


@pytest.mark.asyncio
async def test_message_without_card_context_still_works():
    """Card context is optional -- message should process with just text."""
    handler = _make_handler()
    handler._get_a0_response = AsyncMock(return_value="Got it, chef.")

    result = await handler.process_event(
        "card_message",
        {"cardId": "card-abc", "text": "do it"},
        "sid-1",
    )

    # The prompt should be the raw text (no card context)
    prompt = handler._get_a0_response.call_args[0][0]
    assert prompt == "do it"

    reply_data = handler.broadcast.call_args[0][1]
    assert reply_data["message"]["text"] == "Got it, chef."


@pytest.mark.asyncio
async def test_broadcast_failure_still_returns_ok():
    """Even if broadcast fails, the handler should return ok (best-effort emit)."""
    handler = _make_handler()
    handler._get_a0_response = AsyncMock(return_value="Response.")
    handler.broadcast = AsyncMock(side_effect=Exception("emit failed"))

    result = await handler.process_event(
        "card_message",
        {"cardId": "card-abc", "text": "hello"},
        "sid-1",
    )

    payload = result.as_result(handler_id="test", fallback_correlation_id=None)
    assert payload["ok"] is True


# ---------------------------------------------------------------------------
# _get_a0_response unit tests (patch agent module)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_a0_response_no_context():
    handler = _make_handler()

    with patch("agent.AgentContext") as MockCtx:
        MockCtx.first = MagicMock(return_value=None)
        result = await handler._get_a0_response("hello")

    assert result == _FALLBACK_UNAVAILABLE_MSG


@pytest.mark.asyncio
async def test_get_a0_response_success():
    handler = _make_handler()

    mock_task = MagicMock()
    mock_task.result = AsyncMock(return_value="A0 says hello back.")
    mock_task.is_alive = MagicMock(return_value=False)

    mock_context = MagicMock()
    mock_context.communicate = MagicMock(return_value=mock_task)
    mock_context.task = None

    with patch("agent.AgentContext") as MockCtx:
        MockCtx.first = MagicMock(return_value=mock_context)
        result = await handler._get_a0_response("hello")

    assert result == "A0 says hello back."


@pytest.mark.asyncio
async def test_get_a0_response_timeout():
    handler = _make_handler()

    mock_task = MagicMock()
    mock_task.result = AsyncMock(side_effect=asyncio.TimeoutError())
    mock_task.is_alive = MagicMock(return_value=False)

    mock_context = MagicMock()
    mock_context.communicate = MagicMock(return_value=mock_task)
    mock_context.task = None

    with patch("agent.AgentContext") as MockCtx:
        MockCtx.first = MagicMock(return_value=mock_context)
        result = await handler._get_a0_response("hello")

    assert result == _FALLBACK_TIMEOUT_MSG


@pytest.mark.asyncio
async def test_get_a0_response_exception():
    handler = _make_handler()

    mock_task = MagicMock()
    mock_task.result = AsyncMock(side_effect=RuntimeError("LLM down"))
    mock_task.is_alive = MagicMock(return_value=False)

    mock_context = MagicMock()
    mock_context.communicate = MagicMock(return_value=mock_task)
    mock_context.task = None

    with patch("agent.AgentContext") as MockCtx:
        MockCtx.first = MagicMock(return_value=mock_context)
        result = await handler._get_a0_response("hello")

    assert result == _FALLBACK_ERROR_MSG


@pytest.mark.asyncio
async def test_get_a0_response_empty_string():
    handler = _make_handler()

    mock_task = MagicMock()
    mock_task.result = AsyncMock(return_value="")
    mock_task.is_alive = MagicMock(return_value=False)

    mock_context = MagicMock()
    mock_context.communicate = MagicMock(return_value=mock_task)
    mock_context.task = None

    with patch("agent.AgentContext") as MockCtx:
        MockCtx.first = MagicMock(return_value=mock_context)
        result = await handler._get_a0_response("hello")

    assert result == _FALLBACK_ERROR_MSG


@pytest.mark.asyncio
async def test_get_a0_response_none_result():
    handler = _make_handler()

    mock_task = MagicMock()
    mock_task.result = AsyncMock(return_value=None)
    mock_task.is_alive = MagicMock(return_value=False)

    mock_context = MagicMock()
    mock_context.communicate = MagicMock(return_value=mock_task)
    mock_context.task = None

    with patch("agent.AgentContext") as MockCtx:
        MockCtx.first = MagicMock(return_value=mock_context)
        result = await handler._get_a0_response("hello")

    assert result == _FALLBACK_ERROR_MSG


# ---------------------------------------------------------------------------
# commit / dismiss still work (regression)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_commit_card():
    handler = _make_handler()
    result = await handler.process_event(
        "card_commit", {"cardId": "card-xyz"}, "sid-1"
    )
    payload = result.as_result(handler_id="test", fallback_correlation_id=None)
    assert payload["ok"] is True
    assert payload["data"]["status"] == "committed"


@pytest.mark.asyncio
async def test_dismiss_card():
    handler = _make_handler()
    result = await handler.process_event(
        "card_dismiss", {"cardId": "card-xyz"}, "sid-1"
    )
    payload = result.as_result(handler_id="test", fallback_correlation_id=None)
    assert payload["ok"] is True
    assert payload["data"]["status"] == "dismissed"
