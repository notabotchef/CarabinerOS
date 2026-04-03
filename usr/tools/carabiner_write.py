"""carabiner_write — write operations for CarabinerOS database.

Usage:
  carabiner_write(resource="orders", verb="create", args="--vendor 'US Foods' --location-id <uuid>")
  carabiner_write(resource="orders", verb="delete", args="<uuid>")
  carabiner_write(resource="inventory", verb="update", args="<uuid> --on-hand 12")

Allowed verbs: create, update, delete
Always appends --json and injects --chat-context automatically.
Fires notify_user after every successful write so action cards appear on the dashboard.
"""

from __future__ import annotations

import subprocess
import json
import shlex

from helpers.tool import Tool, Response
from agent import AgentContext


_WRITE_VERBS = {"create", "update", "delete"}

_RESOURCES = {
    "orders", "inventory", "recipes", "menu", "invoices",
    "prep", "food-cost", "vendors", "campaigns",
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


def _build_summary(resource: str, verb: str, data: dict) -> str:
    verb_map = {"create": "Created", "update": "Updated", "delete": "Deleted"}
    label = verb_map.get(verb, "Modified")
    fields = _MODULE_SUMMARY_FIELDS.get(resource.replace("-", "_"), [])
    parts = [str(data[f]) for f in fields if data.get(f) is not None]
    suffix = f": {', '.join(parts)}" if parts else ""
    return f"{label} {resource}{suffix}"


def _build_detail(resource: str, verb: str, data: dict) -> str:
    skip = {"id", "created_at", "updated_at", "location_id"}
    kvs = [f"{k}: {v}" for k, v in data.items() if k not in skip and v is not None][:6]
    stats = []
    for k, v in data.items():
        if k in skip or v is None:
            continue
        stats.append({"label": k.replace("_", " ").title(), "value": str(v)})
        if len(stats) >= 4:
            break
    op_map = {"create": "+", "update": "→", "delete": "!"}
    changes = [{"op": op_map.get(verb, "→"), "text": _build_summary(resource, verb, data)}]
    return json.dumps({
        "module": resource.replace("-", "_"),
        "action": verb,
        "item_id": data.get("id"),
        "stats": stats,
        "changes": changes,
    })


class CarabinerWrite(Tool):
    async def execute(self, **kwargs) -> Response:
        resource = (self.args.get("resource") or "").strip().lower()
        verb = (self.args.get("verb") or "").strip().lower()
        extra_args = (self.args.get("args") or "").strip()

        if not resource:
            return Response(
                message="carabiner_write requires a 'resource' argument (e.g. orders, inventory).",
                break_loop=False,
            )
        if not verb:
            return Response(
                message="carabiner_write requires a 'verb' argument (create, update, or delete).",
                break_loop=False,
            )

        if resource not in _RESOURCES:
            return Response(
                message=f"Unknown resource '{resource}'. Valid: {', '.join(sorted(_RESOURCES))}",
                break_loop=False,
            )

        if verb not in _WRITE_VERBS:
            return Response(
                message=(
                    f"Verb '{verb}' is not a write verb. "
                    f"Use carabiner_read for list/get. "
                    f"Allowed write verbs: create, update, delete"
                ),
                break_loop=False,
            )

        # Build command — inject --json and --chat-context
        parts = ["carabiner", resource, verb]
        if extra_args:
            try:
                parts += shlex.split(extra_args)
            except ValueError:
                parts += extra_args.split()
        if "--json" not in parts:
            parts.append("--json")

        # Inject chat context ID automatically
        ctx_id = getattr(getattr(self.agent, "context", None), "id", None)
        if ctx_id and "--chat-context" not in parts:
            parts += ["--chat-context", ctx_id]

        try:
            result = subprocess.run(
                parts,
                capture_output=True,
                text=True,
                timeout=30,
            )
            output = result.stdout.strip()
            if result.returncode != 0:
                err = result.stderr.strip() or output
                return Response(message=f"carabiner error (exit {result.returncode}): {err}", break_loop=False)

            # Fire action card notification
            try:
                data = json.loads(output) if output else {}
                if isinstance(data, dict) and not data.get("error"):
                    from helpers.notification import NotificationType, NotificationPriority
                    ntype = NotificationType.WARNING if verb == "delete" else NotificationType.SUCCESS
                    nprio = NotificationPriority.HIGH if verb == "delete" else NotificationPriority.HIGH
                    AgentContext.get_notification_manager().add_notification(
                        type=ntype,
                        priority=nprio,
                        title=_build_summary(resource, verb, data),
                        message=f"{resource} {verb} completed",
                        detail=_build_detail(resource, verb, data),
                        display_time=30,
                        group=resource.replace("-", "_"),
                    )
            except Exception:
                pass  # notification failure should never block the write response

            return Response(message=output or "(no output)", break_loop=False)
        except subprocess.TimeoutExpired:
            return Response(message="carabiner_write timed out after 30s", break_loop=False)
        except FileNotFoundError:
            return Response(message="carabiner CLI not found in PATH", break_loop=False)
        except Exception as e:
            return Response(message=f"carabiner_write failed: {e}", break_loop=False)
