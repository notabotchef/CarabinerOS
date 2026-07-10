# Row #5 — Card Builder Lane (Design Only)

Scope: design `carabiner/runtime/brief_cards.py`, the action-card builder that
turns the Row #5 fetcher payload into canonical action-card dicts, deduplicates
against prior emits, and pipes them through `emitter.emit_action_card` on the
bridge. This file is **design only** — no code, no schema migrations, no
branch edits.

Canonical card shape (per `python/tools/action_card.py:127-143` and
`tests/runtime/test_row3_card_shape_and_mcp_parity.py:CANONICAL_FIELDS`):
`{id, type, module, action, summary, detail, itemId, chatId, changes[],
stats[], priority, deadline, status, timestamp, source}`.

---

## 1. Module path & public surface

**`carabiner/runtime/brief_cards.py`** — sits next to `cards.py`, `audit.py`,
`emitter.py`. Single file, no subpackage. Pure functions where possible; the
only I/O is calling `emitter.emit_action_card` and `audit.create_action_log`.

```python
BRIEF_DEDUPMINUTES: int = 30           # env-overridable, default 30
BRIEF_SOURCE: str = "scheduled-brief"  # see §8

@dataclass(frozen=True)
class Finding:
    category: str        # "orders-near-cutoff" | "prep-not-started" |
                         # "inventory-below-par" | "invoices-unmatched" |
                         # "food-cost-pressure"
    severity: str        # "urgent" | "action" | "update" | "info"
    module: str          # canonical module id (orders, prep, inventory, …)
    item_id: str         # primary key of the entity that triggered this
    location_id: str
    summary: str         # <= 80 chars, kitchen-ticket style
    detail_kvs: dict     # rich metadata → goes into the JSON `detail` string
    stats: list[dict]    # 0-4 cells (label/value)
    changes: list[dict]  # [{op, text}, …] capped at 8
    deadline_epoch: int | None
    reason: str          # human reason for the audit row

def dedup_key(location_id: str, module: str, item_id: str, category: str) -> str
def _dedup_seen(key: str) -> bool        # LRU+TTL in-process
def _dedup_mark(key: str) -> None

def assign_type_and_priority(category: str, finding: dict) -> tuple[str, int]
    # returns (card_type, priority) — see §3 + §4

def build_card(finding: Finding, *, now: int) -> dict[str, Any]
    # pure: returns the canonical dict, NO emit, NO audit

async def emit_for_finding(
    finding: Finding, *, sio, location_id=None, org_id=None
) -> dict[str, Any] | None
    # dedup → build → audit → emit. Returns the card, or None if deduped.

async def run_brief(
    payload: dict, *, sio, location_id=None, org_id=None
) -> list[dict[str, Any]]
    # entry point: takes the fetcher payload, returns the cards actually emitted.
```

`_dedup_seen`/`_dedup_mark` use a `dict[str, int]` keyed on `dedup_key()`,
mapping to the epoch ts of the last emit. Expired entries (older than
`BRIEF_DEDUPMINUTES * 60`) are evicted on `seen()` access. This is in-process
only; the scheduler runs in a single bridge process so no Redis.

---

## 2. Exact action-card dicts per category

All five below use placeholder UUIDs. `itemId` always carries the source row's
primary key so the frontend `commit`/`dismiss` can route back. `chatId` is
`None` (the brief is not a chat reply). `deadline` is epoch seconds when the
underlying row has a real deadline, otherwise `None`. `status` is `"new"` —
the bridge has never used `"proposed"` outside of `cards.propose()`; brief
cards are observational, not mutations, so they enter the lifecycle at `"new"`.

### 2.1 orders-near-cutoff
```python
{
  "id": "f1e8a7c0-1111-4111-8111-111111111111",
  "type": "urgent",
  "module": "orders",
  "action": "update",
  "summary": "PO #4821 cutoffs in 45m — Coastal Produce, $1,240",
  "detail": json.dumps({
    "category": "orders-near-cutoff",
    "module": "orders",
    "item_id": "0aa0b6e2-2222-4222-8222-222222222222",
    "vendor": "Coastal Produce",
    "total": 1240.0,
    "cutoff_at_epoch": 1752165600,
    "minutes_until_cutoff": 45,
    "line_count": 18,
    "stats": [
      {"label": "Vendor", "value": "Coastal Produce"},
      {"label": "Total", "value": "$1,240"},
      {"label": "Cutoff in", "value": "45m"},
      {"label": "Lines", "value": "18"}
    ],
    "changes": [
      {"op": "!", "text": "Cutoff in 45m — submit or it won't make tomorrow's delivery"}
    ],
    "reason": "draft PO past internal approval window with cutoff approaching",
    "ts": 1752162900
  }),
  "itemId": "0aa0b6e2-2222-4222-8222-222222222222",
  "chatId": None,
  "changes": [{"op": "!", "text": "Cutoff in 45m — submit or it won't make tomorrow's delivery"}],
  "stats": [
    {"label": "Vendor", "value": "Coastal Produce"},
    {"label": "Total", "value": "$1,240"},
    {"label": "Cutoff in", "value": "45m"},
    {"label": "Lines", "value": "18"}
  ],
  "priority": 2,
  "deadline": 1752165600,
  "status": "new",
  "timestamp": 1752162900,
  "source": "scheduled-brief"
}
```

### 2.2 prep-not-started
```python
{
  "id": "f1e8a7c0-3333-4333-8333-333333333333",
  "type": "action",
  "module": "prep",
  "action": "update",
  "summary": "Prep behind — demi-glace (4.0 lb) untouched, service in 2h",
  "detail": json.dumps({
    "category": "prep-not-started",
    "module": "prep",
    "item_id": "0bb0b6e2-4444-4444-8444-444444444444",
    "task": "demi-glace",
    "station": "sauces",
    "to_prep": 4.0,
    "unit": "lb",
    "service_start_epoch": 1752172800,
    "minutes_until_service": 120,
    "stats": [
      {"label": "Task", "value": "demi-glace"},
      {"label": "Station", "value": "sauces"},
      {"label": "To prep", "value": "4.0 lb"},
      {"label": "Service in", "value": "2h"}
    ],
    "changes": [
      {"op": "→", "text": "demi-glace: 4.0 lb unstarted, sauces station"}
    ],
    "reason": "prep task not started within service-window lead time",
    "ts": 1752162900
  }),
  "itemId": "0bb0b6e2-4444-4444-8444-444444444444",
  "chatId": None,
  "changes": [{"op": "→", "text": "demi-glace: 4.0 lb unstarted, sauces station"}],
  "stats": [
    {"label": "Task", "value": "demi-glace"},
    {"label": "Station", "value": "sauces"},
    {"label": "To prep", "value": "4.0 lb"},
    {"label": "Service in", "value": "2h"}
  ],
  "priority": 1,
  "deadline": 1752172800,
  "status": "new",
  "timestamp": 1752162900,
  "source": "scheduled-brief"
}
```

### 2.3 inventory-below-par
```python
{
  "id": "f1e8a7c0-5555-4555-8555-555555555555",
  "type": "urgent",
  "module": "inventory",
  "action": "update",
  "summary": "Salmon below par — 4.5 lb on hand, par 12 lb",
  "detail": json.dumps({
    "category": "inventory-below-par",
    "module": "inventory",
    "item_id": "0cc0b6e2-6666-4666-8666-666666666666",
    "item_name": "Atlantic Salmon Fillet",
    "on_hand": 4.5,
    "min_quantity": 12.0,
    "unit": "lb",
    "is_critical_protein": True,
    "stats": [
      {"label": "Item", "value": "Atlantic Salmon Fillet"},
      {"label": "On hand", "value": "4.5 lb"},
      {"label": "Par", "value": "12 lb"},
      {"label": "Gap", "value": "-7.5 lb"}
    ],
    "changes": [
      {"op": "!", "text": "CRITICAL — Atlantic Salmon Fillet 4.5/12 lb"}
    ],
    "reason": "critical-protein item below par, next delivery window in 18h",
    "ts": 1752162900
  }),
  "itemId": "0cc0b6e2-6666-4666-8666-666666666666",
  "chatId": None,
  "changes": [{"op": "!", "text": "CRITICAL — Atlantic Salmon Fillet 4.5/12 lb"}],
  "stats": [
    {"label": "Item", "value": "Atlantic Salmon Fillet"},
    {"label": "On hand", "value": "4.5 lb"},
    {"label": "Par", "value": "12 lb"},
    {"label": "Gap", "value": "-7.5 lb"}
  ],
  "priority": 2,
  "deadline": None,
  "status": "new",
  "timestamp": 1752162900,
  "source": "scheduled-brief"
}
```

### 2.4 invoices-unmatched
```python
{
  "id": "f1e8a7c0-7777-4777-8777-777777777777",
  "type": "action",
  "module": "invoices",
  "action": "update",
  "summary": "3 unmatched invoices — US Foods $2,180, Coastal $640, Sysco $1,005",
  "detail": json.dumps({
    "category": "invoices-unmatched",
    "module": "invoices",
    "item_id": None,
    "invoice_ids": [
      "0dd0b6e2-8888-4888-8888-888888888881",
      "0dd0b6e2-8888-4888-8888-888888888882",
      "0dd0b6e2-8888-4888-8888-888888888883"
    ],
    "vendor_totals": {"US Foods": 2180.0, "Coastal Produce": 640.0, "Sysco": 1005.0},
    "aggregate_total": 3825.0,
    "oldest_received_epoch": 1752076800,
    "stats": [
      {"label": "Count", "value": "3"},
      {"label": "Total", "value": "$3,825"},
      {"label": "Oldest", "value": "1d"},
      {"label": "Vendors", "value": "3"}
    ],
    "changes": [
      {"op": "+", "text": "Invoice to approve: US Foods ($2,180)"},
      {"op": "+", "text": "Invoice to approve: Coastal Produce ($640)"},
      {"op": "+", "text": "Invoice to approve: Sysco ($1,005)"}
    ],
    "reason": "invoices received with no matching PO; blocking AP close",
    "ts": 1752162900
  }),
  "itemId": None,           # aggregate finding — no single item
  "chatId": None,
  "changes": [
    {"op": "+", "text": "Invoice to approve: US Foods ($2,180)"},
    {"op": "+", "text": "Invoice to approve: Coastal Produce ($640)"},
    {"op": "+", "text": "Invoice to approve: Sysco ($1,005)"}
  ],
  "stats": [
    {"label": "Count", "value": "3"},
    {"label": "Total", "value": "$3,825"},
    {"label": "Oldest", "value": "1d"},
    {"label": "Vendors", "value": "3"}
  ],
  "priority": 1,
  "deadline": None,
  "status": "new",
  "timestamp": 1752162900,
  "source": "scheduled-brief"
}
```

### 2.5 food-cost-pressure
```python
{
  "id": "f1e8a7c0-9999-4999-8999-999999999999",
  "type": "urgent",
  "module": "food_cost",
  "action": "update",
  "summary": "Food cost 33.2% — +3.4 pts vs target, ribeye driving spike",
  "detail": json.dumps({
    "category": "food-cost-pressure",
    "module": "food_cost",
    "item_id": "0ee0b6e2-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "menu_item_name": "Dry-Aged Ribeye 16oz",
    "current_cost_pct": 44.8,
    "target_cost_pct": 30.0,
    "revenue_today": 8450.0,
    "theoretical_cost_today": 2805.0,
    "stats": [
      {"label": "Item", "value": "Dry-Aged Ribeye 16oz"},
      {"label": "Cost %", "value": "44.8%"},
      {"label": "Target", "value": "30.0%"},
      {"label": "Revenue", "value": "$8,450"}
    ],
    "changes": [
      {"op": "!", "text": "Dry-Aged Ribeye 16oz cost 44.8% (target 30%)"}
    ],
    "reason": "menu item cost-percentage exceeds target by >3 pts for 3 consecutive days",
    "ts": 1752162900
  }),
  "itemId": "0ee0b6e2-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "chatId": None,
  "changes": [{"op": "!", "text": "Dry-Aged Ribeye 16oz cost 44.8% (target 30%)"}],
  "stats": [
    {"label": "Item", "value": "Dry-Aged Ribeye 16oz"},
    {"label": "Cost %", "value": "44.8%"},
    {"label": "Target", "value": "30.0%"},
    {"label": "Revenue", "value": "$8,450"}
  ],
  "priority": 2,
  "deadline": None,
  "status": "new",
  "timestamp": 1752162900,
  "source": "scheduled-brief"
}
```

---

## 3. Priority decision table

Priority is an int in `{0, 1, 2}` (validated in the frontend
`ActionCard["priority"]: 0 | 1 | 2`).

| Condition (any row true) | priority |
|---|---|
| Deadline within 60m and category ∈ {orders-near-cutoff, prep-not-started} | **2** |
| Critical-protein below par (salmon/beef/chicken/pork/lamb/tuna/halibut/shrimp/duck/tenderloin/ribeye/fish substring match, same keyword set as `python/tools/daily_brief_tool.py:_CRITICAL_KEYWORDS`) | **2** |
| Food-cost % exceeds target by ≥ 3 points for ≥ 3 consecutive days | **2** |
| ≥ 3 unmatched invoices | **2** |
| Order cutoff within 4h, OR prep not started with service in ≤ 2h | **1** |
| Single inventory item below par (non-critical), OR 1-2 unmatched invoices, OR food-cost % +1-3 pts over target | **1** |
| Anything else (info-only, ambient context) | **0** |

`assign_type_and_priority()` applies the first matching row top-to-bottom.
Default priority if no row matches is `0`.

---

## 4. Severity → `card.type` mapping

Frontend `ActionCardType = "urgent" | "action" | "update" | "info"`.

| Source severity | `card.type` | When |
|---|---|---|
| Deadline today, blocks service, or critical-protein below par | `"urgent"` | priority == 2 AND category in {orders-near-cutoff, prep-not-started, inventory-below-par (critical), food-cost-pressure} |
| Operator action expected (approve, place order, escalate) but not blocking | `"action"` | priority == 1 AND category in {invoices-unmatched, prep-not-started (non-blocking), inventory-below-par (non-critical)} |
| State changed, no action expected | `"update"` | priority == 1 AND category in {food-cost-pressure (within target band)} |
| Ambient context only | `"info"` | priority == 0 |

The mapping is independent of the priority integer; the priority integer is
what drives sort order in the panel and the red border in the frontend
(`action-card.tsx` checks `priority === 2`). The `type` field drives the icon
glyph.

---

## 5. Dedup

```python
import hashlib

def dedup_key(location_id: str, module: str, item_id: str | None, category: str) -> str:
    # For aggregate findings (item_id is None — e.g. invoices-unmatched), we
    # include a category-only bucket by using a stable sentinel.
    raw = f"{location_id}|{module}|{item_id or '*aggregate*'}|{category}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()
```

A single in-process `dict[str, int]` maps `dedup_key → last_emit_epoch`.
`_dedup_seen(k)` returns `True` and skips emit if
`now - _dedup[k] < BRIEF_DEDUPMINUTES * 60`. After emit, `_dedup_mark(k)`
stores the new ts. Eviction is lazy (on access) — entries older than the
window are dropped on the next `seen()` call.

Why SHA1, not uuid5? SHA1 of the canonical string is reproducible across
process restarts, so even if the bridge restarts mid-window we can re-hydrate
from a `dedup` table later if needed (out of scope for this row). UUID5
would also work but SHA1 is what the bridge's audit-log domain
(`carabiner/domain/connectors.py`) already uses for content-hash ids.

`BRIEF_DEDUPMINUTES` defaults to **30** and is env-overridable. 30 is the
shortest window that still suppresses redundant noise on a 5-minute cron tick
without suppressing a real change in state.

---

## 6. detail / stats / changes shapes

These are the three fields the frontend's expanded card (`action-card-expanded.tsx`)
renders. `detail` is a **JSON string** (per the canonical shape, see
`tests/runtime/test_row3_card_shape_and_mcp_parity.py:test_action_card_detail_is_valid_json`).
`stats` and `changes` are lists of dicts validated by `_validate_stats` /
`_validate_changes` in `python/tools/action_card.py:35-58`.

For each category, the inner JSON inside `detail` carries:

- `category` — same string as `dedup_key`
- `module`, `item_id` (or `invoice_ids: [...]` for aggregates)
- 4-6 **kvs** the chef cares about, **typed** (numbers stay numbers, not strings,
  so `Math.abs(33.2 - 30)` works on the frontend if anyone wires a gauge)
- `stats` (mirrored) and `changes` (mirrored) — the same arrays that appear at
  the top level, so a future `RichCardPayload` consumer can read detail alone
- `reason` — human string, mirrored into ActionLog.extra
- `ts` — epoch seconds

`stats` (top-level) follows the `{"label": str, "value": str}` shape exactly;
`changes` follows `{"op": "+"|"!"|"→", "text": str}`. `op="!"` reserved for
critical/urgent, `op="+"` for additions (invoices, new POs), `op="→"` for
state-change narrative. Max 8 changes; ordering within a card is
`!` first, then `+`, then `→`, matching the legacy
`python/tools/daily_brief_tool.py:136-169` ordering convention.

The `detail` JSON format mirrors the legacy expo format
(`python/tools/daily_brief_tool.py:218-235` keys — `module`, `action`, `itemId`,
`changes`, `stats`) and the audit-metadata shape (`audit.build_metadata`
returns `{intent, outcome, card_id, changes, source, ts, ...}`). Operators
reading logs and operators reading cards see the same vocabulary.

---

## 7. Connection to existing `cards.propose` / `emit_action_card`

**Don't call `cards.propose()`.** Call `emitter.emit_action_card` directly.

Why:
1. `cards.propose()` runs `policy.check_propose()` which **requires a
   `location_id` on `data` for `verb="create"`** and is gated to mutating
   verbs (`create | update | delete`). A brief finding is observational — it
   does not mutate state, it surfaces a status. Routing it through `propose`
   would force a synthetic mutation verb that doesn't exist
   (`"review"`/`"alert"` are NOT in the frontend `ActionCard.action` type
   union — only the legacy A0 tool accepted them).
2. `cards.propose()` writes `ActionLog(status="proposed")` with a "mutation
   pending" framing. Brief findings are already in their final state when
   emitted; writing `status="proposed"` would pollute the audit trail with
   entries that will never transition to `committed` or `dismissed`.
3. `cards.propose()` records the card in its in-memory `_REGISTRY` so a later
   `commit(card_id)` can look up `_propose_data`. Brief cards have no
   follow-up mutation to commit; registering them would be dead state.

What we DO call:
- `emitter.emit_action_card(sio, card, correlation_id=run_id)` for the
  Socket.IO envelope — same as `cards.propose()` does internally on success.
- `audit.create_action_log(action_type=category, status="new",
  card_id=card["id"], extra=metadata)` directly. The `action_type` is the
  category string (`"inventory-below-par"`); `status="new"` matches the
  frontend `ActionCardStatus` union and the audit `outcome` field. Source
  field inside `extra` is `"scheduled-brief"`.
- This pattern is the same one `mcp_surface.py:227-240` uses to write the
  audit row from inside an async caller: call `audit.create_action_log`
  directly with the right `status` and skip the `_REGISTRY`/`propose`
  machinery entirely.

`status="new"` is critical: the frontend
`use-action-cards.ts` hook uses it to decide whether to animate-in the card.

---

## 8. `source` field

**`source = "scheduled-brief"`.** Not `"expo-proactive"`, not `"proactive"`,
not `"reactive"`.

Why:
- The frontend `ActionCard["source"]` is the strict union
  `"reactive" | "proactive"` (`frontend/src/lib/types.ts:135`). A new value
  would be a type error. We must pick one of those two OR widen the union.
- `"proactive"` is the legacy A0 semantic for "the model surfaced this
  without being asked, in response to system context". That's accurate but
  too generic — the operator wants to distinguish *which* proactive system
  emitted the card (daily brief vs ad-hoc watcher vs Slack monitor).
- **Widen the union to `source: "reactive" | "proactive" | "scheduled-brief"`
  in `frontend/src/lib/types.ts`** as part of this row's frontend-side
  changes. This is the smallest, most honest change: the legacy enum stays
  valid, and brief cards identify themselves unambiguously. The frontend
  `notification-panel.tsx` already routes on `source` for badge labels;
  adding a third case is a one-line conditional.

---

## 9. Hermetic test sketch (no live DB)

File: `tests/runtime/test_row5_brief_cards.py`. Mocks the fetcher and the
Socket.IO server. No `await repos.*`, no `asyncio.run` against a real session.

```python
"""Hermetic tests for carabiner.runtime.brief_cards."""
from __future__ import annotations
import json
import pytest
from unittest.mock import AsyncMock, patch

from carabiner.runtime import brief_cards as bc


@pytest.fixture(autouse=True)
def _reset_dedup():
    bc._DEDUP.clear()
    yield
    bc._DEDUP.clear()


FAKE_PAYLOAD = {
    "location_id": "loc-1111",
    "findings": [
        # orders-near-cutoff
        {"category": "orders-near-cutoff", "module": "orders",
         "item_id": "item-a", "vendor": "Coastal Produce", "total": 1240.0,
         "cutoff_at_epoch": 9999999999, "minutes_until_cutoff": 45,
         "line_count": 18, "deadline_epoch": 9999999999,
         "summary": "PO cutoffs in 45m — Coastal Produce, $1,240",
         "stats": [...], "changes": [...]},
        # inventory-below-par (critical)
        {"category": "inventory-below-par", "module": "inventory",
         "item_id": "item-b", "item_name": "Atlantic Salmon",
         "on_hand": 4.5, "min_quantity": 12.0, "unit": "lb",
         "is_critical_protein": True, "deadline_epoch": None, ...},
        # invoices-unmatched aggregate
        {"category": "invoices-unmatched", "module": "invoices",
         "item_id": None, "invoice_ids": [...], ...},
        # food-cost-pressure
        {"category": "food-cost-pressure", "module": "food_cost",
         "item_id": "item-d", "current_cost_pct": 44.8, ...},
    ],
}


async def test_run_brief_emits_one_card_per_finding():
    fake_sio = AsyncMock()
    with patch("carabiner.runtime.brief_cards.audit.create_action_log",
               new=AsyncMock(return_value=None)), \
         patch("carabiner.runtime.brief_cards.emitter.emit_action_card",
               new=AsyncMock(return_value="evt-1")) as emit:
        cards = await bc.run_brief(FAKE_PAYLOAD, sio=fake_sio,
                                   location_id="loc-1111")
    assert len(cards) == 4
    assert emit.await_count == 4
    for c in cards:
        assert set(c.keys()) >= bc.CANONICAL_FIELDS
        assert c["source"] == "scheduled-brief"
        assert c["status"] == "new"
        # detail must be a valid JSON string
        json.loads(c["detail"])


async def test_run_brief_dedups_within_window():
    fake_sio = AsyncMock()
    with patch("carabiner.runtime.brief_cards.audit.create_action_log",
               new=AsyncMock()), \
         patch("carabiner.runtime.brief_cards.emitter.emit_action_card",
               new=AsyncMock()) as emit:
        first  = await bc.run_brief(FAKE_PAYLOAD, sio=fake_sio,
                                    location_id="loc-1111")
        second = await bc.run_brief(FAKE_PAYLOAD, sio=fake_sio,
                                    location_id="loc-1111")
    assert len(first) == 4
    assert second == []                # all deduped
    assert emit.await_count == 4       # no second emit


async def test_dedup_key_is_stable_and_canonical():
    k1 = bc.dedup_key("loc-1", "orders", "item-a", "orders-near-cutoff")
    k2 = bc.dedup_key("loc-1", "orders", "item-a", "orders-near-cutoff")
    k3 = bc.dedup_key("loc-1", "orders", "item-b", "orders-near-cutoff")
    assert k1 == k2
    assert k1 != k3
    assert len(k1) == 40               # sha1 hex


def test_assign_type_and_priority_critical_protein():
    t, p = bc.assign_type_and_priority("inventory-below-par",
        {"is_critical_protein": True})
    assert t == "urgent"
    assert p == 2


def test_assign_type_and_priority_cutoff_60m():
    t, p = bc.assign_type_and_priority("orders-near-cutoff",
        {"minutes_until_cutoff": 45})
    assert t == "urgent"
    assert p == 2


def test_assign_type_and_priority_aggregate_invoices_3():
    t, p = bc.assign_type_and_priority("invoices-unmatched",
        {"count": 3})
    assert p == 2


def test_build_card_shape_matches_canonical():
    f = bc.Finding(category="orders-near-cutoff", severity="urgent",
                   module="orders", item_id="x", location_id="l",
                   summary="s", detail_kvs={}, stats=[],
                   changes=[], deadline_epoch=None, reason="r")
    card = bc.build_card(f, now=1)
    assert set(card.keys()) >= bc.CANONICAL_FIELDS
    assert card["timestamp"] == 1
    assert card["status"] == "new"
    assert card["source"] == "scheduled-brief"


async def test_emit_for_finding_skips_when_dedup_hit(monkeypatch):
    monkeypatch.setattr(bc, "_DEDUP",
                        {bc.dedup_key("l", "orders", "x", "orders-near-cutoff"): 1})
    f = bc.Finding(category="orders-near-cutoff", severity="urgent",
                   module="orders", item_id="x", location_id="l",
                   summary="s", detail_kvs={}, stats=[],
                   changes=[], deadline_epoch=None, reason="r")
    with patch("carabiner.runtime.brief_cards.emitter.emit_action_card",
               new=AsyncMock()) as emit:
        result = await bc.emit_for_finding(f, sio=AsyncMock())
    assert result is None
    assert emit.await_count == 0
```

The hermetic property holds because:
- `audit.create_action_log` is patched to `AsyncMock()` — no SQLAlchemy session.
- `emitter.emit_action_card` is patched — no `python-socketio` ASGI server.
- `_DEDUP` is reset between tests via the autouse fixture.
- No `time.time()` reads inside the tested code paths; `now` is an injected
  parameter on `build_card` so timestamp determinism is test-controlled.

Total: 8 tests, < 120 LOC, no Docker, no live stack, no LLM.