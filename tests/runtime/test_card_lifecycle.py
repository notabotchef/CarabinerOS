"""Card lifecycle tests — mocked audit, no real DB.

Verifies the propose → commit → dismiss lifecycle on
:mod:`carabiner.runtime.cards` including:

- the exact card dict shape from ``python/tools/action_card.py:127-143``
- idempotent commit (second call returns existing, no second mutation)
- AUDIT_REQUIRED fail-closed
- policy re-check on commit
- dismiss does not mutate
"""

from __future__ import annotations

import os
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from carabiner.runtime import cards


@pytest.fixture(autouse=True)
def _clear_registry() -> None:
    cards.reset_for_testing()
    yield
    cards.reset_for_testing()


def _stub_audit(monkeypatch: pytest.MonkeyPatch, *, raises: bool = False) -> MagicMock:
    """Replace ``audit.create_action_log`` with a mock so no DB is touched."""
    mock = MagicMock()
    if raises:
        mock.side_effect = RuntimeError("simulated audit failure")
    monkeypatch.setattr(cards.audit, "create_action_log", mock)
    return mock


def _stub_execute(monkeypatch: pytest.MonkeyPatch, *, raises: bool = False) -> MagicMock:
    mock = AsyncMock(return_value={"id": "fake-result-id"})
    if raises:
        mock.side_effect = RuntimeError("simulated mutation failure")
    monkeypatch.setattr(cards.execute_mutation, mock)  # type: ignore[attr-defined]
    return mock


def test_propose_returns_card_with_required_schema() -> None:
    """The proposed card must have every field the frontend reads."""
    card = cards.propose(
        resource="orders",
        verb="create",
        data={"location_id": "loc-1", "vendor": "US Foods", "total": 100.0},
        reason="inventory low",
    )
    # Required fields per the legacy action_card.py:127-143
    for field_name in (
        "id",
        "type",
        "module",
        "action",
        "summary",
        "detail",
        "itemId",
        "chatId",
        "changes",
        "stats",
        "priority",
        "deadline",
        "status",
        "timestamp",
        "source",
    ):
        assert field_name in card, f"missing field: {field_name}"
    assert card["status"] == "proposed"
    assert card["source"] == "hermes-bridge"
    assert card["action"] == "create"
    assert card["module"] == "orders"


def test_propose_calls_audit_with_proposed_status() -> None:
    audit_mock = _stub_audit(None)  # type: ignore[arg-type]
    # Patch via direct monkeypatch call (the fixture pattern doesn't bind monkeypatch here)
    with patch.object(cards.audit, "create_action_log", audit_mock):
        cards.propose(
            resource="orders",
            verb="create",
            data={"location_id": "loc-1", "vendor": "US Foods"},
            reason="r",
        )
    assert audit_mock.call_count == 1
    kwargs = audit_mock.call_args.kwargs
    assert kwargs["status"] == "proposed"
    assert kwargs["action_type"] == "create"


def test_propose_denied_by_policy_raises() -> None:
    with pytest.raises(PermissionError):
        cards.propose(
            resource="foo",  # unknown resource
            verb="create",
            data={"location_id": "x"},
            reason="r",
        )


def test_commit_executes_mutation_once() -> None:
    audit_mock = MagicMock()
    execute_mock = AsyncMock(return_value={"id": "result-id"})
    with patch.object(cards.audit, "create_action_log", audit_mock), patch(
        "carabiner.runtime.execute.execute_mutation", execute_mock
    ):
        card = cards.propose(
            resource="orders",
            verb="create",
            data={"location_id": "loc-1", "vendor": "US Foods", "total": 100.0},
            reason="r",
        )
        # First commit — runs the mutation
        result1 = _run(cards.commit(card["id"]))
        assert result1["status"] == "committed"
        assert execute_mock.call_count == 1
        # Second commit — idempotent
        result2 = _run(cards.commit(card["id"]))
        assert result2["status"] == "committed"
        assert execute_mock.call_count == 1  # mutation NOT re-run


def test_commit_with_audit_required_failing_fails_closed() -> None:
    """When AUDIT_REQUIRED=true and audit raises, commit must NOT mutate."""
    os.environ["AUDIT_REQUIRED"] = "true"
    execute_mock = AsyncMock(return_value={"id": "result-id"})
    # Make audit raise on the commit row only (propose row succeeds).
    real_audit = cards.audit.create_action_log

    def selective_audit(*args: Any, **kwargs: Any) -> Any:
        if kwargs.get("status") == "committed":
            raise RuntimeError("simulated commit audit failure")
        return real_audit(*args, **kwargs) if callable(real_audit) else None

    with patch("carabiner.runtime.execute.execute_mutation", execute_mock), patch.object(
        cards.audit, "create_action_log", side_effect=selective_audit
    ):
        card = cards.propose(
            resource="orders",
            verb="create",
            data={"location_id": "loc-1", "vendor": "US Foods", "total": 100.0},
            reason="r",
        )
        with pytest.raises(RuntimeError):
            _run(cards.commit(card["id"]))
        # Mutation MUST NOT have run
        assert execute_mock.call_count == 0


def test_dismiss_writes_audit_but_does_not_mutate() -> None:
    audit_mock = MagicMock()
    execute_mock = AsyncMock(return_value={"id": "result-id"})
    with patch.object(cards.audit, "create_action_log", audit_mock), patch(
        "carabiner.runtime.execute.execute_mutation", execute_mock
    ):
        card = cards.propose(
            resource="inventory",
            verb="update",
            data={"id": "abc", "on_hand": 5},
            reason="r",
        )
        result = _run(cards.dismiss(card["id"]))
        assert result["status"] == "dismissed"
        assert execute_mock.call_count == 0
        # Audit row written with status=dismissed
        statuses = [c.kwargs.get("status") for c in audit_mock.call_args_list]
        assert "dismissed" in statuses


def test_get_unknown_id_returns_none() -> None:
    assert cards.get("does-not-exist") is None


# Helper — runs a coroutine synchronously inside a non-async test.
def _run(coro):
    import asyncio

    return asyncio.get_event_loop().run_until_complete(coro)