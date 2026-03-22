"""A0 tool that lets the LLM emit structured action cards via Socket.IO.

The agent calls this tool with card fields (type, module, action, summary, etc.)
and the tool validates, normalizes, and emits the card to the frontend via
Socket.IO on the /state_sync namespace.
"""

from __future__ import annotations

import logging
import time
import uuid

from python.helpers.tool import Tool, Response

logger = logging.getLogger(__name__)

# Valid enum values matching the frontend ActionCard interface
VALID_TYPES = {"urgent", "action", "update", "info"}
VALID_ACTIONS = {"create", "update", "delete"}
VALID_PRIORITIES = {0, 1, 2}
VALID_SOURCES = {"reactive", "proactive"}


def _get_sio_fallback():
    """Lazy import as a last-resort fallback when config.additional has no sio."""
    try:
        from run_ui import socketio_server
        return socketio_server
    except ImportError:
        return None


def _validate_changes(changes: list) -> list[dict]:
    """Validate and normalize the changes array."""
    result = []
    for item in changes:
        if not isinstance(item, dict):
            continue
        op = item.get("op", "")
        text = item.get("text", "")
        if op in ("+", "!", "\u2192") and text:
            result.append({"op": op, "text": str(text)})
    return result


def _validate_stats(stats: list) -> list[dict]:
    """Validate and normalize the stats array."""
    result = []
    for item in stats:
        if not isinstance(item, dict):
            continue
        label = item.get("label", "")
        value = item.get("value", "")
        if label and value:
            result.append({"label": str(label), "value": str(value)})
    return result


class ActionCard(Tool):

    async def execute(self, **kwargs) -> Response:
        # --- Extract and validate required fields ---
        card_type = self.args.get("type", "")
        module = self.args.get("module", "")
        action = self.args.get("action", "")
        summary = self.args.get("summary", "")

        errors = []
        if not summary:
            errors.append("'summary' is required")
        if not module:
            errors.append("'module' is required")
        if card_type and card_type not in VALID_TYPES:
            errors.append(f"'type' must be one of {sorted(VALID_TYPES)}, got '{card_type}'")
        if action and action not in VALID_ACTIONS:
            errors.append(f"'action' must be one of {sorted(VALID_ACTIONS)}, got '{action}'")

        if errors:
            return Response(
                message="Action card validation failed: " + "; ".join(errors),
                break_loop=False,
            )

        # --- Extract optional fields with defaults ---
        priority = self.args.get("priority", 0)
        try:
            priority = int(priority)
        except (ValueError, TypeError):
            priority = 0
        if priority not in VALID_PRIORITIES:
            priority = 0

        source = self.args.get("source", "reactive")
        if source not in VALID_SOURCES:
            source = "reactive"

        changes_raw = self.args.get("changes", [])
        if not isinstance(changes_raw, list):
            changes_raw = []

        stats_raw = self.args.get("stats", [])
        if not isinstance(stats_raw, list):
            stats_raw = []

        # --- Build the normalized card ---
        card = {
            "id": self.args.get("id", str(uuid.uuid4())),
            "type": card_type or "info",
            "module": module,
            "action": action or "update",
            "summary": summary,
            "detail": self.args.get("detail", ""),
            "itemId": self.args.get("itemId"),
            "changes": _validate_changes(changes_raw),
            "stats": _validate_stats(stats_raw),
            "priority": priority,
            "deadline": self.args.get("deadline"),
            "status": "new",
            "timestamp": int(time.time()),
            "source": source,
        }

        # --- Get Socket.IO server ---
        sio = self.agent.config.additional.get("sio")
        if not sio:
            sio = _get_sio_fallback()
            if sio:
                self.agent.config.additional["sio"] = sio
                logger.debug("[ActionCard] acquired sio via fallback import")

        if not sio:
            logger.warning("[ActionCard] no sio available -- cannot emit card")
            return Response(
                message="Action card built but could not emit: Socket.IO server not available.",
                break_loop=False,
            )

        # --- Emit ---
        try:
            await sio.emit(
                "action_card",
                {"card": card},
                namespace="/state_sync",
            )
            logger.info(
                "[ActionCard] EMITTED: id=%s type=%s module=%s summary=%.60s",
                card["id"][:8],
                card["type"],
                card["module"],
                card["summary"],
            )
        except Exception as e:
            logger.error("[ActionCard] emit failed: %s", e, exc_info=True)
            return Response(
                message=f"Action card emit failed: {e}",
                break_loop=False,
            )

        return Response(
            message=f"Action card emitted successfully (id={card['id'][:8]}..., type={card['type']}, module={card['module']}).",
            break_loop=False,
        )
