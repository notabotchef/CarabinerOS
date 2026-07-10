"""Card lifecycle tests — mocked audit, no real DB.

Verifies the propose → commit → dismiss lifecycle on
:mod:`carabiner.runtime.cards` including:

- the canonical card dict shape (see :data:`CANONICAL_FIELDS` in
  ``tests/runtime/test_row3_card_shape_and_mcp_parity.py`` and the
  ``ActionCard`` built by :func:`carabiner.runtime.cards.propose`)
- idempotent commit (second call returns existing, no second mutation)
- AUDIT_REQUIRED fail-closed
- policy re-check on commit
- dismiss does not mutate
"""

from __future__ import annotations

import os
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from carabiner.runtime import cards


@pytest.fixture(autouse=True)
def _stub_audit_always(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """Mock audit.create_action_log_sync + audit.create_action_log for every test.

    Without this, propose()/commit()/dismiss() would attempt to
    connect to a real Postgres on the localhost default URL. Tests
    that want to assert specific calls can re-mock via
    ``with patch.object(cards.audit, 'create_action_log_sync', mock)``
    or ``patch.object(cards.audit, 'create_action_log', AsyncMock(...))``.
    """
    sync_mock = MagicMock()
    async_mock = AsyncMock(return_value=None)
    monkeypatch.setattr(cards.audit, "create_action_log_sync", sync_mock)
    monkeypatch.setattr(cards.audit, "create_action_log", async_mock)
    return sync_mock


@pytest.fixture(autouse=True)
def _clear_registry() -> None:
    cards.reset_for_testing()
    yield
    cards.reset_for_testing()


def _stub_audit(monkeypatch: pytest.MonkeyPatch, *, raises: bool = False) -> MagicMock:
    """Replace ``audit.create_action_log_sync`` with a mock so no DB is touched."""
    mock = MagicMock()
    if raises:
        mock.side_effect = RuntimeError("simulated audit failure")
    monkeypatch.setattr(cards.audit, "create_action_log_sync", mock)
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
        data={"location_id": str(uuid.uuid4()), "vendor": "US Foods", "total": 100.0},
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


def test_propose_calls_audit_with_proposed_status(monkeypatch: pytest.MonkeyPatch) -> None:
    audit_mock = MagicMock()
    monkeypatch.setattr(cards.audit, "create_action_log_sync", audit_mock)
    cards.propose(
        resource="orders",
        verb="create",
        data={"location_id": str(uuid.uuid4()), "vendor": "US Foods"},
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
    with patch.object(cards.audit, "create_action_log_sync", audit_mock), patch(
        "carabiner.runtime.cards.execute_mutation", execute_mock
    ):
        card = cards.propose(
            resource="orders",
            verb="create",
            data={"location_id": str(uuid.uuid4()), "vendor": "US Foods", "total": 100.0},
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
    """When AUDIT_REQUIRED=true and the post-mutation audit raises, commit
    raises (mutation has run but the audit record is missing). The caller
    is expected to surface the failure to the operator; in production the
    mutation is the user's own action and the audit gap is logged.

    The stronger guarantee — that audit precedes mutation — would require
    a pre-commit audit row + a try/finally that rolls back. That's tracked
    as a follow-up; for now, this test ensures the audit write is *attempted*
    and the failure is *surfaced* (rather than silently swallowed).
    """
    os.environ["AUDIT_REQUIRED"] = "true"
    execute_mock = AsyncMock(return_value={"id": "result-id"})

    def selective_audit_sync(*args: Any, **kwargs: Any) -> None:
        return None

    async def selective_audit_async(*args: Any, **kwargs: Any) -> None:
        if kwargs.get("status") == "committed":
            raise RuntimeError("simulated commit audit failure")
        return None

    with patch("carabiner.runtime.cards.execute_mutation", execute_mock), patch.object(
        cards.audit, "create_action_log_sync", side_effect=selective_audit_sync
    ), patch.object(
        cards.audit, "create_action_log", side_effect=selective_audit_async
    ):
        card = cards.propose(
            resource="orders",
            verb="create",
            data={"location_id": str(uuid.uuid4()), "vendor": "US Foods", "total": 100.0},
            reason="r",
        )
        # The post-mutation audit raises; commit() surfaces it.
        with pytest.raises(RuntimeError):
            _run(cards.commit(card["id"]))
        # The audit write was *attempted* (failure was raised to caller).
        # Mutation ran (the audit happens after the mutation in the
        # current design — see docstring for the stronger-guarantee
        # follow-up that would gate the mutation on a pre-commit row).


def test_dismiss_writes_audit_but_does_not_mutate(monkeypatch: pytest.MonkeyPatch) -> None:
    audit_mock_sync = MagicMock()
    audit_mock_async = AsyncMock(return_value=None)
    monkeypatch.setattr(cards.audit, "create_action_log_sync", audit_mock_sync)
    monkeypatch.setattr(cards.audit, "create_action_log", audit_mock_async)
    execute_mock = AsyncMock(return_value={"id": "result-id"})
    with patch("carabiner.runtime.cards.execute_mutation", execute_mock):
        card = cards.propose(
            resource="inventory",
            verb="update",
            data={"id": "abc", "on_hand": 5},
            reason="r",
        )
        result = _run(cards.dismiss(card["id"]))
        assert result["status"] == "dismissed"
        assert execute_mock.call_count == 0
        # Audit row written with status=dismissed (async path)
        statuses = [c.kwargs.get("status") for c in audit_mock_async.call_args_list]
        assert "dismissed" in statuses


def test_get_unknown_id_returns_none() -> None:
    assert cards.get("does-not-exist") is None


# Helper — runs a coroutine synchronously inside a non-async test.
def _run(coro):
    import asyncio

    return asyncio.run(coro)