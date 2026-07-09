"""Host-side policy gate for Carabiner bridge mutations.

Pure functions, unit-testable, no I/O. The model cannot bypass this:
every ``propose_write`` MCP tool call and every ``card_commit`` socket
event runs through here.

Verb × resource allowlist lifted from ``usr/tools/carabiner_write.py:23-28``
on the legacy Agent Zero stack. The bridge keeps the same allowlist
so the behaviour is consistent across runtimes.

NB: ``food_cost`` (underscore) is the resource id used by the MCP
server's ``_MODULE_REGISTRY`` (``carabiner/mcp/server.py``); the legacy
write tool used the hyphenated form ``food-cost``. The bridge accepts
both forms and normalises internally.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping


ALLOWED_VERBS: frozenset[str] = frozenset({"create", "update", "delete"})

ALLOWED_RESOURCES: frozenset[str] = frozenset(
    {
        "orders",
        "inventory",
        "recipes",
        "menu",
        "invoices",
        "prep",
        "food_cost",  # canonical; "food-cost" is accepted and normalised
        "vendors",
        "campaigns",
    }
)

RESOURCE_ALIASES: dict[str, str] = {
    "food-cost": "food_cost",
    "food_cost": "food_cost",
}

CREATE_REQUIRES_LOCATION_ID: bool = True


@dataclass(frozen=True)
class PolicyDecision:
    """Outcome of :func:`check_propose` / :func:`check_commit`.

    ``allowed`` is the gate; ``reason`` is a stable machine-readable
    code (``"unknown_resource"``, ``"unknown_verb"``, ``"missing_location_id"``,
    ``"already_committed"``, ``"missing_data"``) when denied, or
    ``None`` when allowed.
    """

    allowed: bool
    reason: str | None = None
    normalised_resource: str | None = None


def _normalise_resource(resource: str) -> str:
    return RESOURCE_ALIASES.get(resource, resource)


def check_propose(resource: str, verb: str, data: Mapping[str, Any] | None) -> PolicyDecision:
    """Pre-write gate: can hermes even *propose* this mutation?"""
    if not resource:
        return PolicyDecision(False, "unknown_resource")
    normalised = _normalise_resource(resource)
    if normalised not in ALLOWED_RESOURCES:
        return PolicyDecision(False, "unknown_resource")
    if verb not in ALLOWED_VERBS:
        return PolicyDecision(False, "unknown_verb")
    if verb == "create" and CREATE_REQUIRES_LOCATION_ID:
        if not data or not data.get("location_id"):
            return PolicyDecision(False, "missing_location_id")
    return PolicyDecision(True, None, normalised)


def check_commit(
    resource: str,
    verb: str,
    data: Mapping[str, Any] | None,
    card: Mapping[str, Any] | None,
) -> PolicyDecision:
    """Re-check at commit time. Defense-in-depth: commit must only run
    on a card that is in ``proposed`` (or ``new``) status.

    The base verb × resource allowlist is enforced again so a malicious
    actor who flipped the card status cannot bypass the allowlist.
    """
    base = check_propose(resource, verb, data)
    if not base.allowed:
        return base
    if card is None:
        return PolicyDecision(False, "missing_data")
    status = card.get("status")
    if status in {"committed"}:
        return PolicyDecision(False, "already_committed")
    if status not in {"proposed", "new"}:
        return PolicyDecision(False, "missing_data")
    return base