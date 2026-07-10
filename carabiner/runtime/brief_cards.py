"""Hermetic action-card builder for the brief scheduler.

Per the architect + card-builder MoA designs:
  * Pure ``build_card()`` returns the canonical action-card dict.
  * Deterministic card_id (sha1 of finding signature).
  * In-process LRU+TTL dedup keyed on (location_id, module, item_id, category).
  * Does NOT call ``cards.propose`` — emits via ``emitter.emit_action_card``
    and writes audit via ``audit.create_action_log`` directly.
  * ``status="new"``, ``source="scheduled-brief"``.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)

BRIEF_DEDUPMINUTES: int = int(os.environ.get("BRIEF_DEDUPMINUTES", "30"))
BRIEF_SOURCE: str = "scheduled-brief"


@dataclass(frozen=True)
class Finding:
    """One finding the scheduler wants to surface as an action card."""

    category: str
    severity: str   # "urgent" | "action" | "update" | "info"
    module: str
    item_id: Optional[str]
    location_id: str
    summary: str
    detail_kvs: dict = field(default_factory=dict)
    stats: list = field(default_factory=list)
    changes: list = field(default_factory=list)
    deadline_epoch: Optional[int] = None
    reason: str = ""


def dedup_key(location_id: str, module: str, item_id: Optional[str], category: str) -> str:
    """Stable string used as the dedup key (and the card_id)."""
    raw = f"{location_id}|{module}|{item_id or '*aggregate*'}|{category}"
    return raw  # caller can hash if they want a shorter id.


# In-process LRU+TTL. Maps dedup_key -> epoch_ts_of_last_emit.
_DEDUP: dict[str, int] = {}


def _dedup_seen(key: str, *, now: int, window_seconds: int) -> bool:
    last = _DEDUP.get(key)
    if last is None:
        return False
    if now - last >= window_seconds:
        # Expired — drop and treat as not seen.
        _DEDUP.pop(key, None)
        return False
    return True


def _dedup_mark(key: str, *, now: int) -> None:
    _DEDUP[key] = now


def _reset_for_testing() -> None:
    """Clear the dedup cache. Tests only."""
    _DEDUP.clear()


# --- Severity + priority rules -------------------------------------------

CRITICAL_KEYWORDS = (
    "salmon", "beef", "chicken", "pork", "lamb", "tuna", "halibut",
    "shrimp", "duck", "tenderloin", "ribeye", "fish",
)


def assign_type_and_priority(finding: Finding) -> tuple[str, int]:
    """Return ``(card_type, priority)`` per the MoA card-builder rule."""
    refs = finding.detail_kvs or {}
    cat = finding.category

    # Priority 2 conditions.
    if cat == "order_cutoff" and (refs.get("minutes_until") or 9999) <= 60:
        return ("urgent", 2)
    if cat == "prep_late" and finding.severity == "error":
        return ("urgent", 2)
    if cat == "inventory_low":
        item_name = str(refs.get("item_name", "")).lower()
        if any(k in item_name for k in CRITICAL_KEYWORDS):
            return ("urgent", 2)
    if cat == "food_cost" and (refs.get("food_cost_pct") or 0) >= 33 + 3:
        return ("urgent", 2)
    if cat == "invoice_unmatched" and finding.severity == "error":
        return ("urgent", 2)

    # Priority 1 conditions.
    if cat in {"order_cutoff", "prep_late"}:
        return ("action", 1)
    if cat in {"inventory_low", "invoice_unmatched"}:
        return ("action", 1)
    if cat == "food_cost":
        return ("update", 1)

    # Default (ambient).
    return ("info", 0)


# --- Card construction ---------------------------------------------------

def _hash_card_id(*parts: Any) -> str:
    raw = "|".join(str(p) for p in parts)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:32]


def build_card(finding: Finding, *, now_epoch: Optional[int] = None) -> dict[str, Any]:
    """Return the canonical action-card dict. Pure."""
    now = int(now_epoch if now_epoch is not None else time.time())
    card_type, priority = assign_type_and_priority(finding)
    card_id = _hash_card_id(
        "brief",
        finding.category,
        finding.location_id,
        finding.item_id or "*aggregate*",
        now // 3600,  # bucket by hour so old findings can re-emit the next hour
    )
    detail_payload = {
        "category": finding.category,
        "module": finding.module,
        "item_id": finding.item_id,
        **finding.detail_kvs,
        "stats": list(finding.stats),
        "changes": list(finding.changes),
        "reason": finding.reason,
        "ts": now,
    }
    return {
        "id": card_id,
        "type": card_type,
        "module": finding.module,
        "action": "update",
        "summary": finding.summary[:160],
        "detail": json.dumps(detail_payload),
        "itemId": finding.item_id,
        "chatId": None,
        "changes": list(finding.changes),
        "stats": list(finding.stats),
        "priority": priority,
        "deadline": finding.deadline_epoch,
        "status": "new",
        "timestamp": now,
        "source": BRIEF_SOURCE,
    }


# --- Emit + audit (the only side-effecting path) ------------------------

async def emit_for_finding(
    finding: Finding,
    *,
    sio: Any,
    now_epoch: Optional[int] = None,
    window_seconds: Optional[int] = None,
) -> Optional[dict[str, Any]]:
    """Build → dedup → audit → emit. Returns the card or None on dedup."""
    now = int(now_epoch if now_epoch is not None else time.time())
    window = window_seconds if window_seconds is not None else BRIEF_DEDUPMINUTES * 60
    key = dedup_key(finding.location_id, finding.module, finding.item_id, finding.category)
    if _dedup_seen(key, now=now, window_seconds=window):
        logger.debug("brief_cards: dedup hit for %s", key)
        return None

    card = build_card(finding, now_epoch=now)

    # Audit first; fail-closed if AUDIT_REQUIRED=true (mirrors mcp_surface).
    try:
        from . import audit as audit_mod

        await audit_mod.create_action_log(
            action_type=finding.category,
            status="new",
            card_id=card["id"],
            location_id=finding.location_id,
            extra={
                "category": finding.category,
                "module": finding.module,
                "item_id": finding.item_id,
                "reason": finding.reason,
                "source": BRIEF_SOURCE,
                "ts": now,
                "skipped_no_server": sio is None,
            },
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("brief_cards: audit write failed: %s", exc)
        # Don't emit if audit failed — preserves AUDIT_REQUIRED=true semantics.
        return None

    _dedup_mark(key, now=now)

    if sio is None:
        logger.info("brief_cards: no active server; card %s not emitted", card["id"])
        return card  # audit row exists; UI sees it on next reconnect.

    try:
        from . import emitter as emitter_mod

        await emitter_mod.emit_action_card(sio, card)
    except Exception as exc:  # noqa: BLE001
        logger.error("brief_cards: emit failed for %s: %s", card["id"], exc)
        return None
    return card


async def run_for_payload(
    payload: Any,
    *,
    sio: Any,
    now_epoch: Optional[int] = None,
    window_seconds: Optional[int] = None,
    max_findings: int = 20,
) -> list[dict[str, Any]]:
    """Convert a :class:`BriefPayload` into emitted cards (with dedup)."""
    out: list[dict[str, Any]] = []
    for f in payload.findings[:max_findings]:
        finding = Finding(
            category=f.category,
            severity=f.severity,
            module=f.module,
            item_id=f.entity_id,
            location_id=payload.location_id,
            summary=f.title,   # title -> summary (card summary is the headline)
            detail_kvs={k: v for k, v in f.refs.items() if k != "id"},
            stats=[],
            changes=[],
            deadline_epoch=None,
            reason=f.summary,   # summary -> reason (the human why)
        )
        card = await emit_for_finding(
            finding, sio=sio, now_epoch=now_epoch, window_seconds=window_seconds,
        )
        if card is not None:
            out.append(card)
    return out


__all__ = [
    "BRIEF_DEDUPMINUTES",
    "BRIEF_SOURCE",
    "Finding",
    "dedup_key",
    "assign_type_and_priority",
    "build_card",
    "emit_for_finding",
    "run_for_payload",
    "_reset_for_testing",
]