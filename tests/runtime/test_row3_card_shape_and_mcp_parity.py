"""Row #3 tests — action-card shape parity + MCP tool-prompt parity.

These are hermetic. They do not require Docker, the live stack,
or any LLM. They verify two invariants the inventory called out:

1. ``carabiner.runtime.cards.propose()`` returns a dict whose shape
   is byte-for-byte compatible with the legacy A0 action-card shape
   at ``python/tools/action_card.py:127-143``:

       {id, type, module, action, summary, detail, itemId, chatId,
        changes[], stats[], priority, deadline, status, timestamp,
        source}

   Plus an internal ``_propose_data`` field (bridge-only, frontend
   never sees it). Missing/extra fields fail the test.

2. The MCP tool surface that hermes sees has exactly two tools,
   each with the canonical name and description, and each is
   documented in the tracked prompt stack (SOUL + the two skills).
   This guards against drift between the bridge's tool surface and
   the operator-facing prompts.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from unittest.mock import patch

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]


# ---- Action-card shape parity ---------------------------------------------


CANONICAL_FIELDS = {
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
}


def _card_from_propose():
    """Call cards.propose() with stubs and return the resulting dict.

    We stub the policy check (allow), the audit writer (sync stub),
    and the emitter (no-op). The shape is the canonical shape.
    """
    from carabiner.runtime import cards

    fake_decision = type("D", (), {"allowed": True, "normalised_resource": "orders"})()
    fake_card_id = "00000000-0000-0000-0000-000000000001"
    with patch("carabiner.runtime.cards.policy.check_propose", return_value=fake_decision), \
         patch("carabiner.runtime.cards.audit.create_action_log_sync", return_value=None), \
         patch.object(cards, "_REGISTRY", {}), \
         patch.object(cards.uuid, "uuid4", lambda: _uuid_from_str(fake_card_id)):
        card = cards.propose(
            resource="orders",
            verb="update",
            data={"id": "00000000-0000-0000-0000-000000000002",
                  "vendor": "US Foods", "total": 1234.56},
            reason="row3-shape-parity probe",
            chat_id="chat-1",
        )
    return card


def _uuid_from_str(s: str):
    import uuid as _uuid
    return _uuid.UUID(s)


def test_action_card_shape_has_all_canonical_fields() -> None:
    card = _card_from_propose()
    missing = CANONICAL_FIELDS - set(card.keys())
    assert not missing, f"card missing canonical fields: {missing}"


def test_action_card_shape_has_no_legacy_or_drift_fields() -> None:
    card = _card_from_propose()
    # Frontend-facing fields must not include bridge-only or A0-era
    # fields. _propose_data is allowed because the test infra and the
    # commit() path both depend on it.
    extra = set(card.keys()) - CANONICAL_FIELDS - {"_propose_data"}
    assert not extra, f"card has unexpected fields: {extra}"


def test_action_card_shape_field_types_match() -> None:
    card = _card_from_propose()
    assert isinstance(card["id"], str)
    assert isinstance(card["type"], str)
    assert isinstance(card["module"], str)
    assert isinstance(card["action"], str)
    assert isinstance(card["summary"], str)
    assert isinstance(card["detail"], str)  # JSON string in canonical shape
    assert card["itemId"] is None or isinstance(card["itemId"], str)
    assert card["chatId"] is None or isinstance(card["chatId"], str)
    assert isinstance(card["changes"], list)
    assert isinstance(card["stats"], list)
    assert isinstance(card["priority"], int)
    assert card["deadline"] is None or isinstance(card["deadline"], int)
    assert card["status"] in ("proposed", "committed", "dismissed", "new")
    assert isinstance(card["timestamp"], int)
    assert isinstance(card["source"], str)


def test_action_card_detail_is_valid_json() -> None:
    card = _card_from_propose()
    # ``detail`` in the canonical shape is a JSON string carrying
    # {module, action, item_id, stats, changes, kvs}.
    detail = json.loads(card["detail"])
    assert "module" in detail
    assert "action" in detail
    assert "changes" in detail
    assert "stats" in detail


def test_action_card_status_starts_as_proposed() -> None:
    card = _card_from_propose()
    assert card["status"] == "proposed"


# ---- MCP tool-prompt parity ------------------------------------------------


def test_mcp_surface_exposes_exactly_two_tools() -> None:
    """The bridge's MCP surface has exactly two tools, named and
    documented the same way the tracked prompt stack does."""
    from carabiner.runtime import mcp_surface

    mcp = mcp_surface.get_mcp()
    # FastMCP 1.x stores tools in _tool_manager._tools
    names = list(getattr(mcp, "_tool_manager")._tools.keys())
    assert set(names) == {"carabiner_read", "carabiner_propose_write"}, (
        f"MCP surface must expose exactly two tools, got: {names}"
    )


def test_mcp_tool_names_match_skill_documents() -> None:
    """The two tool names appear in the tracked skill markdown files."""
    skill_paths = [
        REPO_ROOT / "hermes" / "skills" / "carabineros-restaurant" / "SKILL.md",
        REPO_ROOT / "hermes" / "skills" / "carabineros-location-context" / "SKILL.md",
        REPO_ROOT / "hermes" / "SOUL.md",
    ]
    for path in skill_paths:
        text = path.read_text(encoding="utf-8")
        assert "carabiner_read" in text, (
            f"{path.relative_to(REPO_ROOT)} does not mention carabiner_read"
        )
        assert "carabiner_propose_write" in text, (
            f"{path.relative_to(REPO_ROOT)} does not mention carabiner_propose_write"
        )


def test_mcp_tool_schemas_have_required_keys() -> None:
    """Each MCP tool has the keys required for OpenAI-style tool use:
    name, description, inputSchema. Verifies the FastMCP decorator
    actually populated them."""
    from carabiner.runtime import mcp_surface

    mcp = mcp_surface.get_mcp()
    for name in ("carabiner_read", "carabiner_propose_write"):
        tool = mcp._tool_manager._tools[name]
        # FastMCP stores the function under tool.fn; the schema lives
        # on the tool's parameters attribute.
        assert tool.fn is not None, f"{name}: no fn attached"
        assert hasattr(tool, "parameters"), f"{name}: no parameters attribute"
        params = tool.parameters
        assert "type" in params and params["type"] == "object", (
            f"{name}: parameters must be an object schema"
        )
        assert "properties" in params, (
            f"{name}: parameters must have 'properties'"
        )


def test_mcp_tool_prompts_have_no_a0_concepts() -> None:
    """The tracked prompt stack does not instruct the model to use
    A0-era concepts. Mirrors the inventory check."""
    forbidden = [
        "code_execution_tool",
        "call_subordinate",
        "notify_user",
        "main kitchen",
    ]
    paths = [
        REPO_ROOT / "hermes" / "SOUL.md",
        REPO_ROOT / "hermes" / "skills" / "carabineros-restaurant" / "SKILL.md",
        REPO_ROOT / "hermes" / "skills" / "carabineros-location-context" / "SKILL.md",
    ]
    for path in paths:
        text = path.read_text(encoding="utf-8").lower()
        for phrase in forbidden:
            assert phrase not in text, (
                f"{path.relative_to(REPO_ROOT)} mentions forbidden: {phrase!r}"
            )


# ---- Card-lifecycle integration (write policy + audit) --------------------


def test_propose_audit_failure_returns_error_status() -> None:
    """If the async audit write fails, the MCP handler must return
    status=error rather than status=awaiting_approval. This enforces
    AUDIT_REQUIRED=true fail-closed."""
    import asyncio
    from carabiner.runtime import mcp_surface

    fake_card = {"id": "card-1", "status": "proposed", "module": "orders", "action": "create"}

    async def _boom(*args, **kwargs):
        raise RuntimeError("simulated audit failure")

    with patch("carabiner.runtime.cards.propose", return_value=fake_card), \
         patch("carabiner.runtime.audit.create_action_log", new=_boom):
        mcp = mcp_surface.get_mcp()
        tool = mcp._tool_manager._tools["carabiner_propose_write"]
        # The MCP tool handler is async; we must await it.
        result = asyncio.get_event_loop().run_until_complete(
            tool.fn(
                resource="orders",
                verb="create",
                data=json.dumps({"location_id": "loc-1", "vendor": "US Foods"}),
                reason="r",
                run_id="r2",
            )
        )
    parsed = json.loads(result)
    assert parsed["status"] == "error", (
        f"audit failure must surface as status=error; got: {parsed['status']}"
    )