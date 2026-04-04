"""Safety-net: emit a notification if A0 runs a CLI write but forgets notify_user.

The PRIMARY path is A0 calling notify_user directly after CLI writes (prompted).
This extension is a FALLBACK — it detects CLI writes in code_execution output
and sends a notification via NotificationManager if A0 didn't already.
"""

from __future__ import annotations

import json
import logging
import re

from helpers.extension import Extension

logger = logging.getLogger(__name__)

# Regex to detect carabiner CLI write commands in code_execution output
_CLI_WRITE_RE = re.compile(
    r"carabiner\s+([\w-]+)\s+(create|update|delete)",
    re.IGNORECASE,
)

_CLI_RESOURCE_MAP = {
    "orders": "orders",
    "inventory": "inventory",
    "prep": "prep",
    "menu": "menu",
    "recipes": "recipes",
    "invoices": "invoices",
    "food-cost": "food_cost",
    "vendors": "vendors",
    "campaigns": "campaigns",
}

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


def _build_summary(module: str, action: str, data: dict) -> str:
    verb = {"create": "Created", "update": "Updated", "delete": "Deleted"}.get(action, "Modified")
    fields = _MODULE_SUMMARY_FIELDS.get(module, [])
    parts = [str(data[f]) for f in fields if data.get(f) is not None]
    return f"{verb} {module}: {', '.join(parts)}" if parts else f"{verb} {module} record"


def _build_detail(data: dict) -> str:
    skip = {"id", "created_at", "updated_at", "location_id"}
    parts = [f"{k}: {v}" for k, v in data.items() if k not in skip and v is not None][:6]
    return "; ".join(parts)


def _find_json_block(text: str) -> dict | None:
    idx = text.find("{")
    if idx == -1:
        return None
    depth = 0
    in_string = False
    escape = False
    start = idx
    for i in range(idx, len(text)):
        ch = text[i]
        if escape:
            escape = False
        elif ch == "\\":
            escape = True
        elif ch == '"' and not escape:
            in_string = not in_string
        elif not in_string:
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start : i + 1])
                    except json.JSONDecodeError:
                        return None
    return None


class ActionCardEmit(Extension):
    async def execute(self, **kwargs) -> None:
        tool_name = kwargs.get("tool_name", "")
        if tool_name != "code_execution":
            return

        response = kwargs.get("response")
        if not response:
            return

        text = ""
        if hasattr(response, "message") and response.message:
            text = response.message
        elif isinstance(response, str):
            text = response
        if not text:
            return

        match = _CLI_WRITE_RE.search(text)
        if not match:
            return

        resource_raw = match.group(1).lower()
        action = match.group(2).lower()
        module = _CLI_RESOURCE_MAP.get(resource_raw, resource_raw.replace("-", "_"))

        data = _find_json_block(text)
        if not data or data.get("error"):
            return

        title = _build_summary(module, action, data)
        detail = _build_detail(data)

        from helpers.notification import NotificationType, NotificationPriority
        from agent import AgentContext

        ntype = NotificationType.WARNING if action == "delete" else NotificationType.SUCCESS

        AgentContext.get_notification_manager().add_notification(
            type=ntype,
            priority=NotificationPriority.HIGH,
            title=title,
            message=detail,
            display_time=30,
            group=module,
        )

        print(f"[ActionCardEmit] fallback notification: {title}")
