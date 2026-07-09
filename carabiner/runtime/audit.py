"""Audit wrapper around ``carabiner.db.repositories.create_action_log``.

Every mutation in the bridge writes an :class:`ActionLog` row before
the change is applied (``proposed``) and again after
(``committed`` / ``dismissed``). The metadata dict follows the shape
modeled on ``carabiner.domain.connectors.build_action_log_entry``:
``{intent, outcome, card_id, changes, reason, ts, source}``.

When ``AUDIT_REQUIRED=true`` (the beta default) and the underlying
write raises, this module re-raises so the caller fails closed. With
``AUDIT_REQUIRED=false`` the wrapper logs the failure and returns
``None`` so the caller can proceed — useful for hermetic tests and
for emergency overrides documented as the only escape hatch.
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from typing import Any, Mapping

logger = logging.getLogger(__name__)


def _audit_required() -> bool:
    raw = os.environ.get("AUDIT_REQUIRED", "true").strip().lower()
    return raw in {"1", "true", "yes", "on", "y", "t"}


def _now() -> int:
    return int(time.time())


def build_metadata(
    *,
    intent: str,
    outcome: str,
    card_id: str,
    changes: list[dict] | None = None,
    reason: str | None = None,
    extra: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the ``extra`` (JSONB) metadata dict written to ActionLog.

    Mirrors the shape used by ``build_action_log_entry`` in
    ``carabiner/domain/connectors.py:128`` but adds bridge-specific
    fields (``source``, ``ts``) so logs are distinguishable from the
    legacy Agent Zero ones.
    """
    meta: dict[str, Any] = {
        "intent": intent,
        "outcome": outcome,
        "card_id": card_id,
        "changes": list(changes or []),
        "source": "hermes-bridge",
        "ts": _now(),
    }
    if reason:
        meta["reason"] = reason
    if extra:
        for k, v in extra.items():
            meta.setdefault(k, v)
    return meta


def create_action_log(
    *,
    action_type: str,
    status: str,
    card_id: str | None = None,
    location_id: str | uuid.UUID | None = None,
    org_id: str | uuid.UUID | None = None,
    provider_id: str | None = None,
    agent_context_id: str | None = None,
    extra: Mapping[str, Any] | None = None,
) -> Any:
    """Write an ActionLog row.

    Imports ``create_action_log`` lazily so tests can stub it via
    ``monkeypatch.setattr`` without dragging in the SQLAlchemy session.

    Raises :class:`Exception` (re-raised) when ``AUDIT_REQUIRED=true``
    and the write fails — caller must fail closed.
    Returns ``None`` on success (or when ``AUDIT_REQUIRED=false``
    and the write failed).
    """
    meta = dict(extra or {})
    if card_id is not None:
        meta.setdefault("card_id", card_id)
    if action_type:
        meta.setdefault("intent", action_type)
    if status:
        meta.setdefault("outcome", status)
    meta.setdefault("source", "hermes-bridge")
    meta.setdefault("ts", _now())

    from carabiner.db import repositories as repos

    data: dict[str, Any] = {
        "action_type": action_type,
        "status": status,
        "extra": meta,
    }
    if location_id is not None:
        data["location_id"] = location_id
    if org_id is not None:
        data["org_id"] = org_id
    if provider_id is not None:
        data["provider_id"] = provider_id
    if agent_context_id is not None:
        data["agent_context_id"] = agent_context_id

    try:
        return repos.create_action_log(data)
    except Exception as exc:  # noqa: BLE001
        if _audit_required():
            logger.error(
                "AUDIT_REQUIRED=true; refusing to swallow audit failure: %s", exc
            )
            raise
        logger.warning(
            "AUDIT_REQUIRED=false; audit write failed but caller proceeds: %s", exc
        )
        return None