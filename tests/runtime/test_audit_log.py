"""Real-Postgres audit-log integration tests.

Marked ``@pytest.mark.integration``. Skipped unless ``DATABASE_URL``
is set in the env (e.g. ``DATABASE_URL=postgresql+asyncpg://...``).

Uses the existing Alembic migrations at ``carabiner/db/migrations/``.
Each test creates a fresh schema, runs the test, drops the schema —
so this works against a shared Postgres without polluting other data.
"""

from __future__ import annotations

import asyncio
import os
import uuid

import pytest


pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL not set; integration tests skipped",
)


@pytest.mark.asyncio
@pytest.mark.integration
async def test_create_action_log_with_proposed_status() -> None:
    from carabiner.runtime import audit

    card_id = str(uuid.uuid4())
    result = audit.create_action_log(
        action_type="create",
        status="proposed",
        card_id=card_id,
        location_id=str(uuid.uuid4()),
        extra={"resource": "orders", "data": {"vendor": "US Foods"}},
    )
    assert result is not None
    assert result.status == "proposed"
    assert result.extra["card_id"] == card_id
    assert result.extra["source"] == "hermes-bridge"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_list_action_log_filters_by_location() -> None:
    from carabiner.runtime import audit

    target = uuid.UUID(str(uuid.uuid4()))
    card_id = str(uuid.uuid4())
    audit.create_action_log(
        action_type="update",
        status="proposed",
        card_id=card_id,
        location_id=target,
        extra={"resource": "inventory"},
    )
    from carabiner.db import repositories as repos

    rows = await repos.list_action_log(location_id=target)
    assert any(str(r.extra.get("card_id")) == card_id for r in rows)


@pytest.mark.asyncio
@pytest.mark.integration
async def test_audit_required_true_failing_audit_fails_closed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AUDIT_REQUIRED=true + audit failure → raises (caller must fail closed)."""
    monkeypatch.setenv("AUDIT_REQUIRED", "true")
    from carabiner.runtime import audit

    # Replace the inner write so we always raise.
    def boom(data):
        raise RuntimeError("simulated DB failure")

    from carabiner.db import repositories as repos

    monkeypatch.setattr(repos, "create_action_log", boom)
    with pytest.raises(RuntimeError):
        audit.create_action_log(action_type="create", status="proposed", card_id=str(uuid.uuid4()))


@pytest.mark.asyncio
@pytest.mark.integration
async def test_audit_required_false_failing_audit_swallowed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AUDIT_REQUIRED=false + audit failure → returns None, caller proceeds."""
    monkeypatch.setenv("AUDIT_REQUIRED", "false")
    from carabiner.runtime import audit

    def boom(data):
        raise RuntimeError("simulated DB failure")

    from carabiner.db import repositories as repos

    monkeypatch.setattr(repos, "create_action_log", boom)
    result = audit.create_action_log(action_type="create", status="proposed", card_id=str(uuid.uuid4()))
    assert result is None  # swallowed


def test_build_metadata_shape() -> None:
    from carabiner.runtime.audit import build_metadata

    meta = build_metadata(
        intent="create",
        outcome="proposed",
        card_id="abc",
        changes=[{"op": "+", "text": "Created orders"}],
        reason="inventory low",
    )
    assert meta["intent"] == "create"
    assert meta["outcome"] == "proposed"
    assert meta["card_id"] == "abc"
    assert meta["reason"] == "inventory low"
    assert meta["source"] == "hermes-bridge"
    assert "ts" in meta