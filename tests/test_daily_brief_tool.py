"""Tests for the DailyBriefTool — live Daily Brief action card emitter."""

from __future__ import annotations

import sys
import uuid
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Shared fixture: inject a fake helpers.ws_manager with an AsyncMock send_data
# so the tool's `from helpers.ws_manager import send_data` succeeds in tests
# without pulling in the full Agent Zero runtime.
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_send_data():
    fake_module = ModuleType("helpers.ws_manager")
    send_data_mock = AsyncMock()
    fake_module.send_data = send_data_mock  # type: ignore[attr-defined]

    original_ws = sys.modules.get("helpers.ws_manager")
    original_helpers = sys.modules.get("helpers")

    if "helpers" not in sys.modules:
        sys.modules["helpers"] = ModuleType("helpers")
    sys.modules["helpers.ws_manager"] = fake_module

    try:
        yield send_data_mock
    finally:
        if original_ws is not None:
            sys.modules["helpers.ws_manager"] = original_ws
        else:
            sys.modules.pop("helpers.ws_manager", None)
        if original_helpers is None:
            sys.modules.pop("helpers", None)

# Project root on sys.path is already handled by tests/conftest.py.
ENGINE_DIR = Path(__file__).resolve().parent.parent
if str(ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(ENGINE_DIR))

from python.tools.daily_brief_tool import (  # noqa: E402
    DailyBriefTool,
    Response,
    build_brief_card,
)


# ---------------------------------------------------------------------------
# Lightweight stand-ins for ORM rows
# ---------------------------------------------------------------------------

@dataclass
class _StubOrder:
    status: str
    vendor: str = "Test Vendor"


@dataclass
class _StubInvoice:
    vendor_name: str
    total: str | None = None
    approved_at: object | None = None


@dataclass
class _StubPrepItem:
    name: str
    to_prep: str = "5"
    unit: str = "lb"
    is_complete: bool = False


@dataclass
class _StubPrepList:
    items: list


@dataclass
class _StubLocation:
    id: uuid.UUID
    name: str = "Carabiner Test Kitchen"


# ---------------------------------------------------------------------------
# build_brief_card — pure-function tests
# ---------------------------------------------------------------------------

def _empty_card_inputs(**overrides):
    base = dict(
        location_name="Carabiner Test Kitchen",
        today=date(2026, 4, 9),
        pending_orders=[],
        pending_invoices=[],
        incomplete_prep=[],
        par_shortfalls=[],
        pl_row=None,
    )
    base.update(overrides)
    return base


def test_build_brief_card_no_data_branch():
    card = build_brief_card(**_empty_card_inputs())

    assert card["module"] == "briefing"
    assert card["action"] == "review"
    assert card["type"] == "info"
    assert card["priority"] == 1
    assert card["status"] == "new"
    assert card["source"] == "reactive"
    assert isinstance(card["timestamp"], int)

    # Stats are always 4 cells, with em-dashes for missing P&L
    assert len(card["stats"]) == 4
    labels = [s["label"] for s in card["stats"]]
    assert labels == ["Food Cost", "Revenue Today", "Orders Pending", "Invoices Pending"]
    assert card["stats"][0]["value"] == "—"
    assert card["stats"][1]["value"] == "—"
    assert card["stats"][2]["value"] == "0"
    assert card["stats"][3]["value"] == "0"

    # No-data branch: friendly arrow message + only "View P&L" button
    assert len(card["changes"]) == 1
    assert card["changes"][0]["op"] == "\u2192"
    assert "Nothing urgent" in card["changes"][0]["text"]

    assert len(card["actions"]) == 1
    only_action = card["actions"][0]
    assert only_action["label"] == "View P&L"
    assert only_action["href"] == "/reporting"


def test_build_brief_card_populated_normal():
    pl = {
        "food_cost_pct": 28.4,
        "revenue": 4210.0,
    }
    pending_orders = [_StubOrder(status="awaiting"), _StubOrder(status="Pending")]
    pending_invoices = [_StubInvoice(vendor_name="Sysco", total="$812.50")]
    incomplete_prep = [
        _StubPrepItem(name="Béarnaise", to_prep="11", unit="qt"),
        _StubPrepItem(name="Bread mise", to_prep="3", unit="ea"),
    ]
    par_shortfalls = [
        {"item_name": "Heavy Cream", "on_hand": "1 qt", "min_quantity": 6, "shortfall": -5},
    ]

    card = build_brief_card(**_empty_card_inputs(
        pending_orders=pending_orders,
        pending_invoices=pending_invoices,
        incomplete_prep=incomplete_prep,
        par_shortfalls=par_shortfalls,
        pl_row=pl,
    ))

    # Normal info card (no critical shortfall, < 3 invoices)
    assert card["type"] == "info"
    assert card["priority"] == 1

    # Stats reflect live data
    stats = {s["label"]: s["value"] for s in card["stats"]}
    assert stats["Food Cost"] == "28.4%"
    assert stats["Revenue Today"] == "$4,210"
    assert stats["Orders Pending"] == "2"
    assert stats["Invoices Pending"] == "1"

    # >=1 change entry (par + invoice + prep — at least one of each kind)
    ops = [c["op"] for c in card["changes"]]
    assert "!" in ops
    assert "+" in ops
    assert "\u2192" in ops
    assert len(card["changes"]) >= 3
    assert len(card["changes"]) <= 8

    # Three nav buttons with hrefs (no danger button on a non-urgent card)
    labels = [a["label"] for a in card["actions"]]
    assert labels == ["Review invoices", "Place orders", "View P&L"]
    for action in card["actions"]:
        assert action["href"].startswith("/")
        assert action["type"] in {"primary", "secondary"}

    # Suggested chips present
    assert card["suggestedChips"] == [
        "Approve all invoices",
        "What's critical?",
        "Dismiss",
    ]


def test_build_brief_card_urgent_when_protein_below_par():
    par_shortfalls = [
        {"item_name": "Atlantic Salmon", "on_hand": "2 lbs", "min_quantity": 15, "shortfall": -13},
    ]

    card = build_brief_card(**_empty_card_inputs(par_shortfalls=par_shortfalls))

    assert card["type"] == "urgent"
    assert card["priority"] == 2

    # Emergency reorder danger button is appended
    danger_buttons = [a for a in card["actions"] if a["type"] == "danger"]
    assert len(danger_buttons) == 1
    assert danger_buttons[0]["label"] == "Emergency reorder"
    # Danger button has no href — it falls back to label-send-to-chat
    assert "href" not in danger_buttons[0]


def test_build_brief_card_urgent_when_three_pending_invoices():
    invoices = [
        _StubInvoice(vendor_name="Sysco"),
        _StubInvoice(vendor_name="Pacific Seafood"),
        _StubInvoice(vendor_name="Local Farm Co"),
    ]
    card = build_brief_card(**_empty_card_inputs(pending_invoices=invoices))

    assert card["type"] == "urgent"
    assert card["priority"] == 2


def test_build_brief_card_caps_changes_at_eight():
    par_shortfalls = [
        {"item_name": f"Item {i}", "on_hand": "0", "min_quantity": 1, "shortfall": -1}
        for i in range(20)
    ]
    card = build_brief_card(**_empty_card_inputs(par_shortfalls=par_shortfalls))
    assert len(card["changes"]) == 8


# ---------------------------------------------------------------------------
# DailyBriefTool.execute — end-to-end with mocked sio + mocked repos
# ---------------------------------------------------------------------------

def _make_tool(args: dict | None = None) -> DailyBriefTool:
    agent = MagicMock()
    agent.config.additional = {}
    return DailyBriefTool(
        agent=agent,
        name="daily_brief_tool",
        method=None,
        args=args or {},
        message="",
        loop_data=None,
    )


@pytest.mark.asyncio
async def test_execute_emits_card_with_data(mock_send_data):
    tool = _make_tool()
    loc_id = uuid.uuid4()

    with patch(
        "python.tools.daily_brief_tool._resolve_location",
        new=AsyncMock(return_value=(loc_id, "Carabiner Test Kitchen")),
    ), patch(
        "python.tools.daily_brief_tool._gather_brief_data",
        new=AsyncMock(return_value={
            "pending_orders": [_StubOrder(status="awaiting")],
            "pending_invoices": [_StubInvoice(vendor_name="Sysco", total="$500")],
            "incomplete_prep": [_StubPrepItem(name="Béarnaise")],
            "par_shortfalls": [
                {"item_name": "Heavy Cream", "on_hand": "1 qt", "min_quantity": 6, "shortfall": -5},
            ],
            "pl_row": {"food_cost_pct": 28.4, "revenue": 4210.0},
        }),
    ):
        resp = await tool.execute()

    assert isinstance(resp, Response)
    assert resp.break_loop is False
    assert "Daily brief emitted" in resp.message
    assert "Carabiner Test Kitchen" in resp.message

    # send_data is called positionally: (event_type, data)
    # and defaults endpoint_name="/ws" — matches frontend io("/ws").
    mock_send_data.assert_called_once()
    call_args = mock_send_data.call_args
    assert call_args[0][0] == "action_card"
    # No explicit namespace kwarg — we rely on send_data's /ws default.
    assert "namespace" not in call_args[1]
    assert "endpoint_name" not in call_args[1] or call_args[1]["endpoint_name"] == "/ws"

    card = call_args[0][1]["card"]
    assert card["module"] == "briefing"
    assert card["action"] == "review"
    assert card["type"] == "info"
    assert len(card["stats"]) == 4
    assert len(card["changes"]) >= 1
    # Buttons with hrefs are present
    nav_actions = [a for a in card["actions"] if a.get("href")]
    assert len(nav_actions) >= 1
    assert any(a["href"] == "/reporting" for a in nav_actions)


@pytest.mark.asyncio
async def test_execute_no_data_does_not_crash(mock_send_data):
    tool = _make_tool()
    loc_id = uuid.uuid4()

    with patch(
        "python.tools.daily_brief_tool._resolve_location",
        new=AsyncMock(return_value=(loc_id, "Empty Kitchen")),
    ), patch(
        "python.tools.daily_brief_tool._gather_brief_data",
        new=AsyncMock(return_value={
            "pending_orders": [],
            "pending_invoices": [],
            "incomplete_prep": [],
            "par_shortfalls": [],
            "pl_row": None,
        }),
    ):
        resp = await tool.execute()

    assert resp.break_loop is False
    assert "Daily brief emitted" in resp.message
    mock_send_data.assert_called_once()
    card = mock_send_data.call_args[0][1]["card"]
    # No-data branch shape: 1 friendly change, 1 action, em-dash stats
    assert len(card["changes"]) == 1
    assert card["changes"][0]["op"] == "\u2192"
    assert len(card["actions"]) == 1
    assert card["actions"][0]["label"] == "View P&L"
    assert card["stats"][0]["value"] == "—"


@pytest.mark.asyncio
async def test_execute_handles_location_resolution_failure(mock_send_data):
    tool = _make_tool()

    with patch(
        "python.tools.daily_brief_tool._resolve_location",
        new=AsyncMock(side_effect=ValueError("No locations found in database")),
    ):
        resp = await tool.execute()

    assert resp.break_loop is False
    assert "could not resolve location" in resp.message
    mock_send_data.assert_not_called()


@pytest.mark.asyncio
async def test_execute_returns_warning_when_ws_manager_unavailable():
    """If helpers.ws_manager can't be imported, tool returns graceful error."""
    tool = _make_tool()
    loc_id = uuid.uuid4()

    # Ensure helpers.ws_manager is NOT in sys.modules for this test
    original = sys.modules.pop("helpers.ws_manager", None)
    try:
        with patch(
            "python.tools.daily_brief_tool._resolve_location",
            new=AsyncMock(return_value=(loc_id, "Loc")),
        ), patch(
            "python.tools.daily_brief_tool._gather_brief_data",
            new=AsyncMock(return_value={
                "pending_orders": [], "pending_invoices": [], "incomplete_prep": [],
                "par_shortfalls": [], "pl_row": None,
            }),
        ):
            resp = await tool.execute()
    finally:
        if original is not None:
            sys.modules["helpers.ws_manager"] = original

    assert "not available" in resp.message.lower() or "not emitted" in resp.message.lower()
    assert resp.break_loop is False
