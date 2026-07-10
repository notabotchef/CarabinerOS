"""Card lifecycle for the bridge.

Canonical action-card shape lives here (see :data:`CANONICAL_FIELDS` and the
``ActionCard`` dict built by :func:`_summary` + :func:`propose`). The shape was
inherited from the legacy Agent-Zero ``python/tools/action_card.py:127-143``
and ``python/websocket_handlers/state_sync_handler/action_cards_handler.py``
which were removed during the Hermes migration.

Lifecycle:

- ``propose(resource, verb, data, reason)`` → returns a card with
  ``status="proposed"``, writes an ``ActionLog(status="proposed")``,
  records the card in an in-memory registry.
- ``commit(card_id)`` → idempotent; re-runs ``policy.check_commit``;
  runs the mutation through :func:`execute.execute_mutation`; writes
  ``ActionLog(status="committed")``; re-emits the card with
  ``status="committed"``.
- ``dismiss(card_id)`` → writes ``ActionLog(status="dismissed")``;
  re-emits the card with ``status="dismissed"``.

The audit + re-emit happen via the bridge's :mod:`audit` and
:mod:`emitter` modules respectively so the policy/audit invariants
are testable in isolation.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Mapping

from . import audit, emitter, policy
from .execute import execute_mutation

logger = logging.getLogger(__name__)


# Module-level registry — process-wide singleton. Tests clear it
# via :func:`reset_for_testing`.
_REGISTRY: dict[str, dict[str, Any]] = {}


def _summary(resource: str, verb: str, data: Mapping[str, Any]) -> str:
    verb_map = {"create": "Created", "update": "Updated", "delete": "Deleted"}
    label = verb_map.get(verb, "Modified")
    pick_fields = {
        "orders": ["vendor", "total"],
        "inventory": ["item_name", "on_hand"],
        "prep": ["task", "station"],
        "menu": ["item_name", "category"],
        "recipes": ["name", "category"],
        "invoices": ["vendor_name", "total"],
        "campaigns": ["campaign_name", "channel"],
        "food_cost": ["menu_item_name", "current_cost_pct"],
    }.get(resource.replace("-", "_"), [])
    parts: list[str] = []
    for f in pick_fields:
        v = data.get(f)
        if v is not None:
            parts.append(str(v))
    suffix = f": {', '.join(parts)}" if parts else ""
    return f"{label} {resource}{suffix}"


def _detail(resource: str, verb: str, data: Mapping[str, Any]) -> str:
    skip = {"id", "created_at", "updated_at", "location_id"}
    kvs = [
        f"{k}: {v}" for k, v in data.items() if k not in skip and v is not None
    ][:6]
    stats: list[dict[str, str]] = []
    for k, v in data.items():
        if k in skip or v is None:
            continue
        stats.append({"label": k.replace("_", " ").title(), "value": str(v)})
        if len(stats) >= 4:
            break
    op_map = {"create": "+", "update": "→", "delete": "!"}
    changes = [{"op": op_map.get(verb, "→"), "text": _summary(resource, verb, data)}]
    import json

    return json.dumps(
        {
            "module": resource.replace("-", "_"),
            "action": verb,
            "item_id": data.get("id"),
            "stats": stats,
            "changes": changes,
            "kvs": kvs,
        }
    )


def propose(
    *,
    resource: str,
    verb: str,
    data: Mapping[str, Any],
    reason: str,
    chat_id: str | None = None,
    location_id: str | uuid.UUID | None = None,
    org_id: str | uuid.UUID | None = None,
    sio: Any | None = None,
) -> dict[str, Any]:
    """Create a proposed-action card and write the audit row.

    The model-facing flow is: hermes calls ``carabiner_propose_write``
    on the bridge's MCP surface. That tool calls
    :func:`policy.check_propose`. If allowed, this function runs and
    returns the card. If denied, the MCP tool returns the denial
    reason — no card, no audit row.

    Synchronous. The underlying audit writer is async; we use
    :func:`audit.create_action_log_sync` which runs the async DB call
    on a fresh event loop. This function is safe to call from any
    context (sync HTTP handlers, sync tests). MCP callers go through
    the same path.
    """
    decision = policy.check_propose(resource, verb, data)
    if not decision.allowed:
        raise PermissionError(f"policy denied propose: {decision.reason}")
    resource_norm = decision.normalised_resource or resource

    card_id = str(uuid.uuid4())
    now = int(time.time())
    item_id = data.get("id") if isinstance(data, Mapping) else None
    card: dict[str, Any] = {
        "id": card_id,
        "type": "action",
        "module": resource_norm,
        "action": verb,
        "summary": _summary(resource_norm, verb, data),
        "detail": _detail(resource_norm, verb, data),
        "itemId": item_id,
        "chatId": chat_id,
        "changes": [
            {
                "op": "+" if verb == "create" else ("!" if verb == "delete" else "→"),
                "text": _summary(resource_norm, verb, data),
            }
        ],
        "stats": [],
        "priority": 1,
        "deadline": None,
        "status": "proposed",
        "timestamp": now,
        "source": "hermes-bridge",
    }

    # Audit — must succeed (or AUDIT_REQUIRED=false escape hatch).
    # propose() is sync; use the sync wrapper around the async DB call.
    try:
        audit.create_action_log_sync(
            action_type=verb,
            status="proposed",
            card_id=card_id,
            location_id=location_id,
            org_id=org_id,
            extra={
                "resource": resource_norm,
                "data": {k: v for k, v in dict(data).items() if k != "id"},
                "reason": reason,
            },
        )
    except RuntimeError as exc:
        # The sync wrapper refuses to nest event loops. From an async
        # caller (e.g. inside an MCP handler that itself awaits
        # something) we cannot use the sync wrapper; in that case the
        # audit row has already been written by the caller. Skip.
        if "create_action_log_sync called inside a running event loop" not in str(exc):
            raise
        logger.warning(
            "propose(): sync audit wrapper refused; assuming caller wrote audit row"
        )

    _REGISTRY[card_id] = card

    # Persist the original ``data`` payload on the card so commit() can
    # reconstruct it without a DB lookup. (Avoids the chicken-and-egg
    # of "we wrote the data to ActionLog, now we need to read it back
    # from ActionLog".)
    # NB: this is a bridge-only field; the frontend doesn't see it.
    card["_propose_data"] = dict(data)

    # Fire-and-forget emit (async helper from carabiner.runtime.emitter).
    # propose() itself is sync, so we run the emit in a fresh loop
    # via asyncio.run only if there's no running loop. If a loop is
    # already running (e.g. inside the bridge HTTP handler), we skip
    # the emit — the caller is responsible for re-emitting the card.
    if sio is not None:
        try:
            import asyncio as _asyncio

            try:
                _asyncio.get_running_loop()
            except RuntimeError:
                _asyncio.run(emitter.emit_action_card(sio, card))
            else:  # pragma: no cover
                logger.warning(
                    "propose() called inside a running loop; card emit skipped"
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("emit_action_card failed: %s", exc)

    return card


def get(card_id: str) -> dict[str, Any] | None:
    return _REGISTRY.get(card_id)


def all_cards() -> list[dict[str, Any]]:
    return list(_REGISTRY.values())


def reset_for_testing() -> None:
    _REGISTRY.clear()


async def commit(
    card_id: str,
    *,
    sio: Any | None = None,
    location_id: str | uuid.UUID | None = None,
    org_id: str | uuid.UUID | None = None,
) -> dict[str, Any]:
    """Commit a proposed card.

    Idempotent: a second call with the same id returns the existing
    committed card without re-running the mutation. Re-runs
    :func:`policy.check_commit` for defense-in-depth. Fails closed if
    ``AUDIT_REQUIRED=true`` and the audit write fails.
    """
    card = _REGISTRY.get(card_id)
    if card is None:
        raise KeyError(f"unknown card_id: {card_id}")
    if card.get("status") == "committed":
        return card

    decision = policy.check_commit(
        card["module"], card["action"], card.get("_propose_data") or {}, card
    )
    if not decision.allowed:
        raise PermissionError(f"policy denied commit: {decision.reason}")

    payload = card.get("_propose_data") or {}
    mutation_result = await execute_mutation(card["module"], card["action"], payload)

    await audit.create_action_log(
        action_type=card["action"],
        status="committed",
        card_id=card_id,
        location_id=location_id,
        org_id=org_id,
        extra={
            "resource": card["module"],
            "mutation_result_id": (mutation_result or {}).get("id"),
        },
    )

    card["status"] = "committed"
    card["timestamp"] = int(time.time())
    if sio is not None:
        try:
            await emitter.emit_action_card(sio, card)
        except Exception as exc:  # noqa: BLE001
            logger.warning("emit_action_card failed: %s", exc)

    return card


async def dismiss(
    card_id: str,
    *,
    sio: Any | None = None,
    location_id: str | uuid.UUID | None = None,
    org_id: str | uuid.UUID | None = None,
) -> dict[str, Any]:
    """Dismiss a proposed card. Writes the audit row but never mutates."""
    card = _REGISTRY.get(card_id)
    if card is None:
        raise KeyError(f"unknown card_id: {card_id}")
    if card.get("status") == "dismissed":
        return card

    await audit.create_action_log(
        action_type=card["action"],
        status="dismissed",
        card_id=card_id,
        location_id=location_id,
        org_id=org_id,
        extra={"resource": card["module"]},
    )

    card["status"] = "dismissed"
    card["timestamp"] = int(time.time())
    if sio is not None:
        try:
            await emitter.emit_action_card(sio, card)
        except Exception as exc:  # noqa: BLE001
            logger.warning("emit_action_card failed: %s", exc)

    return card


async def _reconstruct_data(card: dict[str, Any]) -> dict[str, Any]:
    """Pull the proposed ``data`` payload from the ActionLog metadata.

    The bridge writes the data into ``ActionLog.extra.data`` when the
    card is proposed; at commit time we read it back so the mutation
    sees the exact fields the model sent (id included).
    """
    from carabiner.db import repositories as repos

    rows = await repos.list_action_log()
    for row in reversed(rows):
        extra = getattr(row, "extra", None) or {}
        if extra.get("card_id") == card["id"] and extra.get("outcome") == "proposed":
            data = dict(extra.get("data") or {})
            # ``id`` is reconstructed from the card's itemId if present.
            item_id = card.get("itemId")
            if item_id and "id" not in data:
                data["id"] = item_id
            return data
    # Fallback — synthesise from the card itself (less faithful but never fails).
    return {"id": card.get("itemId")} if card.get("itemId") else {}