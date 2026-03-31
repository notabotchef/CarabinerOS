"""Emit action_card events when a tool returns a card payload.

Runs after tool execution. Two paths:

1. **DB-write auto-emit** (primary): When the tool is a carabiner_db MCP write
   operation (db_mutate, db_batch, or *_create/*_update/*_delete), parse the
   structured response and automatically construct an action card.

2. **JSON-extraction fallback** (secondary): When the response contains
   structured action card JSON (e.g. from the Expo sub-agent), parse it and
   emit. This is the original behavior, kept as a fallback.
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid

from helpers.extension import Extension

logger = logging.getLogger(__name__)

# Required fields for a valid action card (fallback path)
REQUIRED_FIELDS = {"type", "module", "action", "summary"}

# MCP tool name prefix for carabiner DB tools
_MCP_PREFIX = "carabiner_db."

# Suffixes that indicate write operations on individual-model tools
_WRITE_SUFFIXES = ("_create", "_update", "_delete")

# Standalone MCP write tools
_WRITE_TOOLS = {"db_mutate", "db_batch"}

# Read-only suffixes -- never emit cards for these
_READ_SUFFIXES = ("_list", "_get", "_query")

# Per-module fields to use for building human-readable summaries
_MODULE_SUMMARY_FIELDS: dict[str, list[str]] = {
    "orders": ["vendor", "total"],
    "inventory": ["item_name", "on_hand"],
    "prep": ["task", "station"],
    "menu": ["item_name", "category"],
    "recipes": ["name", "category"],
    "invoices": ["vendor_name", "total"],
    "campaigns": ["campaign_name", "channel"],
    "food_cost": ["menu_item_name", "current_cost_pct"],
}


# ---------------------------------------------------------------------------
# DB-write auto-card helpers
# ---------------------------------------------------------------------------


def _is_db_write_tool(tool_name: str) -> bool:
    """Return True if tool_name is a carabiner_db write operation."""
    if not tool_name.startswith(_MCP_PREFIX):
        return False
    short = tool_name[len(_MCP_PREFIX):]
    if short in _WRITE_TOOLS:
        return True
    for suffix in _WRITE_SUFFIXES:
        if suffix in short:
            return True
    return False


def _is_read_only_tool(tool_name: str) -> bool:
    """Return True if tool_name is a read-only DB operation."""
    if not tool_name.startswith(_MCP_PREFIX):
        return False
    short = tool_name[len(_MCP_PREFIX):]
    if short == "db_query":
        return True
    for suffix in _READ_SUFFIXES:
        if short.endswith(suffix):
            return True
    return False


def _extract_action(tool_name: str, data: dict) -> str:
    """Determine the CRUD action from the tool name or response data."""
    short = tool_name[len(_MCP_PREFIX):]
    for action in ("create", "update", "delete"):
        if f"_{action}" in short:
            return action
    # For db_mutate / db_batch, look in the data
    return data.get("action", "update")


def _extract_module(tool_name: str, data: dict) -> str:
    """Determine the module from the tool name or response data."""
    short = tool_name[len(_MCP_PREFIX):]
    if short in _WRITE_TOOLS:
        return data.get("module", "unknown")
    # e.g. "orders_create" -> "orders", "inventory_update" -> "inventory"
    for suffix in _WRITE_SUFFIXES:
        if suffix in short:
            return short.split(suffix)[0]
    return "unknown"


def _build_summary(module: str, action: str, data: dict) -> str:
    """Build a human-readable one-line summary."""
    action_verb = {"create": "Created", "update": "Updated", "delete": "Deleted"}.get(
        action, "Modified"
    )
    fields = _MODULE_SUMMARY_FIELDS.get(module, [])
    parts = []
    for field in fields:
        val = data.get(field)
        if val is not None:
            parts.append(str(val))
    if parts:
        return f"{action_verb} {module}: {', '.join(parts)}"
    return f"{action_verb} {module} record"


def _build_detail(data: dict) -> str:
    """Build a detail string from key fields in the response."""
    skip = {"id", "created_at", "updated_at", "location_id"}
    parts = []
    for k, v in data.items():
        if k in skip or v is None:
            continue
        parts.append(f"{k}: {v}")
        if len(parts) >= 6:
            break
    return "; ".join(parts)


def _build_stats(module: str, data: dict) -> list[dict]:
    """Extract numeric/key fields as stats."""
    stats = []
    fields = _MODULE_SUMMARY_FIELDS.get(module, [])
    for field in fields:
        val = data.get(field)
        if val is not None:
            label = field.replace("_", " ").title()
            display = f"${val}" if field in ("total", "current_cost_pct") else str(val)
            stats.append({"label": label, "value": display})
    return stats


def _build_changes(action: str, module: str) -> list[dict]:
    """Build changes array from the action type."""
    op_map = {"create": "+", "delete": "!", "update": "\u2192"}
    op = op_map.get(action, "\u2192")
    text_map = {
        "create": f"New {module} record created",
        "delete": f"{module.title()} record deleted",
        "update": f"{module.title()} record updated",
    }
    return [{"op": op, "text": text_map.get(action, f"{module} modified")}]


def _card_from_db_write(tool_name: str, data: dict) -> dict:
    """Construct an action card dict from a DB write response."""
    action = _extract_action(tool_name, data)
    module = _extract_module(tool_name, data)

    card_type = "action" if action == "delete" else "update"
    priority = 1 if action == "delete" else 0

    return {
        "id": str(uuid.uuid4()),
        "type": card_type,
        "module": module,
        "action": action,
        "summary": _build_summary(module, action, data),
        "detail": _build_detail(data),
        "itemId": data.get("id"),
        "changes": _build_changes(action, module),
        "stats": _build_stats(module, data),
        "priority": priority,
        "deadline": None,
        "status": "new",
        "timestamp": int(time.time()),
        "source": "reactive",
    }


# ---------------------------------------------------------------------------
# JSON-extraction fallback helpers (original code)
# ---------------------------------------------------------------------------


def _extract_all_json_objects(text: str) -> list[dict]:
    """Extract all top-level JSON objects from text.

    Handles:
    - Raw JSON (entire text is one object or array)
    - JSON inside markdown code blocks
    - JSON embedded in natural language
    - Multiple JSON objects in a single response
    """
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


# ---------------------------------------------------------------------------
# Socket.IO acquisition
# ---------------------------------------------------------------------------


def _get_sio_fallback():
    """Lazy import as a last-resort fallback when config.additional has no sio."""
    try:
        from run_ui import socketio_server

        return socketio_server
    except ImportError:
        return None


def _acquire_sio(agent):
    """Walk agent hierarchy to find sio, falling back to module import."""
    from agent import Agent

    current = agent
    sio = None
    while current:
        sio = current.config.additional.get("sio")
        if sio:
            break
        current = current.get_data(Agent.DATA_NAME_SUPERIOR)
    if not sio:
        sio = _get_sio_fallback()
    if sio:
        # Cache on the original agent for next time
        agent.config.additional["sio"] = sio
    return sio


# ---------------------------------------------------------------------------
# Extension
# ---------------------------------------------------------------------------


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

        cards: list[dict] = []

        # --- Primary path: DISABLED ---
        # A0 now calls notify_user directly after DB writes.
        # Notifications flow via state_push → snapshot.notifications → frontend.
        # Auto-emit is disabled to prevent duplicate cards.
        if False and _is_db_write_tool(tool_name):
            try:
                data = json.loads(text.strip())
            except (json.JSONDecodeError, TypeError):
                logger.debug(
                    "[ActionCardEmit] DB write tool but response is not valid JSON"
                )
                data = None

            if isinstance(data, dict):
                # Check for error responses
                if data.get("error") or data.get("ok") is False:
                    logger.debug(
                        "[ActionCardEmit] DB write returned error, skipping card"
                    )
                else:
                    card = _card_from_db_write(tool_name, data)
                    cards.append(card)
                    logger.info(
                        "[ActionCardEmit] auto-card from DB write: tool=%s module=%s action=%s",
                        tool_name,
                        card["module"],
                        card["action"],
                    )
            elif isinstance(data, list):
                # db_batch returns a list of results
                for item in data:
                    if isinstance(item, dict) and not item.get("error"):
                        card = _card_from_db_write(tool_name, item)
                        cards.append(card)

        # --- Fallback path: JSON-extraction for explicit card payloads ---
        if not cards:
            json_objects = _extract_all_json_objects(text)
            cards = [
                _normalize_card(obj) for obj in json_objects if _is_action_card(obj)
            ]

        if not cards:
            logger.debug("[ActionCardEmit] no action card found in response")
            return

        logger.info(
            "[ActionCardEmit] found %d action card(s) in tool=%s response",
            len(cards),
            tool_name,
        )

        # Get Socket.IO server reference (walk agent hierarchy)
        sio = _acquire_sio(self.agent)

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
                    namespace="/ws",
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
