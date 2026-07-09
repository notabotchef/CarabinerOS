"""Pure-pytest policy tests — no async, no DB, no hermes."""

from __future__ import annotations

import pytest

from carabiner.runtime import policy


def test_check_propose_unknown_resource_denied() -> None:
    decision = policy.check_propose("foo", "create", {"location_id": "abc"})
    assert decision.allowed is False
    assert decision.reason == "unknown_resource"


def test_check_propose_unknown_verb_denied() -> None:
    decision = policy.check_propose("orders", "read", {"location_id": "abc"})
    assert decision.allowed is False
    assert decision.reason == "unknown_verb"


def test_check_propose_create_without_location_id_denied() -> None:
    decision = policy.check_propose("orders", "create", {"vendor": "US Foods"})
    assert decision.allowed is False
    assert decision.reason == "missing_location_id"


def test_check_propose_create_with_location_id_allowed() -> None:
    decision = policy.check_propose("orders", "create", {"location_id": "abc", "vendor": "x"})
    assert decision.allowed is True
    assert decision.reason is None
    assert decision.normalised_resource == "orders"


def test_check_propose_update_does_not_require_location_id() -> None:
    decision = policy.check_propose("inventory", "update", {"id": "abc", "on_hand": 5})
    assert decision.allowed is True


def test_check_propose_food_cost_alias_normalised() -> None:
    decision = policy.check_propose("food-cost", "create", {"location_id": "abc"})
    assert decision.allowed is True
    assert decision.normalised_resource == "food_cost"


def test_check_commit_already_committed_denied() -> None:
    card = {"status": "committed"}
    decision = policy.check_commit("orders", "create", {"location_id": "abc"}, card)
    assert decision.allowed is False
    assert decision.reason == "already_committed"


def test_check_commit_proposed_allowed() -> None:
    card = {"status": "proposed"}
    decision = policy.check_commit("orders", "create", {"location_id": "abc"}, card)
    assert decision.allowed is True


def test_check_commit_unknown_status_denied() -> None:
    card = {"status": "weird"}
    decision = policy.check_commit("orders", "create", {"location_id": "abc"}, card)
    assert decision.allowed is False
    assert decision.reason == "missing_data"


def test_check_commit_missing_card_denied() -> None:
    decision = policy.check_commit("orders", "create", {"location_id": "abc"}, None)
    assert decision.allowed is False
    assert decision.reason == "missing_data"


def test_check_commit_re_runs_resource_allowlist() -> None:
    card = {"status": "proposed"}
    decision = policy.check_commit("foo", "create", {"location_id": "abc"}, card)
    assert decision.allowed is False
    assert decision.reason == "unknown_resource"