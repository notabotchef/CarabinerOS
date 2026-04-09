"""ActionCard tool – creates and emits action cards to the frontend via Socket.IO."""

import time
import uuid

# Import A0 base classes — required for tool discovery.
# Falls back to plain stubs for test environments.
try:
    from helpers.tool import Tool as _ToolBase, Response  # type: ignore
except ImportError:
    from dataclasses import dataclass

    class _ToolBase:  # type: ignore[no-redef]
        def __init__(self, agent, name, method, args, message, loop_data, **kwargs):
            self.agent = agent
            self.name = name
            self.method = method
            self.args = args or {}
            self.message = message
            self.loop_data = loop_data

    @dataclass
    class Response:  # type: ignore[no-redef]
        message: str = ""
        break_loop: bool = False

__all__ = ["ActionCard", "Response", "_validate_changes", "_validate_stats"]

VALID_TYPES = {"urgent", "action", "update", "info"}
VALID_ACTIONS = {"create", "update", "delete", "review", "alert", "report"}
VALID_OPS = {"+", "!", "\u2192"}
VALID_SOURCES = {"reactive", "proactive"}


def _validate_changes(changes):
    """Filter changes to only valid entries with valid op and non-empty text."""
    result = []
    for c in changes:
        if not isinstance(c, dict):
            continue
        op = c.get("op", "")
        text = c.get("text", "")
        if op in VALID_OPS and isinstance(text, str) and text.strip():
            result.append({"op": op, "text": text})
    return result


def _validate_stats(stats):
    """Filter stats to only valid entries with non-empty label AND value."""
    result = []
    for s in stats:
        if not isinstance(s, dict):
            continue
        label = s.get("label", "")
        value = s.get("value", "")
        if isinstance(label, str) and label.strip() and isinstance(value, str) and value.strip():
            result.append({"label": label, "value": value})
    return result


class ActionCard(_ToolBase):
    """A0 tool that creates and emits action cards to the frontend."""

    async def execute(self, **kwargs):
        args = self.args

        # Required fields
        module = args.get("module", "")
        summary = args.get("summary", "")

        if not module:
            return Response(message="Error: 'module' is required.", break_loop=False)
        if not summary:
            return Response(message="Error: 'summary' is required.", break_loop=False)

        # Type validation
        card_type = args.get("type", "info")
        if card_type not in VALID_TYPES:
            return Response(
                message=f"Error: invalid type '{card_type}'. Must be one of: {', '.join(sorted(VALID_TYPES))}",
                break_loop=False,
            )

        # Action validation
        action = args.get("action", "update")
        if action not in VALID_ACTIONS:
            return Response(
                message=f"Error: invalid action '{action}'. Must be one of: {', '.join(sorted(VALID_ACTIONS))}",
                break_loop=False,
            )

        # Optional fields
        detail = args.get("detail", "")
        item_id = args.get("itemId", None)
        changes = _validate_changes(args.get("changes", []))
        stats = _validate_stats(args.get("stats", []))
        deadline = args.get("deadline", None)

        # Priority coercion
        raw_priority = args.get("priority", 0)
        try:
            priority = int(raw_priority)
        except (ValueError, TypeError):
            priority = 0
        if priority not in (0, 1, 2):
            priority = 0

        # Source validation
        source = args.get("source", "reactive")
        if source not in VALID_SOURCES:
            source = "reactive"

        # Build card
        card = {
            "id": str(uuid.uuid4()),
            "type": card_type,
            "module": module,
            "action": action,
            "summary": summary,
            "detail": detail,
            "itemId": item_id,
            "changes": changes,
            "stats": stats,
            "priority": priority,
            "deadline": deadline,
            "status": "new",
            "timestamp": int(time.time()),
            "source": source,
        }

        # Emit via send_data() which defaults to namespace "/ws" — the
        # namespace the frontend actually subscribes to in socket-client.ts.
        # Do NOT use sio.emit(namespace="/state_sync") — no frontend listens
        # on /state_sync, so cards emitted there are silently dropped.
        try:
            from helpers.ws_manager import send_data  # type: ignore
        except Exception as exc:
            return Response(
                message=f"Warning: ws_manager not available ({exc}). Could not emit action card.",
                break_loop=False,
            )

        try:
            await send_data("action_card", {"card": card})
        except Exception as e:
            return Response(
                message=f"Emit failed: {e}",
                break_loop=False,
            )

        return Response(
            message=f"Action card emitted successfully: [{card_type}] {summary}",
            break_loop=False,
        )
