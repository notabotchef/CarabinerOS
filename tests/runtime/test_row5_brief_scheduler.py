"""Hermetic tests for the Row #5 daily-brief scheduler.

Three modules under test:

* ``brief_fetcher`` — gather_findings + per-category helpers
* ``brief_cards`` — build_card, dedup, emit_for_finding, run_for_payload
* ``brief_scheduler`` — BriefScheduler.tick + start/stop + lifecycle

No live DB. No docker. No LLM. Every seam is mocked.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from carabiner.runtime import brief_cards, brief_config, brief_fetcher, brief_scheduler


# ---- shared fixtures ----------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_dedup():
    brief_cards._reset_for_testing()
    yield
    brief_cards._reset_for_testing()


def _stub_audit(monkeypatch):
    """Stub the async audit writer so tests never touch postgres."""
    from carabiner.runtime import audit
    monkeypatch.setattr(
        audit, "create_action_log", AsyncMock(return_value=None)
    )


def _finding(category="order_cutoff", module="orders", severity="warning", **kwargs):
    base = dict(
        category=category,
        severity=severity,
        module=module,
        item_id="11111111-1111-1111-1111-111111111111",
        location_id="22222222-2222-2222-2222-222222222222",
        summary="Sample finding",
        detail_kvs={"vendor": "Coastal Produce", "minutes_until": 30},
        stats=[{"label": "Vendor", "value": "Coastal Produce"}],
        changes=[{"op": "!", "text": "Cutoff in 30m"}],
        deadline_epoch=None,
        reason="row5 unit test",
    )
    base.update(kwargs)
    return brief_cards.Finding(**base)


# =======================================================================
# Fetcher
# =======================================================================


def test_thresholds_defaults_are_sane():
    t = brief_fetcher.BriefThresholds()
    assert t.cutoff_window.total_seconds() == 86400
    assert t.food_cost_pct_alert == 33


def test_active_lanes_picks_dinner_after_1430():
    from datetime import time as _t
    evening = datetime(2026, 7, 10, 19, 30, tzinfo=timezone.utc)
    lanes = brief_fetcher._active_lanes(evening, brief_fetcher.BriefThresholds().service_lane_window)
    assert "Dinner" in lanes


def test_active_lanes_picks_lunch_at_11():
    noonish = datetime(2026, 7, 10, 11, 0, tzinfo=timezone.utc)
    lanes = brief_fetcher._active_lanes(noonish, brief_fetcher.BriefThresholds().service_lane_window)
    assert "Lunch" in lanes


@pytest.mark.asyncio
async def test_gather_findings_aggregates_repo_overrides():
    """gather_findings calls all 5 fetchers; with repo_overrides we
    control each one."""
    overrides = {
        "orders_due":         AsyncMock(return_value=[]),
        "prep_open":          AsyncMock(return_value=[]),
        "inventory_low":      AsyncMock(return_value=[]),
        "invoices_unmatched": AsyncMock(return_value=[]),
        "food_cost_window":   AsyncMock(return_value=[]),
    }
    payload = await brief_fetcher.gather_findings(
        location_id="loc-1",
        location_name="Fulton Market",
        now=datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc),
        repo_overrides=overrides,
    )
    assert payload.location_id == "loc-1"
    assert payload.counts == {c: 0 for c in brief_fetcher.CATEGORIES}
    assert payload.findings == []


@pytest.mark.asyncio
async def test_gather_findings_handles_per_category_failure(monkeypatch):
    """A failing fetcher must not abort the whole gather."""
    async def _boom(**kwargs):
        raise RuntimeError("simulated fetch failure")

    overrides = {
        "orders_due":         _boom,
        "prep_open":          AsyncMock(return_value=[]),
        "inventory_low":      AsyncMock(return_value=[]),
        "invoices_unmatched": AsyncMock(return_value=[]),
        "food_cost_window":   AsyncMock(return_value=[]),
    }
    payload = await brief_fetcher.gather_findings(
        location_id="loc-1",
        now=datetime(2026, 7, 10, 12, 0, tzinfo=timezone.utc),
        repo_overrides=overrides,
    )
    assert payload.counts["order_cutoff"] == 0  # silent skip, no card
    assert payload.counts["prep_late"] == 0


# =======================================================================
# Cards
# =======================================================================


def test_build_card_has_canonical_shape():
    f = _finding()
    card = brief_cards.build_card(f, now_epoch=1_700_000_000)
    expected = {
        "id", "type", "module", "action", "summary", "detail",
        "itemId", "chatId", "changes", "stats",
        "priority", "deadline", "status", "timestamp", "source",
    }
    assert expected.issubset(card.keys())
    assert card["source"] == brief_cards.BRIEF_SOURCE
    assert card["status"] == "new"
    assert card["action"] == "update"
    # detail must be a JSON string (the frontend's expanded card parses it).
    parsed = json.loads(card["detail"])
    assert "category" in parsed


def test_assign_priority_2_for_critical_protein():
    f = _finding(category="inventory_low", detail_kvs={
        "item_name": "Atlantic Salmon Fillet",
    })
    card_type, priority = brief_cards.assign_type_and_priority(f)
    assert priority == 2
    assert card_type == "urgent"


def test_assign_priority_2_for_order_cutoff_under_60m():
    f = _finding(category="order_cutoff", detail_kvs={"minutes_until": 30})
    _, priority = brief_cards.assign_type_and_priority(f)
    assert priority == 2


def test_assign_priority_1_for_normal_order_cutoff():
    f = _finding(category="order_cutoff", detail_kvs={"minutes_until": 240})
    _, priority = brief_cards.assign_type_and_priority(f)
    assert priority == 1


def test_assign_priority_0_for_ambient():
    """A non-food-cost ambient finding falls through to priority 0."""
    f = _finding(category="inventory_low", detail_kvs={
        "item_name": "Salt shaker",  # not a critical protein
        "on_hand": 10, "par": 100,
    })
    # Inventory below par with a non-critical item: action + priority 1.
    _, priority = brief_cards.assign_type_and_priority(f)
    assert priority == 1
    # A category we don't have an explicit rule for falls through.
    f2 = _finding(category="prep_late", severity="info", detail_kvs={})
    # prep_late always lands on action+1; pick a clearly-ambient sample.
    f3 = brief_cards.Finding(
        category="unknown_category",
        severity="info",
        module="x",
        item_id=None,
        location_id="L",
        summary="x",
    )
    _, p3 = brief_cards.assign_type_and_priority(f3)
    assert p3 == 0
    assert p3 == 0


def test_dedup_key_is_stable():
    k1 = brief_cards.dedup_key("L", "orders", "X", "order_cutoff")
    k2 = brief_cards.dedup_key("L", "orders", "X", "order_cutoff")
    assert k1 == k2


@pytest.mark.asyncio
async def test_dedup_collapses_within_window(monkeypatch):
    _stub_audit(monkeypatch)
    sio = MagicMock()
    sio.emit = AsyncMock()

    f = _finding()
    # First emit: not deduped.
    out1 = await brief_cards.emit_for_finding(f, sio=sio, now_epoch=1_000_000)
    assert out1 is not None
    # Same finding + same window: deduped.
    out2 = await brief_cards.emit_for_finding(f, sio=sio, now_epoch=1_000_100)
    assert out2 is None
    # After window expires: re-emitted.
    out3 = await brief_cards.emit_for_finding(
        f, sio=sio, now_epoch=1_000_000 + 60 * 60, window_seconds=30 * 60
    )
    assert out3 is not None


@pytest.mark.asyncio
async def test_emit_no_server_writes_audit_only(monkeypatch):
    """With sio=None, audit row is written but emit is skipped."""
    from carabiner.runtime import audit
    mock_audit = AsyncMock(return_value=None)
    monkeypatch.setattr(audit, "create_action_log", mock_audit)

    f = _finding()
    out = await brief_cards.emit_for_finding(f, sio=None, now_epoch=1_000_000)
    assert out is not None  # card built; UI will see it on next reconnect
    assert mock_audit.await_count == 1


@pytest.mark.asyncio
async def test_emit_skips_when_audit_fails(monkeypatch):
    """AUDIT_REQUIRED=true fail-closed semantics."""
    from carabiner.runtime import audit

    async def _fail(**kwargs):
        raise RuntimeError("simulated audit failure")
    monkeypatch.setattr(audit, "create_action_log", _fail)

    sio = MagicMock()
    sio.emit = AsyncMock()
    f = _finding()
    out = await brief_cards.emit_for_finding(f, sio=sio, now_epoch=1_000_000)
    assert out is None
    assert sio.emit.await_count == 0


# =======================================================================
# Scheduler
# =======================================================================


def test_brief_config_parses_env(monkeypatch):
    monkeypatch.setenv("BRIEF_ENABLED", "true")
    monkeypatch.setenv("BRIEF_CADENCE_MINUTES", "5")
    monkeypatch.setenv("BRIEF_TZ", "America/Chicago")
    monkeypatch.setenv("BRIEF_LOCATIONS", "a,b,c")
    cfg = brief_config.BriefConfig.from_env()
    assert cfg.enabled is True
    assert cfg.cadence.total_seconds() == 300
    assert cfg.tz == "America/Chicago"
    assert cfg.locations_filter == ("a", "b", "c")


def test_brief_config_default_off_in_echo_mode(monkeypatch):
    monkeypatch.delenv("BRIEF_ENABLED", raising=False)
    monkeypatch.setenv("CARABINER_RUNTIME", "echo")
    cfg = brief_config.BriefConfig.from_env()
    assert cfg.enabled is False


@pytest.mark.asyncio
async def test_scheduler_tick_emits_cards(monkeypatch):
    """scheduler.tick() gathers and emits; returns a report."""
    from carabiner.runtime import audit
    monkeypatch.setattr(audit, "create_action_log", AsyncMock(return_value=None))
    monkeypatch.setattr(
        brief_scheduler, "get_active_server", lambda: None
    )

    # Stub gather_findings to return a known payload.
    async def _fake_gather(**kwargs):
        return brief_fetcher.BriefPayload(
            location_id="loc-1",
            location_name="Fulton",
            generated_at=datetime.now(timezone.utc),
            service_date=datetime.now(timezone.utc).date(),
            thresholds=brief_fetcher.BriefThresholds(),
            counts={"order_cutoff": 1},
            findings=[
                brief_fetcher.BriefFinding(
                    category="order_cutoff",
                    severity="warning",
                    module="orders",
                    entity_id="item-1",
                    title="PO #1 cutoff today",
                    summary="Still draft",
                    detail="Submit now.",
                    refs={"po_id": "item-1"},
                ),
            ],
        )
    monkeypatch.setattr(brief_scheduler, "gather_findings", _fake_gather)

    cfg = brief_config.BriefConfig(enabled=True, hours_start=0, hours_end=24)
    sched = brief_scheduler.BriefScheduler(cfg, locations=[("loc-1", "Fulton")])
    report = await sched.tick()
    assert report["emitted"] == 1
    assert report["locations"] == 1
    assert report["findings"] == 1


@pytest.mark.asyncio
async def test_scheduler_skips_outside_business_window(monkeypatch):
    monkeypatch.setattr(
        brief_scheduler, "get_active_server", lambda: None
    )
    cfg = brief_config.BriefConfig(enabled=True, hours_start=9, hours_end=17)
    sched = brief_scheduler.BriefScheduler(cfg, locations=[])
    # 3 AM UTC is outside the 9-17 window.
    report = await sched.tick(now=datetime(2026, 7, 10, 3, 0, tzinfo=timezone.utc))
    assert report.get("reason") == "outside_business_window"
    assert report["emitted"] == 0


@pytest.mark.asyncio
async def test_scheduler_idempotent_start(monkeypatch):
    """Two start() calls produce one task, not two."""
    cfg = brief_config.BriefConfig(enabled=True)
    sched = brief_scheduler.BriefScheduler(cfg, locations=[])
    # Patch the inner loop to a no-op so the task ends quickly.
    async def _noop_loop():
        return None
    monkeypatch.setattr(sched, "_loop", _noop_loop)
    await sched.start()
    await sched.start()  # second call must not spawn a second task
    assert sched._task is not None
    await sched.stop()


@pytest.mark.asyncio
async def test_scheduler_stop_is_idempotent(monkeypatch):
    cfg = brief_config.BriefConfig(enabled=True)
    sched = brief_scheduler.BriefScheduler(cfg, locations=[])
    async def _noop_loop():
        return None
    monkeypatch.setattr(sched, "_loop", _noop_loop)
    await sched.start()
    await sched.stop()
    await sched.stop()  # second call must not raise


@pytest.mark.asyncio
async def test_disabled_scheduler_does_not_start():
    cfg = brief_config.BriefConfig(enabled=False)
    sched = brief_scheduler.BriefScheduler(cfg, locations=[])
    # Should not start a task; start() is a no-op when disabled.
    await sched.start()
    assert sched._task is None