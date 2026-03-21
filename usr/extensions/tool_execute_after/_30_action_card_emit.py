"""Emit action_card events when the Expo agent returns a card payload.

Runs after tool execution. When the Expo sub-agent returns structured
action card JSON, parse it and emit via Socket.IO so the frontend
can display the card in the notification panel.
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid

from python.helpers.extension import Extension

logger = logging.getLogger(__name__)

# Required fields for a valid action card
REQUIRED_FIELDS = {"type", "module", "action", "summary"}


def _extract_json(text: str) -> dict | None:
    """Try to extract a JSON object from text (may be wrapped in markdown)."""
    # Try direct parse first
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except (json.JSONDecodeError, TypeError):
        pass

    # Try extracting from markdown code block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try finding first { ... } block
    match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def _is_action_card(obj: dict) -> bool:
    """Check if a dict looks like an action card."""
    return REQUIRED_FIELDS.issubset(obj.keys())


def _normalize_card(obj: dict) -> dict:
    """Ensure all required fields have valid defaults."""
    return {
        "id": obj.get("id", str(uuid.uuid4())),
        "type": obj.get("type", "info"),
        "module": obj.get("module", "unknown"),
        "action": obj.get("action", "update"),
        "summary": obj.get("summary", ""),
        "detail": obj.get("detail", ""),
        "itemId": obj.get("itemId"),
        "changes": obj.get("changes", []),
        "stats": obj.get("stats", []),
        "priority": obj.get("priority", 0),
        "deadline": obj.get("deadline"),
        "status": "new",
        "timestamp": obj.get("timestamp", int(time.time())),
        "source": obj.get("source", "reactive"),
    }


class ActionCardEmit(Extension):
    async def execute(self, **kwargs) -> None:
        response = kwargs.get("response")
        if not response:
            return

        # Check if this is a response from the Expo sub-agent
        tool_name = kwargs.get("tool_name", "")
        if "call_subordinate" not in str(tool_name):
            # Also check the response text for action card JSON
            # in case a tool directly returns card data
            pass

        # Get response text
        text = ""
        if hasattr(response, "message") and response.message:
            text = response.message
        elif isinstance(response, str):
            text = response

        if not text:
            return

        # Try to extract action card JSON
        obj = _extract_json(text)
        if not obj or not _is_action_card(obj):
            return

        card = _normalize_card(obj)

        # Emit via Socket.IO
        sio = self.agent.config.additional.get("sio")
        if not sio:
            logger.debug("No sio in agent config — skipping action_card emit")
            return

        try:
            await sio.emit(
                "action_card",
                {"card": card},
                namespace="/state_sync",
            )
            logger.info(
                "Emitted action_card: type=%s module=%s summary=%s",
                card["type"],
                card["module"],
                card["summary"][:60],
            )
        except Exception as e:
            logger.warning("Failed to emit action_card: %s", e)
