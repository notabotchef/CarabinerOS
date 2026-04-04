# Phase 2: AI Backbone Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI agent pipeline reliable — clean responses, consistent delegation, real-time status streaming, and a standardized tool-result-to-action-card protocol. Straighten the scoliosis.

**Architecture:** All changes are backend-only in `engine/`. The frontend (Phase 1) runs in a parallel branch. This phase focuses on: response cleaning, status event protocol, tool result standardization, and agent delegation reliability. When both branches merge, the backend events will feed the frontend components.

**Branch:** `engine/phase2-backbone-fix`

**Tech Stack:** Python 3.12, FastAPI, Socket.IO (python-socketio), Agent Zero, SQLAlchemy 2.0, Pytest

**Verification:** `cd engine && python3 -m pytest tests/ -v`

**Spec:** `docs/superpowers/specs/2026-03-18-carabineros-roadmap-to-launch-design.md` (Phase 2)

**Deferred to follow-up work (explicitly out of scope for this plan):**
- **Spec 2.5 (Memory & Context Persistence)** — Requires stable embedding model selection and Agent Zero memory subsystem debugging. This is an Agent Zero internals issue that needs investigation before a plan can be written. Will be its own plan once the backbone is stable.
- **Spec 2.6 (LLM Performance Tuning)** — Requires benchmarking multiple models with real prompts. Best done after delegation reliability is fixed (this plan), since prompt quality affects model performance. Will be its own benchmarking plan.

**Cross-plan contract:** The `action_card` Socket.IO event emitted by this plan must match the `ActionCard` TypeScript type defined in Phase 1's plan (`packages/api-types/src/index.ts`). Fields: `id`, `module`, `action`, `title`, `fields[]`, `timestamp`, `itemId`, `status`.

---

## File Structure

### New Files
- `engine/carabiner/domain/response_cleaning.py` — Standalone cleaning functions (no heavy imports, testable in isolation)
- `engine/tests/test_response_cleaning.py` — Comprehensive tests for response cleaning
- `engine/tests/test_status_protocol.py` — Tests for status event protocol
- `engine/tests/test_action_card_protocol.py` — Tests for tool result → action card conversion
- `engine/carabiner/domain/status_protocol.py` — Structured status event types and helpers
- `engine/carabiner/domain/action_card_protocol.py` — Tool result → action card conversion

### Modified Files
- `engine/main.py` — Structured status events, improved polling loop, better response streaming
- `engine/carabiner/agent_overlay/extensions/response_stream_chunk/_25_response_cleaning.py` — Comprehensive cleaning
- `engine/carabiner/agent_overlay/extensions/tool_execute_after/_25_workspace_sync.py` — Emit action_card events
- `engine/carabiner/agent_overlay/tools/order_tool.py` — Standardized response.additional
- `engine/carabiner/agent_overlay/tools/inventory_tool.py` — Standardized response.additional
- `engine/carabiner/agent_overlay/tools/prep_tool.py` — Standardized response.additional
- `engine/carabiner/agent_overlay/tools/food_cost_tool.py` — Standardized response.additional
- `engine/carabiner/agent_overlay/tools/menu_tool.py` — Standardized response.additional
- `engine/carabiner/agent_overlay/tools/marketing_tool.py` — Standardized response.additional
- `engine/carabiner/agent_overlay/tools/invoice_tool.py` — Standardized response.additional
- `engine/carabiner/agent_overlay/tools/recipe_tool.py` — Standardized response.additional
- `engine/carabiner/agent_overlay/tools/reporting_tool.py` — Standardized response.additional
- `engine/carabiner/agent_overlay/profiles/gm/prompts/agent.system.main.role.md` — Cleaner delegation instructions

---

## Task 1: Response Cleaning Test Suite

**Files:**
- Create: `engine/tests/test_response_cleaning.py`

- [ ] **Step 1: Write comprehensive response cleaning tests**

Create `engine/tests/test_response_cleaning.py`:

```python
"""Tests for response cleaning — ensures no Agent Zero internals leak to the user."""
import sys
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ENGINE_DIR))

# Import from standalone module (NOT main.py, which has heavy Agent Zero imports)
from carabiner.domain.response_cleaning import clean_response, clean_status_detail


class TestCleanResponse:
    """Test clean_response strips all internal artifacts."""

    def test_strips_section_include_directives(self):
        text = "Here is the result.\n§§include tools/order_tool.py§§\nDone."
        result = clean_response(text)
        assert "§§" not in result

    def test_strips_subordinate_language(self):
        text = "Response from subordinate: The inventory looks good."
        result = clean_response(text)
        assert "subordinate" not in result.lower()

    def test_maps_agent_zero_to_gm(self):
        text = "Agent 0 has completed the task. Agent Zero confirms."
        result = clean_response(text)
        assert "Agent 0" not in result
        assert "Agent Zero" not in result
        assert "GM" in result

    def test_maps_agent_numbers_to_roles(self):
        text = "Agent 1 delegated to Agent 2 who called Agent 3."
        result = clean_response(text)
        assert "Agent 1" not in result
        assert "Agent 2" not in result
        assert "Agent 3" not in result
        assert "Assistant GM" in result
        assert "Executive Chef" in result
        assert "Sous Chef" in result

    def test_strips_call_subordinate_syntax(self):
        text = 'I will call_subordinate("agm") to handle this.'
        result = clean_response(text)
        assert "call_subordinate" not in result

    def test_strips_tool_name_references(self):
        text = "Using order_tool to check your orders. The inventory_tool shows low stock."
        result = clean_response(text)
        assert "order_tool" not in result
        assert "inventory_tool" not in result

    def test_preserves_normal_restaurant_language(self):
        text = "Your food cost is at 32%. The prep list shows 3 items at risk."
        result = clean_response(text)
        assert result.strip() == text.strip()

    def test_collapses_excessive_newlines(self):
        text = "Line one.\n\n\n\n\nLine two."
        result = clean_response(text)
        assert "\n\n\n" not in result

    def test_strips_from_subordinate_prefix(self):
        text = "from subordinate: Here are the orders."
        result = clean_response(text)
        assert "from subordinate" not in result.lower()

    def test_strips_superior_references(self):
        text = "Reporting to superior: task complete."
        result = clean_response(text)
        assert "superior" not in result.lower()

    def test_strips_subagent_references(self):
        text = "The subagent has finished processing."
        result = clean_response(text)
        assert "subagent" not in result.lower()

    def test_handles_empty_string(self):
        assert clean_response("") == ""

    def test_handles_none_gracefully(self):
        # Should not crash
        try:
            result = clean_response(None)
        except (TypeError, AttributeError):
            pass  # Acceptable to raise on None


class TestCleanStatusDetail:
    """Test clean_status_detail maps agents to roles."""

    def test_maps_agent_0_to_gm(self):
        result = clean_status_detail("Agent 0 is thinking")
        assert "GM" in result
        assert "Agent 0" not in result

    def test_maps_agent_1_to_agm(self):
        result = clean_status_detail("Agent 1 checking orders")
        assert "Agent 1" not in result

    def test_maps_tool_names_to_actions(self):
        result = clean_status_detail("Calling order_tool")
        assert "order_tool" not in result

    def test_preserves_clean_text(self):
        result = clean_status_detail("Checking inventory levels")
        assert "Checking inventory levels" in result

    def test_handles_empty(self):
        result = clean_status_detail("")
        assert result == ""
```

- [ ] **Step 2: Run tests to see which pass/fail**

Run: `cd engine && python3 -m pytest tests/test_response_cleaning.py -v`
Expected: Some tests may fail — this tells us what cleaning patterns are missing.

- [ ] **Step 3: Commit test file**

```bash
git add engine/tests/test_response_cleaning.py
git commit -m "test: comprehensive response cleaning test suite"
```

---

## Task 2: Fix Response Cleaning

**Files:**
- Modify: `engine/main.py` (lines 80-120: `clean_response` and `clean_status_detail`)
- Modify: `engine/carabiner/agent_overlay/extensions/response_stream_chunk/_25_response_cleaning.py`

- [ ] **Step 1: Create standalone response cleaning module**

Create `engine/carabiner/domain/response_cleaning.py` — a lightweight module with NO heavy imports (no Agent Zero, no FastAPI, no SQLAlchemy). This is critical for testability:

```python
def clean_response(text: str) -> str:
    """Remove all Agent Zero internal artifacts from response text."""
    if not text:
        return ""

    cleaned = text

    # Strip §§ include directives
    cleaned = re.sub(r"§§[^§]*§§", "", cleaned)

    # Map agent references to role names (preserve context, hide internals)
    _AGENT_REPLACEMENTS = {
        "Agent Zero": "GM", "Agent 0": "GM",
        "Agent 1": "Assistant GM", "Agent 2": "Executive Chef",
        "Agent 3": "Sous Chef", "Agent 4": "Marketing Manager",
    }
    for pattern, role in _AGENT_REPLACEMENTS.items():
        cleaned = re.sub(re.escape(pattern), role, cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bsubagent\b", "", cleaned, flags=re.IGNORECASE)

    # Strip delegation syntax
    cleaned = re.sub(r'call_subordinate\(["\'][^"\']*["\']\)', "", cleaned)
    cleaned = re.sub(r"\bsubordinate\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bsuperior\b", "", cleaned, flags=re.IGNORECASE)

    # Strip "from subordinate:" prefix
    cleaned = re.sub(r"(?i)^(from\s+)?subordinate\s*:\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"(?i)reporting\s+to\s+superior\s*:\s*", "", cleaned)

    # Strip tool name references
    tool_names = [
        "order_tool", "inventory_tool", "prep_tool", "food_cost_tool",
        "menu_tool", "marketing_tool", "invoice_tool", "recipe_tool",
        "reporting_tool", "ping_tool", "code_execution_tool",
    ]
    for tool in tool_names:
        cleaned = cleaned.replace(tool, "")

    # Collapse whitespace
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"  +", " ", cleaned)

    return cleaned.strip()
```

- [ ] **Step 2: Update main.py to use the standalone module**

In `engine/main.py`, replace the inline `clean_response` and `clean_status_detail` functions with imports:

```python
from carabiner.domain.response_cleaning import clean_response, clean_status_detail
```

Remove the old `clean_response` and `clean_status_detail` function definitions from main.py (around lines 80-120). Keep the agent role map in the new module.

- [ ] **Step 3: Update the response cleaning extension to share the same module**

Update `engine/carabiner/agent_overlay/extensions/response_stream_chunk/_25_response_cleaning.py` to use the shared cleaning function:

```python
from python.helpers.extension import Extension

class ResponseCleaning(Extension):
    async def execute(self, **kwargs):
        # Import here to avoid circular imports at module level
        from carabiner.domain.response_cleaning import clean_response

        chunk = kwargs.get("chunk", "")
        if not chunk:
            return

        cleaned = clean_response(chunk)
        kwargs["chunk"] = cleaned
```

This replaces the current inline regex patterns with the shared `clean_response` function, ensuring both the streaming extension and the final response cleaning use identical patterns. The extension previously replaced tool names with operational language (e.g., `inventory_tool` → "inventory check") — the new shared function maps agent numbers to role names (Agent 0 → GM) instead of stripping entirely, preserving context while hiding internals.

- [ ] **Step 4: Run tests**

Run: `cd engine && python3 -m pytest tests/test_response_cleaning.py -v`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add engine/carabiner/domain/response_cleaning.py engine/main.py engine/carabiner/agent_overlay/extensions/response_stream_chunk/_25_response_cleaning.py
git commit -m "fix: extract response cleaning to standalone module, comprehensive patterns"
```

---

## Task 3: Status Event Protocol

**Files:**
- Create: `engine/carabiner/domain/status_protocol.py`
- Create: `engine/tests/test_status_protocol.py`

- [ ] **Step 1: Write status protocol tests**

Create `engine/tests/test_status_protocol.py`:

```python
"""Tests for structured status event protocol."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from carabiner.domain.status_protocol import (
    StatusEvent,
    make_thinking_event,
    make_delegating_event,
    make_tool_calling_event,
    make_tool_complete_event,
    make_completed_event,
    make_error_event,
    status_event_from_log,
)


class TestStatusEvent:
    def test_thinking_event(self):
        event = make_thinking_event("gm")
        assert event["state"] == "thinking"
        assert event["agent_name"] == "GM"
        assert "timestamp" in event

    def test_delegating_event(self):
        event = make_delegating_event("gm", "agm")
        assert event["state"] == "delegating"
        assert event["agent_name"] == "GM"
        assert event["target"] == "Assistant GM"

    def test_tool_calling_event(self):
        event = make_tool_calling_event("agm", "inventory_tool", "inventory")
        assert event["state"] == "tool_calling"
        assert event["tool"] == "inventory_tool"
        assert event["module"] == "inventory"

    def test_completed_event(self):
        event = make_completed_event("agm", "inventory_tool")
        assert event["state"] == "completed"

    def test_error_event(self):
        event = make_error_event("gm", "Connection timeout")
        assert event["state"] == "error"
        assert "timeout" in event["text"].lower()

    def test_log_to_event_tool_type(self):
        log_entry = {"type": "tool", "heading": "inventory_tool", "content": "checking levels"}
        event = status_event_from_log(log_entry, agent_number=1)
        assert event is not None
        assert event["state"] == "tool_calling"

    def test_log_to_event_agent_type(self):
        log_entry = {"type": "agent", "heading": "call_subordinate", "content": "agm"}
        event = status_event_from_log(log_entry, agent_number=0)
        assert event is not None
        assert event["state"] == "delegating"

    def test_log_to_event_skips_user(self):
        log_entry = {"type": "user", "heading": "", "content": "hello"}
        event = status_event_from_log(log_entry, agent_number=0)
        assert event is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd engine && python3 -m pytest tests/test_status_protocol.py -v`
Expected: FAIL — module not yet created

- [ ] **Step 3: Implement status protocol**

Create `engine/carabiner/domain/status_protocol.py`:

```python
"""Structured status event protocol for agent-to-frontend communication.

Events flow: main.py polling loop -> Socket.IO -> frontend status pill.
Each event carries enough data for the frontend to render the delegation chain.
"""
from __future__ import annotations
import time
from typing import TypedDict, Optional

AGENT_ROLE_MAP = {
    "0": "GM",
    "1": "Assistant GM",
    "2": "Executive Chef",
    "3": "Sous Chef",
    "4": "Marketing Manager",
    "gm": "GM",
    "agm": "Assistant GM",
    "executivechef": "Executive Chef",
    "souschef": "Sous Chef",
    "marketing": "Marketing Manager",
}

TOOL_MODULE_MAP = {
    "order_tool": "orders",
    "inventory_tool": "inventory",
    "prep_tool": "prep",
    "food_cost_tool": "food-cost",
    "menu_tool": "menu",
    "marketing_tool": "marketing",
    "invoice_tool": "invoices",
    "recipe_tool": "recipes",
    "reporting_tool": "reporting",
}


class StatusEvent(TypedDict, total=False):
    state: str  # thinking, delegating, tool_calling, completed, error
    agent_name: str
    text: str
    target: str
    tool: str
    module: str
    timestamp: float


def _resolve_role(agent_id: str | int) -> str:
    return AGENT_ROLE_MAP.get(str(agent_id), f"Agent {agent_id}")


def make_thinking_event(agent_id: str | int) -> StatusEvent:
    role = _resolve_role(agent_id)
    return StatusEvent(
        state="thinking",
        agent_name=role,
        text=f"{role} is thinking...",
        timestamp=time.time(),
    )


def make_delegating_event(from_agent: str | int, to_agent: str | int) -> StatusEvent:
    from_role = _resolve_role(from_agent)
    to_role = _resolve_role(to_agent)
    return StatusEvent(
        state="delegating",
        agent_name=from_role,
        target=to_role,
        text=f"{from_role} → {to_role}",
        timestamp=time.time(),
    )


def make_tool_calling_event(agent_id: str | int, tool_name: str, module: str | None = None) -> StatusEvent:
    role = _resolve_role(agent_id)
    resolved_module = module or TOOL_MODULE_MAP.get(tool_name, "")
    return StatusEvent(
        state="tool_calling",
        agent_name=role,
        tool=tool_name,
        module=resolved_module,
        text=f"{role} → {tool_name.replace('_', ' ')}",
        timestamp=time.time(),
    )


def make_tool_complete_event(agent_id: str | int, tool_name: str) -> StatusEvent:
    role = _resolve_role(agent_id)
    return StatusEvent(
        state="completed",
        agent_name=role,
        tool=tool_name,
        text=f"Completed via {tool_name.replace('_', ' ')}",
        timestamp=time.time(),
    )


def make_completed_event(agent_id: str | int, tool_name: str | None = None) -> StatusEvent:
    role = _resolve_role(agent_id)
    text = f"Completed via {tool_name.replace('_', ' ')}" if tool_name else f"{role} finished"
    return StatusEvent(
        state="completed",
        agent_name=role,
        text=text,
        timestamp=time.time(),
    )


def make_error_event(agent_id: str | int, error_msg: str) -> StatusEvent:
    role = _resolve_role(agent_id)
    return StatusEvent(
        state="error",
        agent_name=role,
        text=f"{role}: {error_msg[:100]}",
        timestamp=time.time(),
    )


def status_event_from_log(log_entry: dict, agent_number: int = 0) -> Optional[StatusEvent]:
    """Convert an Agent Zero log entry to a StatusEvent.

    Log entries have: type (tool/agent/progress/response/user), heading, content.
    """
    log_type = log_entry.get("type", "")
    heading = log_entry.get("heading", "")
    content = log_entry.get("content", "")

    if log_type == "user":
        return None

    if log_type == "tool":
        tool_name = heading or content
        return make_tool_calling_event(agent_number, tool_name)

    if log_type == "agent":
        if "call_subordinate" in heading:
            target = content.strip().strip('"').strip("'")
            return make_delegating_event(agent_number, target)
        return make_thinking_event(agent_number)

    if log_type == "progress":
        return StatusEvent(
            state="thinking",
            agent_name=_resolve_role(agent_number),
            text=content[:120] if content else "Processing...",
            timestamp=time.time(),
        )

    if log_type == "response":
        return make_completed_event(agent_number)

    return None
```

- [ ] **Step 4: Run tests**

Run: `cd engine && python3 -m pytest tests/test_status_protocol.py -v`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add engine/carabiner/domain/status_protocol.py engine/tests/test_status_protocol.py
git commit -m "feat: structured status event protocol for agent-to-frontend pipeline"
```

---

## Task 4: Action Card Protocol

**Files:**
- Create: `engine/carabiner/domain/action_card_protocol.py`
- Create: `engine/tests/test_action_card_protocol.py`

- [ ] **Step 1: Write action card protocol tests**

Create `engine/tests/test_action_card_protocol.py`:

```python
"""Tests for tool result → action card conversion."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from carabiner.domain.action_card_protocol import build_action_card


class TestBuildActionCard:
    def test_inventory_card(self):
        additional = {
            "module": "inventory",
            "action": "update",
            "item": {
                "item_name": "Hass Avocados",
                "on_hand": "11",
                "par": "10",
                "variance": "+1",
                "vendor": "Sysco",
            },
            "item_id": "abc-123",
        }
        card = build_action_card(additional)
        assert card is not None
        assert card["module"] == "inventory"
        assert card["title"] == "Hass Avocados"
        assert len(card["fields"]) > 0
        assert card["item_id"] == "abc-123"

    def test_orders_card(self):
        additional = {
            "module": "orders",
            "action": "update",
            "item": {
                "vendor": "Sysco",
                "status": "Sent",
                "total": "$450.00",
            },
        }
        card = build_action_card(additional)
        assert card is not None
        assert card["module"] == "orders"

    def test_returns_none_for_list_actions(self):
        additional = {"module": "inventory", "action": "list"}
        card = build_action_card(additional)
        assert card is None  # Don't create cards for read-only queries

    def test_returns_none_without_module(self):
        card = build_action_card({})
        assert card is None

    def test_returns_none_without_item(self):
        additional = {"module": "inventory", "action": "update"}
        card = build_action_card(additional)
        assert card is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd engine && python3 -m pytest tests/test_action_card_protocol.py -v`
Expected: FAIL

- [ ] **Step 3: Implement action card protocol**

Create `engine/carabiner/domain/action_card_protocol.py`:

```python
"""Convert tool response.additional dicts into action card payloads.

Action cards are emitted via Socket.IO to the frontend, where they render
as interactive notification cards in the right rail alongside the chat.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional

# Actions that produce cards (mutations, not reads)
CARD_ACTIONS = {"update", "create", "approve", "dispute", "link", "check_variances", "check_readiness", "analyze", "engineering_report"}

# Module-specific field extractors
FIELD_EXTRACTORS = {
    "inventory": [
        ("On hand", "on_hand", None),
        ("Par", "par", None),
        ("Variance", "variance", lambda v: "success" if v.startswith("+") else "danger"),
        ("Vendor", "vendor", None),
    ],
    "orders": [
        ("Vendor", "vendor", None),
        ("Status", "status", None),
        ("Total", "total", None),
        ("ETA", "eta", None),
    ],
    "prep": [
        ("Station", "station", None),
        ("Status", "readiness", lambda v: "success" if v == "Ready" else ("warning" if v == "At Risk" else "danger")),
        ("Shortage", "shortage", lambda v: "danger" if v else None),
    ],
    "food-cost": [
        ("Cost %", "current_cost_pct", lambda v: "danger" if float(v.rstrip("%")) > 33 else "success"),
        ("Pressure", "pressure", None),
        ("Action", "action", None),
    ],
    "menu": [
        ("Category", "category", None),
        ("Performance", "performance", None),
        ("Margin", "margin_pct", None),
    ],
    "marketing": [
        ("Channel", "channel", None),
        ("Stage", "stage", None),
        ("Reach", "reach", None),
    ],
    "invoices": [
        ("Vendor", "vendor_name", None),
        ("Total", "total", None),
        ("Lines", "line_count", None),
        ("Status", "status", None),
    ],
    "recipes": [
        ("Category", "category", None),
        ("Status", "status", None),
        ("Components", "component_count", None),
        ("Est. Cost", "estimated_cost", None),
    ],
    "reporting": [
        ("Revenue", "revenue", None),
        ("Food Cost %", "food_cost_pct", None),
        ("Labor %", "labor_pct", None),
    ],
}


def build_action_card(additional: dict) -> Optional[dict]:
    """Build an action card payload from a tool's response.additional dict.

    Returns None if the action is read-only or data is insufficient.
    """
    module = additional.get("module")
    action = additional.get("action", "")
    item = additional.get("item")

    if not module:
        return None

    if action not in CARD_ACTIONS:
        return None

    if not item and action in {"update", "create", "approve", "dispute", "link"}:
        return None

    # Build fields from item data
    fields = []
    extractors = FIELD_EXTRACTORS.get(module, [])
    item_data = item if isinstance(item, dict) else {}

    for label, key, highlight_fn in extractors:
        value = item_data.get(key)
        if value is not None:
            field = {"label": label, "value": str(value)}
            if highlight_fn:
                hl = highlight_fn(str(value))
                if hl:
                    field["highlight"] = hl
            fields.append(field)

    # Determine title
    title = (
        item_data.get("item_name")
        or item_data.get("name")
        or item_data.get("vendor")
        or item_data.get("campaign_name")
        or item_data.get("recipe_name")
        or f"{module} {action}"
    )

    return {
        "id": str(uuid.uuid4()),
        "module": module,
        "action": action,
        "title": title,
        "fields": fields,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "item_id": additional.get("item_id"),
        "status": "completed",
    }
```

- [ ] **Step 4: Run tests**

Run: `cd engine && python3 -m pytest tests/test_action_card_protocol.py -v`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add engine/carabiner/domain/action_card_protocol.py engine/tests/test_action_card_protocol.py
git commit -m "feat: action card protocol — converts tool results to frontend card payloads"
```

---

## Task 5: Standardize Tool Response Additional Dicts

**Files:**
- Modify: All 9 tool files in `engine/carabiner/agent_overlay/tools/`

- [ ] **Step 1: Update order_tool.py**

Ensure every Response in `order_tool.py` includes a well-structured `additional` dict with `module`, `action`, `item_id`, and `item` (dict with key-value fields for the card). For `list` actions, include `module` and `action` but no `item`. For `update`/`get`, include the item data.

Example for the update method:
```python
return Response(
    message=f"Updated order {order['vendor']}: status → {status}",
    break_loop=False,
    additional={
        "module": "orders",
        "action": "update",
        "item_id": str(order["id"]),
        "item": {
            "vendor": order.get("vendor", ""),
            "status": status or order.get("status", ""),
            "total": str(order.get("total", "")),
            "eta": order.get("eta", ""),
        },
    },
)
```

- [ ] **Step 2: Update inventory_tool.py**

Same pattern: add `item` dict with `item_name`, `on_hand`, `par`, `variance`, `vendor` fields.

- [ ] **Step 3: Update remaining tools**

Apply the same standardization to: `prep_tool.py`, `food_cost_tool.py`, `menu_tool.py`, `marketing_tool.py`, `invoice_tool.py`, `recipe_tool.py`, `reporting_tool.py`.

Each tool's `additional.item` should contain the fields defined in `FIELD_EXTRACTORS` for its module in `action_card_protocol.py`.

- [ ] **Step 4: Run all tests**

Run: `cd engine && python3 -m pytest tests/ -v`
Expected: All existing + new tests pass

- [ ] **Step 5: Commit**

```bash
git add engine/carabiner/agent_overlay/tools/
git commit -m "feat: standardize tool response.additional for action card protocol"
```

---

## Task 6: Integrate Status Protocol into main.py

**Files:**
- Modify: `engine/main.py`

- [ ] **Step 1: Import and use status protocol in polling loop**

In `engine/main.py`, replace the ad-hoc status event construction in the polling loop (lines ~184-231) with calls to `status_event_from_log()`:

```python
from carabiner.domain.status_protocol import (
    status_event_from_log,
    make_thinking_event,
    make_completed_event,
    make_error_event,
)
```

In the polling loop, replace:
```python
# Old: manual status construction
await sio.emit("status_update", {"state": ..., "text": ..., "role": ...}, room=sid)
```

With:
```python
# New: structured protocol
event = status_event_from_log(log_entry, agent_number=current_agent_number)
if event:
    await sio.emit("status_update", event, room=sid)
```

- [ ] **Step 2: Emit initial thinking event**

Replace the initial status emission (line ~156) with:
```python
await sio.emit("status_update", make_thinking_event("gm"), room=sid)
```

- [ ] **Step 3: Emit completion/error events**

After the response is received, emit:
```python
await sio.emit("status_update", make_completed_event("gm"), room=sid)
```

On exception:
```python
await sio.emit("status_update", make_error_event("gm", str(e)), room=sid)
```

- [ ] **Step 4: Run tests**

Run: `cd engine && python3 -m pytest tests/ -v`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add engine/main.py
git commit -m "feat: integrate structured status protocol into main.py polling loop"
```

---

## Task 7: Emit Action Card Events from WorkspaceSync

**Files:**
- Modify: `engine/carabiner/agent_overlay/extensions/tool_execute_after/_25_workspace_sync.py`

- [ ] **Step 1: Import and use action card protocol**

Update the workspace sync extension to emit `action_card` events:

```python
from carabiner.domain.action_card_protocol import build_action_card
```

After the existing `workspace_update` emission, add:

```python
# Build and emit action card if this was a mutation
card = build_action_card(additional)
if card and sio:
    await sio.emit("action_card", card)
```

This ensures every tool mutation that produces a card payload gets emitted as a separate Socket.IO event that the frontend's action cards rail can receive.

- [ ] **Step 2: Verify the extension still works with existing workspace_update**

The existing `workspace_update` event should continue to work for query invalidation. The new `action_card` event is an addition, not a replacement.

- [ ] **Step 3: Run tests**

Run: `cd engine && python3 -m pytest tests/ -v`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add engine/carabiner/agent_overlay/extensions/tool_execute_after/_25_workspace_sync.py
git commit -m "feat: emit action_card Socket.IO events from workspace sync extension"
```

---

## Task 8: Improve GM Delegation Prompt

**Files:**
- Modify: `engine/carabiner/agent_overlay/profiles/gm/prompts/agent.system.main.role.md`

- [ ] **Step 1: Enhance GM system prompt for reliable delegation**

Update the GM role prompt to be more explicit about delegation rules and response formatting:

```markdown
# CarabinerOS — General Manager

You are CarabinerOS, the AI-powered General Manager for a restaurant group. Talk like a seasoned GM — confident, direct, knowledgeable. You know restaurants inside and out.

## Your Team

Delegate tasks to your specialists by calling them by profile name:
- **agm** (Assistant GM) — Purchasing, vendor orders, inventory management, invoice processing
- **executivechef** (Executive Chef) — Food cost analysis, menu engineering, pricing strategy
- **souschef** (Sous Chef) — Prep lists, station readiness, kitchen operations
- **marketing** (Marketing Manager) — Campaigns, social media, competitive research, promotions

## Rules

1. **Always delegate** operational queries to the right specialist. Do NOT try to answer operational questions yourself.
2. **Multi-task parsing**: If the user asks for multiple things, delegate each to the appropriate specialist. You can delegate to multiple subordinates.
3. **Response language**: Always respond in natural business language. Never mention tool names, agent numbers, subordinates, or technical internals.
4. **Numbers matter**: Include specific quantities, percentages, dollar amounts. Restaurants run on precision.
5. **Be proactive**: If you see something concerning in a report (high food cost, low prep readiness), flag it.

## What NOT to say

Never reveal: tool names (order_tool, etc.), agent architecture, subordinate/superior relationships, Agent Zero, technical implementation details. You ARE the restaurant's management system — there is no "behind the scenes."
```

- [ ] **Step 2: Commit**

```bash
git add engine/carabiner/agent_overlay/profiles/gm/prompts/agent.system.main.role.md
git commit -m "fix: improve GM delegation prompt for reliable routing and clean responses"
```

---

## Task 9: Response Streaming Improvements

**Files:**
- Modify: `engine/main.py`

- [ ] **Step 1: Improve response streaming in main.py**

Currently, responses are streamed word-by-word with a 0.02s delay. Improve this:

1. Stream by sentence fragments (split on `. ` or `\n`) for more natural pacing
2. Include a `context_id` in every `response_stream` event so the frontend can filter
3. Include message `id` for deduplication

Update the streaming section (around line 234-247):

```python
# After getting final response and cleaning
cleaned = clean_response(response_text)
msg_id = str(uuid.uuid4())
words = cleaned.split()
accumulated = ""

for i, word in enumerate(words):
    accumulated += (" " if accumulated else "") + word
    await sio.emit("response_stream", {
        "chunk": word + " ",
        "full": accumulated,
        "context_id": context_id,
        "message_id": msg_id,
        "done": i == len(words) - 1,
    }, room=sid)
    await asyncio.sleep(0.02)
```

- [ ] **Step 2: Add uuid import if not present**

Ensure `import uuid` is at the top of main.py.

- [ ] **Step 3: Run tests**

Run: `cd engine && python3 -m pytest tests/ -v`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add engine/main.py
git commit -m "feat: improve response streaming with context_id and message_id"
```

---

## Task 10: Full Test Suite Run & Integration Verification

**Files:**
- All test files

- [ ] **Step 1: Run complete test suite**

Run: `cd engine && python3 -m pytest tests/ -v`
Expected: All tests pass (test_discovery, test_tools, test_response_cleaning, test_status_protocol, test_action_card_protocol)

- [ ] **Step 2: Verify overlay discovery still works**

Run: `cd engine && python3 -c "from bridge import AgentBridge; b = AgentBridge(); print(b.verify_overlay_discovery())"`
Expected: Shows all 10 tools, 3 extensions, 5 profiles

- [ ] **Step 3: Verify no import errors in new modules**

Run:
```bash
cd engine
python3 -c "from carabiner.domain.status_protocol import make_thinking_event; print(make_thinking_event('gm'))"
python3 -c "from carabiner.domain.action_card_protocol import build_action_card; print(build_action_card({'module': 'inventory', 'action': 'update', 'item': {'item_name': 'Test'}}))"
```
Expected: Both print valid dicts

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 2 complete — AI backbone fix with status protocol and action cards"
```
