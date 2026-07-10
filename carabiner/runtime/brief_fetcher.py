"""Hermetic data fetcher for the daily-brief scheduler.

Produces a :class:`BriefPayload` for one location at one timestamp.
The fetch is **read-only** and uses a single async session.

Two seams make the module hermetic-testable:

* Every per-category helper takes an optional ``repo_fns`` mapping
  so tests can pass fakes without touching ``carabiner.db``.
* ``now`` is always an explicit argument (defaulting to
  ``datetime.now(timezone.utc)``) — never the wall clock — so
  threshold logic is deterministic.

Five categories (mirroring the A0-era expo proactive sweep):

* ``order_cutoff``     — draft POs due within the cutoff window
* ``prep_late``        — prep tasks not started for the next service lane
* ``inventory_low``    — items below par (with 10 % buffer)
* ``invoice_unmatched`` — invoices received but not matched to a PO
* ``food_cost``        — menu items over the food-cost ceiling

A ``repo_overrides`` dict of callables lets tests substitute the
underlying queries. Production code never passes the override.
"""

from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any, Callable, Iterable, Optional
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)


# --- Thresholds (all durations relative to ``now``) ------------------------

@dataclass(frozen=True)
class BriefThresholds:
    cutoff_window: timedelta = timedelta(days=1)
    service_lane_window: timedelta = timedelta(hours=2)
    invoice_stale_after: timedelta = timedelta(days=7)
    food_cost_pct_alert: Decimal = Decimal("33.0")
    inventory_shortfall_pct: Decimal = Decimal("0.10")


# --- Findings -------------------------------------------------------------

CATEGORIES = (
    "order_cutoff",
    "prep_late",
    "inventory_low",
    "invoice_unmatched",
    "food_cost",
)


@dataclass(frozen=True)
class BriefFinding:
    category: str
    severity: str   # "warning" | "error" | "info"
    module: str     # canonical module id
    entity_id: str
    title: str
    summary: str
    detail: str
    refs: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class BriefPayload:
    location_id: str
    location_name: str
    generated_at: datetime
    service_date: date
    thresholds: BriefThresholds
    counts: dict[str, int]
    findings: list[BriefFinding]


# --- Service lane time map (local) ---------------------------------------

_LANE_STARTS = {"Lunch": time(11, 0), "Dinner": time(17, 0)}
_LANE_ENDS = {"Lunch": time(14, 30), "Dinner": time(22, 0)}


def _active_lanes(now_local: datetime, window: timedelta) -> list[str]:
    """Return the service lanes that are within ``window`` of starting."""
    h = now_local.time()
    lanes: list[str] = []
    for name, start in _LANE_STARTS.items():
        end = _LANE_ENDS[name]
        # Convert time → minutes-since-midnight.
        start_min = start.hour * 60 + start.minute
        end_min = end.hour * 60 + end.minute
        now_min = h.hour * 60 + h.minute
        # ``now`` is within the window-before-window if it falls in
        # ``[start - window, end]`` (we're interested in lanes that
        # are either currently active or about to open).
        if (start_min - int(window.total_seconds() // 60)) <= now_min <= end_min:
            lanes.append(name)
    if not lanes:
        # Fallback: pick the closer of the two based on the current hour.
        lanes = ["Dinner" if h.hour >= time(14, 30).hour else "Lunch"]
    return lanes


# --- Per-category helpers ------------------------------------------------

def _now_utc(now: Optional[datetime]) -> datetime:
    if now is None:
        return datetime.now(timezone.utc)
    if now.tzinfo is None:
        return now.replace(tzinfo=timezone.utc)
    return now.astimezone(timezone.utc)


def _tz_for(location_id: str, tz_override: Optional[str]) -> ZoneInfo:
    if tz_override:
        return ZoneInfo(tz_override)
    fallback = os.environ.get("BRIEF_TZ", "America/Chicago")
    try:
        return ZoneInfo(fallback)
    except Exception:
        return ZoneInfo("America/Chicago")


def _to_decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value).replace("$", "").replace(",", "").strip())
    except Exception:
        return Decimal("0")


# --- The five fetchers (each callable via repo_overrides) ----------------


async def _find_order_cutoffs(
    *,
    location_id: str,
    now_local: datetime,
    thresholds: BriefThresholds,
    repo_overrides: dict[str, Callable],
) -> list[BriefFinding]:
    """Draft POs due within the cutoff window."""
    fetcher = repo_overrides.get("orders_due")
    if fetcher is None:
        # In production, defer to the operational PO repo.
        try:
            from carabiner.db import repositories as repos  # type: ignore

            rows = await repos.list_purchase_orders(
                location_id=location_id, status="draft"
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("brief_fetcher: orders_due repo failed: %s", exc)
            return []
    else:
        rows = await fetcher(location_id=location_id, now=now_local)

    findings: list[BriefFinding] = []
    today = now_local.date()
    for row in rows:
        expected = getattr(row, "expected_delivery", None)
        if expected is None:
            continue
        if isinstance(expected, datetime):
            expected_d = expected.date()
        else:
            expected_d = expected
        if expected_d > today + timedelta(days=1):
            continue
        minutes_until = max(
            0, int((expected_d - today).total_seconds() // 60)
        )
        po_id = str(getattr(row, "id", uuid.uuid4()))
        findings.append(
            BriefFinding(
                category="order_cutoff",
                severity="warning" if minutes_until > 240 else "error",
                module="orders",
                entity_id=po_id,
                title=(
                    f"PO #{getattr(row, 'po_number', po_id[:6])} cutoff "
                    f"{'today' if expected_d == today else 'tomorrow'} — still draft"
                ),
                summary=(
                    "Vendor PO has not been submitted."
                ),
                detail=(
                    f"Expected delivery {expected_d.isoformat()}; "
                    f"status=draft. Last edit metadata unavailable."
                ),
                refs={
                    "po_id": po_id,
                    "expected_delivery": expected_d.isoformat(),
                    "total": str(getattr(row, "total", "0")),
                    "minutes_until": minutes_until,
                },
            )
        )
    return findings


async def _find_prep_lateness(
    *,
    location_id: str,
    now_local: datetime,
    thresholds: BriefThresholds,
    repo_overrides: dict[str, Callable],
) -> list[BriefFinding]:
    """Prep tasks not started for the next active service lane."""
    fetcher = repo_overrides.get("prep_open")
    if fetcher is None:
        try:
            from carabiner.db import repositories as repos  # type: ignore

            rows = await repos.list_prep_lists(
                location_id=location_id, readiness="Not Started"
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("brief_fetcher: prep_open repo failed: %s", exc)
            return []
    else:
        rows = await fetcher(location_id=location_id, now=now_local)

    lanes = _active_lanes(now_local, thresholds.service_lane_window)
    findings: list[BriefFinding] = []
    for row in rows:
        lane = getattr(row, "service_lane", None)
        if lane not in lanes:
            continue
        prep_id = str(getattr(row, "id", uuid.uuid4()))
        task_name = getattr(row, "task", None) or getattr(row, "name", "Prep task")
        station = getattr(row, "station", "Unassigned")
        findings.append(
            BriefFinding(
                category="prep_late",
                severity="warning",
                module="prep",
                entity_id=prep_id,
                title=(
                    f"{task_name} — not started, {lane.lower()} approaching"
                ),
                summary=(
                    f"{lane} prep on {task_name} ({station}) hasn't been started."
                ),
                detail=(
                    f"Lane: {lane}. Station: {station}. Assign cook now."
                ),
                refs={
                    "prep_id": prep_id,
                    "service_lane": lane,
                    "station": station,
                    "task": task_name,
                },
            )
        )
    return findings


async def _find_inventory_low(
    *,
    location_id: str,
    now_local: datetime,
    thresholds: BriefThresholds,
    repo_overrides: dict[str, Callable],
) -> list[BriefFinding]:
    """Items below par (with 10 % buffer)."""
    fetcher = repo_overrides.get("inventory_low")
    if fetcher is None:
        try:
            from carabiner.db import repositories as repos  # type: ignore

            rows = await repos.list_inventory(location_id=location_id)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("brief_fetcher: inventory_low repo failed: %s", exc)
            return []
    else:
        rows = await fetcher(location_id=location_id, now=now_local)

    findings: list[BriefFinding] = []
    seen_info = False
    for row in rows:
        on_hand = _to_decimal(getattr(row, "on_hand", None))
        par = _to_decimal(getattr(row, "par", None))
        if par <= 0:
            if not seen_info:
                findings.append(
                    BriefFinding(
                        category="inventory_low",
                        severity="info",
                        module="inventory",
                        entity_id=str(getattr(row, "id", uuid.uuid4())),
                        title="Inventory row missing par value — needs count",
                        summary="One or more inventory rows have no par set.",
                        detail=(
                            "Cannot evaluate stock health without a par baseline. "
                            "Run a stock count or set par from the Inventory page."
                        ),
                        refs={"item_name": getattr(row, "item_name", "?")},
                    )
                )
                seen_info = True
            continue
        if on_hand >= par * (Decimal("1") - thresholds.inventory_shortfall_pct):
            continue
        findings.append(
            BriefFinding(
                category="inventory_low",
                severity="warning",
                module="inventory",
                entity_id=str(getattr(row, "id", uuid.uuid4())),
                title=(
                    f"{getattr(row, 'item_name', 'Item')} — "
                    f"{on_hand} on hand vs {par} par"
                ),
                summary=(
                    f"Below {int(thresholds.inventory_shortfall_pct * 100)}% of par; "
                    "today's menu may be impacted."
                ),
                detail=(
                    f"Par {par}, on hand {on_hand} "
                    f"({int((on_hand / par * 100) if par else 0)}%)."
                ),
                refs={
                    "item_name": getattr(row, "item_name", "?"),
                    "on_hand": str(on_hand),
                    "par": str(par),
                    "unit": getattr(row, "unit", ""),
                },
            )
        )
    return findings


async def _find_invoice_unmatched(
    *,
    location_id: str,
    now_local: datetime,
    thresholds: BriefThresholds,
    repo_overrides: dict[str, Callable],
) -> list[BriefFinding]:
    """Invoices received but not matched to a PO, first seen in last 14d."""
    fetcher = repo_overrides.get("invoices_unmatched")
    if fetcher is None:
        try:
            from carabiner.db import repositories as repos  # type: ignore

            rows = await repos.list_invoices(location_id=location_id)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("brief_fetcher: invoices_unmatched repo failed: %s", exc)
            return []
    else:
        rows = await fetcher(location_id=location_id, now=now_local)

    today = now_local.date()
    horizon = today - timedelta(days=14)
    findings: list[BriefFinding] = []
    for row in rows:
        match_status = getattr(row, "match_status", None) or ""
        if match_status not in {"unmatched", "partial", "exception"}:
            continue
        inv_date = getattr(row, "invoice_date", None)
        if inv_date is None:
            continue
        if isinstance(inv_date, datetime):
            inv_d = inv_date.date()
        else:
            inv_d = inv_date
        if inv_d < horizon:
            continue
        findings.append(
            BriefFinding(
                category="invoice_unmatched",
                severity=(
                    "error" if (today - inv_d) > thresholds.invoice_stale_after
                    else "warning"
                ),
                module="invoices",
                entity_id=str(getattr(row, "id", uuid.uuid4())),
                title=(
                    f"Invoice #{getattr(row, 'invoice_number', '?')} "
                    f"match_status={match_status}"
                ),
                summary=(
                    f"Imported {inv_d.isoformat()}; match_status={match_status}."
                ),
                detail=(
                    "Approve or reject from the Invoices page."
                ),
                refs={
                    "invoice_id": str(getattr(row, "id", uuid.uuid4())),
                    "total": str(getattr(row, "total", "0")),
                    "match_status": match_status,
                },
            )
        )
    return findings


async def _find_food_cost_pressure(
    *,
    location_id: str,
    now_local: datetime,
    thresholds: BriefThresholds,
    repo_overrides: dict[str, Callable],
) -> list[BriefFinding]:
    """Menu items with food-cost % above the ceiling."""
    fetcher = repo_overrides.get("food_cost_window")
    if fetcher is None:
        try:
            from carabiner.db import repositories as repos  # type: ignore

            rows = await repos.list_menu_items(location_id=location_id)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("brief_fetcher: food_cost_window repo failed: %s", exc)
            return []
    else:
        rows = await fetcher(location_id=location_id, now=now_local)

    findings: list[BriefFinding] = []
    ceiling = float(thresholds.food_cost_pct_alert)
    for row in rows:
        if getattr(row, "is_86", False):
            continue
        pct = getattr(row, "food_cost_pct", None)
        if pct is None:
            continue
        if float(pct) <= ceiling:
            continue
        item_id = str(getattr(row, "id", uuid.uuid4()))
        findings.append(
            BriefFinding(
                category="food_cost",
                severity="warning",
                module="food_cost",
                entity_id=item_id,
                title=(
                    f"{getattr(row, 'item_name', 'Menu item')} — "
                    f"{pct:.1f}% food cost (ceiling {ceiling:.0f}%)"
                ),
                summary=(
                    f"Plate cost above ceiling for "
                    f"{getattr(row, 'item_name', 'this item')}."
                ),
                detail=(
                    f"Current cost pct {pct:.1f}%. "
                    "Recheck yield or reprice."
                ),
                refs={
                    "menu_item_id": item_id,
                    "item_name": getattr(row, "item_name", "?"),
                    "food_cost_pct": float(pct),
                    "price": float(getattr(row, "price", 0) or 0),
                },
            )
        )
    return findings


# --- Public entry point --------------------------------------------------


async def gather_findings(
    *,
    location_id: str,
    location_name: str = "",
    now: Optional[datetime] = None,
    thresholds: Optional[BriefThresholds] = None,
    repo_overrides: Optional[dict[str, Callable]] = None,
    tz_override: Optional[str] = None,
) -> BriefPayload:
    """Return a :class:`BriefPayload` for one location at one timestamp."""
    t = thresholds or BriefThresholds()
    now_utc = _now_utc(now)
    tz = _tz_for(location_id, tz_override)
    now_local = now_utc.astimezone(tz)
    overrides = repo_overrides or {}

    findings: list[BriefFinding] = []
    for fetcher in (
        _find_order_cutoffs,
        _find_prep_lateness,
        _find_inventory_low,
        _find_invoice_unmatched,
        _find_food_cost_pressure,
    ):
        try:
            chunk = await fetcher(
                location_id=location_id,
                now_local=now_local,
                thresholds=t,
                repo_overrides=overrides,
            )
        except Exception as exc:  # noqa: BLE001 - per-location isolation
            logger.warning("brief_fetcher: %s failed for %s: %s",
                           fetcher.__name__, location_id, exc)
            chunk = []
        findings.extend(chunk)

    counts = {cat: 0 for cat in CATEGORIES}
    for f in findings:
        counts[f.category] = counts.get(f.category, 0) + 1

    return BriefPayload(
        location_id=location_id,
        location_name=location_name,
        generated_at=now_utc,
        service_date=now_local.date(),
        thresholds=t,
        counts=counts,
        findings=findings,
    )


__all__ = [
    "BriefThresholds",
    "BriefFinding",
    "BriefPayload",
    "CATEGORIES",
    "gather_findings",
]