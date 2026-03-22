"""Emit action_card events when a tool returns a card payload.

Runs after tool execution. When the response contains structured
action card JSON (typically from the Expo sub-agent via call_subordinate),
parse it and emit via Socket.IO so the frontend can display the card
in the notification panel.
"""

from __future__ import annotations

import json
import logging
import time
import uuid

from python.helpers.extension import Extension

logger = logging.getLogger(__name__)

# Required fields for a valid action card
REQUIRED_FIELDS = {"type", "module", "action", "summary"}


def _extract_all_json_objects(text: str) -> list[dict]:
    """Extract all top-level JSON objects from text.

    Handles:
    - Raw JSON (entire text is one object or array)
    - JSON inside markdown code blocks
    - JSON embedded in natural language
    - Multiple JSON objects in a single response
    """
    import re

    results: list[dict] = []

    # 1. Try direct parse (entire text is one JSON object or array)
    try:
        obj = json.loads(text.strip())
        if isinstance(obj, dict):
            return [obj]
        if isinstance(obj, list):
            return [item for item in obj if isinstance(item, dict)]
    except (json.JSONDecodeError, TypeError):
        pass

    # 2. Extract from markdown code blocks
    for match in re.finditer(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL):
        try:
            obj = json.loads(match.group(1))
            if isinstance(obj, dict):
                results.append(obj)
        except json.JSONDecodeError:
            pass

    if results:
        return results

    # 3. Find all { ... } blocks using brace-depth matching
    for block in _find_json_blocks(text):
        try:
            obj = json.loads(block)
            if isinstance(obj, dict):
                results.append(obj)
        except json.JSONDecodeError:
            pass

    return results


def _find_json_blocks(text: str) -> list[str]:
    """Find all top-level JSON object strings using brace-depth matching."""
    blocks: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        if text[i] == "{":
            depth = 0
            start = i
            in_string = False
            escape_next = False
            while i < n:
                ch = text[i]
                if escape_next:
                    escape_next = False
                elif ch == "\\":
                    escape_next = True
                elif ch == '"' and not escape_next:
                    in_string = not in_string
                elif not in_string:
                    if ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                        if depth == 0:
                            blocks.append(text[start : i + 1])
                            break
                i += 1
        i += 1
    return blocks


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


def _get_sio_fallback():
    """Lazy import as a last-resort fallback when config.additional has no sio."""
    try:
        from run_ui import socketio_server

        return socketio_server
    except ImportError:
        return None


class ActionCardEmit(Extension):
    async def execute(self, **kwargs) -> None:
        response = kwargs.get("response")
        tool_name = kwargs.get("tool_name", "")

        logger.debug(
            "[ActionCardEmit] fired: tool_name=%s response_type=%s",
            tool_name,
            type(response).__name__ if response else "None",
        )

        if not response:
            return

        # Get response text from the Response dataclass
        text = ""
        if hasattr(response, "message") and response.message:
            text = response.message
        elif isinstance(response, str):
            text = response

        if not text:
            logger.debug("[ActionCardEmit] empty response text, skipping")
            return

        logger.debug(
            "[ActionCardEmit] response text length=%d, first 200 chars: %.200s",
            len(text),
            text,
        )

        # Extract all JSON objects from the response
        json_objects = _extract_all_json_objects(text)
        cards = [_normalize_card(obj) for obj in json_objects if _is_action_card(obj)]

        if not cards:
            logger.debug("[ActionCardEmit] no action card JSON found in response")
            return

        logger.info(
            "[ActionCardEmit] found %d action card(s) in tool=%s response",
            len(cards),
            tool_name,
        )

        # Get Socket.IO server reference
        sio = self.agent.config.additional.get("sio")
        if not sio:
            sio = _get_sio_fallback()
            if sio:
                self.agent.config.additional["sio"] = sio
                logger.debug("[ActionCardEmit] acquired sio via fallback import")

        if not sio:
            logger.warning(
                "[ActionCardEmit] no sio available -- cannot emit %d card(s)",
                len(cards),
            )
            return

        # Emit each card
        for card in cards:
            try:
                await sio.emit(
                    "action_card",
                    {"card": card},
                    namespace="/state_sync",
                )
                logger.info(
                    "[ActionCardEmit] EMITTED action_card: id=%s type=%s module=%s summary=%.60s",
                    card["id"][:8],
                    card["type"],
                    card["module"],
                    card["summary"],
                )
            except Exception as e:
                logger.error(
                    "[ActionCardEmit] failed to emit action_card id=%s: %s",
                    card.get("id", "?")[:8],
                    e,
                    exc_info=True,
                )
