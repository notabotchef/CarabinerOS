"""DailyBriefTool — emits a live, data-driven Daily Brief action card.

This tool is invoked by Agent Zero when the user asks for a daily brief, today's
operational summary, or "what's happening today". It queries Postgres via the
existing carabiner repositories and emits a single ``info``/``urgent`` action
card to the frontend via Socket.IO.

Pure-python module (no ``helpers.tool`` import) so it can be exercised in tests
without dragging the full Agent Zero runtime in. The thin shim at
``tools/daily_brief_tool.py`` re-exports ``DailyBriefTool`` so the agent's
file-based tool discovery (``agent.py:get_tool``) can find it by filename.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from datetime import date
from typing import Any

__all__ = ["DailyBriefTool", "Response", "build_brief_card"]


# ---------------------------------------------------------------------------
# Pure-Python Response (mirrors python/tools/action_card.py)
# ---------------------------------------------------------------------------

@dataclass
class Response:
    message: str = ""
    break_loop: bool = False


# ---------------------------------------------------------------------------
# Heuristics
# ---------------------------------------------------------------------------

# Item names that count as "critical" / protein when below par → bumps the card
# to urgent priority. Match is case-insensitive substring.
_CRITICAL_KEYWORDS = (
    "salmon",
    "beef",
    "chicken",
    "pork",
    "lamb",
    "tuna",
    "halibut",
    "shrimp",
    "duck",
    "tenderloin",
    "ribeye",
    "fish",
)

_PENDING_ORDER_STATUSES = ("awaiting", "pending", "draft", "drafting")
_MAX_CHANGES = 8


def _is_critical(name: str | None) -> bool:
    if not name:
        return False
    lowered = name.lower()
    return any(k in lowered for k in _CRITICAL_KEYWORDS)


def _format_currency(amount: float | None) -> str:
    if amount is None:
        return "—"
    return f"${amount:,.0f}"


def _format_pct(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value:.1f}%"


def _format_date(d: date) -> str:
    return d.strftime("%A, %B %-d") if hasattr(d, "strftime") else str(d)


# ---------------------------------------------------------------------------
# Card builder (pure function, easy to test)
# ---------------------------------------------------------------------------

def build_brief_card(
    *,
    location_name: str | None,
    today: date,
    pending_orders: list[Any],
    pending_invoices: list[Any],
    incomplete_prep: list[Any],
    par_shortfalls: list[dict],
    pl_row: dict | None,
) -> dict:
    """Aggregate raw repository data into an ActionCard payload dict.

    All inputs are plain sequences/dicts so the function is trivially unit-
    testable without touching the database.
    """

    # ---- Critical / urgent classification -----------------------------------
    critical_shortfalls = [
        row for row in par_shortfalls if _is_critical(row.get("item_name"))
    ]
    is_urgent = bool(critical_shortfalls) or len(pending_invoices) >= 3
    card_type = "urgent" if is_urgent else "info"
    priority = 2 if is_urgent else 1

    # ---- Stats (always 4 cells) ---------------------------------------------
    if pl_row:
        food_cost_value = _format_pct(pl_row.get("food_cost_pct"))
        revenue_value = _format_currency(pl_row.get("revenue"))
    else:
        food_cost_value = "—"
        revenue_value = "—"

    stats = [
        {"label": "Food Cost", "value": food_cost_value},
        {"label": "Revenue Today", "value": revenue_value},
        {"label": "Orders Pending", "value": str(len(pending_orders))},
        {"label": "Invoices Pending", "value": str(len(pending_invoices))},
    ]

    # ---- Changes (attention items, prioritized: ! > + > →) -----------------
    bang_changes: list[dict] = []
    plus_changes: list[dict] = []
    arrow_changes: list[dict] = []

    for row in par_shortfalls:
        name = row.get("item_name") or "item"
        on_hand = row.get("on_hand") or "0"
        par = row.get("min_quantity")
        prefix = "Below par" if not _is_critical(name) else "CRITICAL — below par"
        bang_changes.append({
            "op": "!",
            "text": f"{prefix}: {name} ({on_hand} on hand, par {par})",
        })

    for inv in pending_invoices:
        vendor = getattr(inv, "vendor_name", None) or "vendor"
        total = getattr(inv, "total", None) or ""
        suffix = f" — {total}" if total else ""
        plus_changes.append({
            "op": "+",
            "text": f"Invoice to approve: {vendor}{suffix}",
        })

    for item in incomplete_prep:
        name = getattr(item, "name", None) or "prep item"
        to_prep = getattr(item, "to_prep", None)
        suffix = f" ({to_prep} {getattr(item, 'unit', '')})" if to_prep else ""
        arrow_changes.append({
            "op": "\u2192",
            "text": f"Prep incomplete: {name}{suffix}".rstrip(),
        })

    changes = (bang_changes + plus_changes + arrow_changes)[:_MAX_CHANGES]

    # ---- No-data branch -----------------------------------------------------
    no_data = (
        not pending_orders
        and not pending_invoices
        and not incomplete_prep
        and not par_shortfalls
        and pl_row is None
    )

    if no_data:
        changes = [{"op": "\u2192", "text": "Nothing urgent right now."}]
        actions = [
            {"label": "View P&L", "type": "secondary", "href": "/reporting"},
        ]
    else:
        actions = [
            {"label": "Review invoices", "type": "primary", "href": "/invoices"},
            {"label": "Place orders", "type": "secondary", "href": "/orders"},
            {"label": "View P&L", "type": "secondary", "href": "/reporting"},
        ]
        if is_urgent:
            actions.append(
                {"label": "Emergency reorder", "type": "danger"}
            )

    # ---- Detail narrative ---------------------------------------------------
    narrative_bits: list[str] = []
    if pl_row and pl_row.get("food_cost_pct") is not None:
        narrative_bits.append(f"Food cost tracking {food_cost_value}")
    if pending_orders:
        narrative_bits.append(f"{len(pending_orders)} orders awaiting approval")
    if pending_invoices:
        narrative_bits.append(f"{len(pending_invoices)} invoices to approve")
    if par_shortfalls:
        narrative_bits.append(f"{len(par_shortfalls)} items below par")
    if incomplete_prep:
        narrative_bits.append(f"{len(incomplete_prep)} prep tasks open")

    if narrative_bits:
        detail = ". ".join(narrative_bits) + "."
    else:
        detail = "All clear. No urgent attention items right now."

    # ---- Summary line -------------------------------------------------------
    loc_suffix = f" — {location_name}" if location_name else ""
    summary = f"Daily Brief — {_format_date(today)}{loc_suffix}"

    return {
        "id": str(uuid.uuid4()),
        "type": card_type,
        "module": "briefing",
        "action": "review",
        "summary": summary,
        "detail": detail,
        "itemId": None,
        "changes": changes,
        "stats": stats,
        "actions": actions,
        "priority": priority,
        "deadline": None,
        "status": "new",
        "timestamp": int(time.time()),
        "source": "reactive",
        "suggestedChips": ["Approve all invoices", "What's critical?", "Dismiss"],
    }


# ---------------------------------------------------------------------------
# Data gathering (lazy imports so tests can stub the module)
# ---------------------------------------------------------------------------

async def _resolve_location(location_id_arg: Any) -> tuple[Any, str | None]:
    """Resolve a location_id arg (or pick the first available location).

    Returns (location_id, location_name). Raises ValueError if no location
    can be resolved.
    """
    from carabiner.db.repositories import list_locations

    if location_id_arg:
        try:
            loc_uuid = (
                location_id_arg
                if isinstance(location_id_arg, uuid.UUID)
                else uuid.UUID(str(location_id_arg))
            )
        except (ValueError, AttributeError) as exc:
            raise ValueError(f"Invalid location_id: {location_id_arg!r}") from exc

        rows = await list_locations()
        for row in rows:
            if row.id == loc_uuid:
                return loc_uuid, getattr(row, "name", None)
        # Caller passed an unknown id — fall through to default.

    rows = await list_locations()
    if not rows:
        raise ValueError("No locations found in database")
    first = rows[0]
    return first.id, getattr(first, "name", None)


async def _gather_brief_data(location_id: Any) -> dict:
    """Query all repositories needed for the daily brief."""
    from carabiner.db.repositories import (
        list_orders,
        list_invoices,
        list_par_levels,
    )
    from carabiner.db.prep_repositories import get_prep_list_today

    orders = await list_orders(location_id)
    pending_orders = [
        o for o in orders
        if any(
            kw in (getattr(o, "status", "") or "").lower()
            for kw in _PENDING_ORDER_STATUSES
        )
    ]

    invoices = await list_invoices(location_id)
    pending_invoices = [
        inv for inv in invoices
        if getattr(inv, "approved_at", None) is None
    ]

    prep_list = await get_prep_list_today(location_id)
    incomplete_prep: list[Any] = []
    if prep_list is not None:
        incomplete_prep = [
            item for item in getattr(prep_list, "items", []) or []
            if not getattr(item, "is_complete", False)
        ]

    par_rows = await list_par_levels(location_id)
    # shortfall = on_hand - min_quantity (negative => below par)
    par_shortfalls = [r for r in par_rows if (r.get("shortfall") or 0) < 0]

    pl_row = await _fetch_today_pl(location_id)

    return {
        "pending_orders": pending_orders,
        "pending_invoices": pending_invoices,
        "incomplete_prep": incomplete_prep,
        "par_shortfalls": par_shortfalls,
        "pl_row": pl_row,
    }


async def _fetch_today_pl(location_id: Any) -> dict | None:
    """Fetch today's DailyPL row directly via the same helper used by the
    reporting API. Returns None if no row exists for today."""
    from carabiner.api.reporting import _fetch_pl_rows

    today = date.today()
    rows = await _fetch_pl_rows(location_id, today, today)
    if not rows:
        return None
    return rows[0]


# ---------------------------------------------------------------------------
# Tool class — discovered by agent.py:get_tool via filename
# ---------------------------------------------------------------------------

class DailyBriefTool:
    """Agent Zero tool: emits a live Daily Brief action card."""

    def __init__(self, agent, name, method, args, message, loop_data, **kwargs):
        self.agent = agent
        self.name = name
        self.method = method
        self.args = args or {}
        self.message = message
        self.loop_data = loop_data

    async def before_execution(self, **kwargs):
        # No-op; the real Tool base class logs the call. Kept for interface
        # compatibility with agent.py's tool invocation pipeline.
        return None

    async def after_execution(self, response, **kwargs):
        return None

    async def execute(self, **kwargs) -> Response:
        location_arg = self.args.get("location_id") or kwargs.get("location_id")

        try:
            location_id, location_name = await _resolve_location(location_arg)
        except Exception as exc:
            return Response(
                message=f"Daily brief failed: could not resolve location ({exc}).",
                break_loop=False,
            )

        try:
            data = await _gather_brief_data(location_id)
        except Exception as exc:
            return Response(
                message=f"Daily brief failed: data query error ({exc}).",
                break_loop=False,
            )

        card = build_brief_card(
            location_name=location_name,
            today=date.today(),
            pending_orders=data["pending_orders"],
            pending_invoices=data["pending_invoices"],
            incomplete_prep=data["incomplete_prep"],
            par_shortfalls=data["par_shortfalls"],
            pl_row=data["pl_row"],
        )

        # ---- Emit via send_data ---------------------------------------------
        # send_data() defaults to namespace "/ws", which matches the frontend
        # connection in frontend/src/lib/socket-client.ts (io("/ws", ...)).
        # This is the same path notify_user.py uses and is the canonical
        # action_card delivery mechanism. Do NOT mimic python/tools/action_card.py's
        # /state_sync namespace — it's a latent bug, no frontend listens there.
        try:
            from helpers.ws_manager import send_data  # type: ignore
        except Exception as exc:
            return Response(
                message=(
                    "Daily brief built but ws_manager is not available; "
                    f"card was not emitted ({exc})."
                ),
                break_loop=False,
            )

        try:
            await send_data("action_card", {"card": card})
        except Exception as exc:
            return Response(
                message=f"Daily brief emit failed: {exc}",
                break_loop=False,
            )

        attention_count = len(card.get("changes", []))
        loc_label = location_name or "default location"
        return Response(
            message=(
                f"Daily brief emitted for {loc_label}. "
                f"{attention_count} attention item(s)."
            ),
            break_loop=False,
        )
