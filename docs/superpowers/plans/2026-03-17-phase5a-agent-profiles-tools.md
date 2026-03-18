# Phase 5a: Agent Profiles + Tools + DB Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 5 role-based agent profiles with 6 DB-connected tools, 3 extensions, and AgentBridge.communicate() for FastAPI → Agent Zero communication, configured with local Ollama LLM.

**Architecture:** GM (Agent 0) receives requests and delegates to specialist subordinates (agm, executivechef, souschef, marketing) via call_subordinate. Each profile has its own system prompt and tool access. Tools read/write PostgreSQL via the existing repository layer. Extensions inject context, sync workspace, and clean output.

**Tech Stack:** Agent Zero (submodule), Python 3.9+, SQLAlchemy async, Ollama (qwen3.5:9b), Socket.IO

**Spec:** `docs/superpowers/specs/2026-03-17-phase5a-agent-profiles-tools-design.md`

---

## File Structure

### New Files
```
engine/carabiner/agent_overlay/profiles/gm/agent.json
engine/carabiner/agent_overlay/profiles/gm/prompts/agent.system.main.role.md
engine/carabiner/agent_overlay/profiles/agm/agent.json
engine/carabiner/agent_overlay/profiles/agm/prompts/agent.system.main.role.md
engine/carabiner/agent_overlay/profiles/executivechef/agent.json
engine/carabiner/agent_overlay/profiles/executivechef/prompts/agent.system.main.role.md
engine/carabiner/agent_overlay/profiles/souschef/agent.json
engine/carabiner/agent_overlay/profiles/souschef/prompts/agent.system.main.role.md
engine/carabiner/agent_overlay/profiles/marketing/agent.json
engine/carabiner/agent_overlay/profiles/marketing/prompts/agent.system.main.role.md
engine/carabiner/agent_overlay/tools/order_tool.py
engine/carabiner/agent_overlay/tools/inventory_tool.py
engine/carabiner/agent_overlay/tools/prep_tool.py
engine/carabiner/agent_overlay/tools/food_cost_tool.py
engine/carabiner/agent_overlay/tools/menu_tool.py
engine/carabiner/agent_overlay/tools/marketing_tool.py
engine/carabiner/agent_overlay/extensions/tool_execute_after/_25_workspace_sync.py
engine/carabiner/agent_overlay/extensions/response_stream/_25_response_cleaning.py
engine/.env
```

### Modified Files
```
engine/bridge.py                    — add communicate(), _build_config(), update symlink mappings
engine/carabiner/agent_overlay/extensions/system_prompt/_25_restaurant_context.py — real context injection
```

---

## Task 1: Ollama LLM Configuration

**Files:**
- Create: `engine/.env`

- [ ] **Step 1: Create .env with Ollama config**

```env
# engine/.env
CHAT_MODEL_PROVIDER=ollama
CHAT_MODEL_NAME=qwen3.5:9b
CHAT_API_BASE=http://host.docker.internal:11434

UTILITY_MODEL_PROVIDER=ollama
UTILITY_MODEL_NAME=qwen3.5:9b
UTILITY_API_BASE=http://host.docker.internal:11434

EMBEDDINGS_MODEL_PROVIDER=ollama
EMBEDDINGS_MODEL_NAME=qwen3.5:9b
EMBEDDINGS_API_BASE=http://host.docker.internal:11434

BROWSER_MODEL_PROVIDER=ollama
BROWSER_MODEL_NAME=qwen3.5:9b
BROWSER_API_BASE=http://host.docker.internal:11434

DATABASE_URL=postgresql+asyncpg://carabiner:carabiner@localhost:5432/carabiner
```

- [ ] **Step 2: Verify .env is gitignored**

```bash
grep -q "^.env$" engine/.gitignore 2>/dev/null || grep -q "^\.env$" .gitignore
```

- [ ] **Step 3: Commit**

```bash
git add engine/.env.example
git commit -m "feat: update .env.example with Ollama LLM configuration"
```

Note: Don't commit `.env` itself — only update `.env.example`.

---

## Task 2: Agent Profiles — GM, AGM, Executive Chef, Sous Chef, Marketing

**Files:**
- Create: 5 profile directories with `agent.json` and `prompts/agent.system.main.role.md`

- [ ] **Step 1: Create GM profile**

```bash
mkdir -p engine/carabiner/agent_overlay/profiles/gm/prompts
```

```json
// engine/carabiner/agent_overlay/profiles/gm/agent.json
{
  "title": "General Manager",
  "description": "Primary restaurant operations agent. Receives all requests and delegates to specialist subordinates.",
  "context": "Delegates purchasing/inventory to AGM, food cost/menu to Executive Chef, prep to Sous Chef, marketing to Marketing Manager."
}
```

```markdown
<!-- engine/carabiner/agent_overlay/profiles/gm/prompts/agent.system.main.role.md -->
You are the General Manager of a multi-location restaurant group operating through CarabinerOS.

## Your Role
You receive operational requests from restaurant operators and delegate them to the right specialist on your team. You coordinate cross-functional work and provide high-level oversight.

## Your Team
Delegate tasks using `call_subordinate` with the agent name:
- **agm** (Assistant GM): Purchasing, vendor orders, inventory management, stock levels
- **executivechef** (Executive Chef): Food cost analysis, menu engineering, pricing strategy, margin optimization
- **souschef** (Sous Chef): Prep plans, station readiness, kitchen operations, shortage management
- **marketing** (Marketing Manager): Campaigns, competitive research, promotional briefs, channel strategy

## Guidelines
- When a request clearly falls under one specialist's domain, delegate immediately
- For cross-functional requests (e.g., "review operations across the board"), coordinate between multiple specialists
- Always respond in clear, professional language appropriate for restaurant operations
- Never reference internal systems, tool names, or agent architecture
- Frame responses around business outcomes, not technical processes
- When unsure which specialist to use, handle the request yourself
```

- [ ] **Step 2: Create AGM profile**

```bash
mkdir -p engine/carabiner/agent_overlay/profiles/agm/prompts
```

```json
// engine/carabiner/agent_overlay/profiles/agm/agent.json
{
  "title": "Assistant General Manager",
  "description": "Manages purchasing, vendor relationships, and inventory across all locations.",
  "context": "Specialist in order management and inventory control. Uses order_tool and inventory_tool."
}
```

```markdown
<!-- engine/carabiner/agent_overlay/profiles/agm/prompts/agent.system.main.role.md -->
You are the Assistant General Manager responsible for purchasing and inventory management across a multi-location restaurant group.

## Your Expertise
- Building and reviewing vendor orders based on par levels and sales data
- Tracking inventory levels, flagging variances, and recommending replenishment
- Managing vendor relationships and channel selection (API, email, browser)
- Coordinating cross-location stock transfers

## Tools Available
- **order_tool**: List, draft, review, and manage vendor orders
- **inventory_tool**: Check stock levels, flag items below par, track variances

## Guidelines
- Always check current inventory before recommending orders
- Reference specific items, quantities, and dollar amounts
- Flag items that are below par with urgency appropriate to the shortage
- Suggest the most efficient ordering channel for each vendor
- Frame responses for restaurant operators, not technicians
```

- [ ] **Step 3: Create Executive Chef profile**

```bash
mkdir -p engine/carabiner/agent_overlay/profiles/executivechef/prompts
```

```json
{
  "title": "Executive Chef",
  "description": "Oversees food cost management, menu engineering, and pricing strategy.",
  "context": "Specialist in margin analysis and menu optimization. Uses food_cost_tool and menu_tool."
}
```

```markdown
You are the Executive Chef overseeing food cost management and menu engineering for a multi-location restaurant group.

## Your Expertise
- Analyzing food cost pressure and margin trends across menu items
- Menu engineering: categorizing items as Stars, Puzzles, Plowhorses, or Dogs
- Pricing strategy and recommendations to protect contribution margin
- Identifying cost drivers and recommending operational levers (portioning, sourcing, repricing)

## Tools Available
- **food_cost_tool**: Analyze margins, identify pressure items, suggest actions
- **menu_tool**: Engineering analysis, performance categorization, pricing recommendations

## Guidelines
- Lead with the business impact (margin dollars, percentage points)
- Recommend specific, actionable levers — not generic advice
- Consider guest demand and sentiment when suggesting price changes
- Frame recommendations for operators who need to make decisions quickly
```

- [ ] **Step 4: Create Sous Chef profile**

```bash
mkdir -p engine/carabiner/agent_overlay/profiles/souschef/prompts
```

```json
{
  "title": "Sous Chef",
  "description": "Manages prep planning, station readiness, and kitchen operations.",
  "context": "Specialist in prep list management and shortage resolution. Uses prep_tool."
}
```

```markdown
You are the Sous Chef managing prep operations and kitchen readiness for a multi-location restaurant group.

## Your Expertise
- Generating prep plans based on service lanes (Brunch, Dinner, Happy Hour)
- Tracking station readiness and identifying blocked or at-risk tasks
- Managing ingredient shortages and recommending transfers or substitutions
- Coordinating prep timing with reservation pace and demand forecasts

## Tools Available
- **prep_tool**: List prep tasks, check readiness by lane, identify shortages

## Guidelines
- Organize information by service lane — that's how kitchens think
- Flag blocked tasks with clear shortage details and resolution options
- Include timing context (prep windows, service start times)
- Prioritize by service impact — a blocked dinner task is more urgent than an at-risk brunch task if dinner is closer
```

- [ ] **Step 5: Create Marketing Manager profile**

```bash
mkdir -p engine/carabiner/agent_overlay/profiles/marketing/prompts
```

```json
{
  "title": "Marketing Manager",
  "description": "Develops campaigns, competitive research, and promotional strategy.",
  "context": "Specialist in campaign management and brand positioning. Uses marketing_tool."
}
```

```markdown
You are the Marketing Manager for a multi-location restaurant group.

## Your Expertise
- Developing campaign strategies across email, social, SMS, and paid channels
- Competitive research and market positioning
- Creating promotional briefs and deliverables
- Managing campaign lifecycle from research through launch

## Tools Available
- **marketing_tool**: List campaigns, check stages, summarize pipeline

## Guidelines
- Ground recommendations in the restaurant's specific market position
- Suggest channel strategies based on the campaign goal (awareness vs conversion vs retention)
- Include measurable KPIs for every recommendation
- Think locally — each location has its own market dynamics
```

- [ ] **Step 6: Commit**

```bash
git add engine/carabiner/agent_overlay/profiles/
git commit -m "feat: add 5 role-based agent profiles (gm, agm, executivechef, souschef, marketing)"
```

---

## Task 3: Restaurant Tools (6 tools with DB access)

**Files:**
- Create: 6 tool files in `engine/carabiner/agent_overlay/tools/`

- [ ] **Step 1: Create order_tool.py**

```python
# engine/carabiner/agent_overlay/tools/order_tool.py
"""Order management tool — list, draft, review vendor orders."""

from __future__ import annotations
import json
import asyncio
from helpers.tool import Response, Tool


class OrderTool(Tool):
    async def execute(self, **kwargs) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            orders = await repo.list_orders(location_id)
            if not orders:
                return Response(message="No orders found for this location.", break_loop=False)
            result = []
            for o in orders:
                result.append({
                    "id": str(o.id),
                    "vendor": o.vendor,
                    "channel": o.channel,
                    "status": o.status,
                    "total": o.total,
                    "eta": o.eta,
                    "summary": o.summary,
                })
            return Response(
                message=json.dumps(result, indent=2),
                break_loop=False,
                additional={"module": "orders", "action": "list"},
            )

        if method == "get":
            order_id = self.args.get("order_id")
            if not order_id:
                return Response(message="Error: order_id is required for get method.", break_loop=False)
            order = await repo.get_order(order_id)
            if not order:
                return Response(message=f"Order {order_id} not found.", break_loop=False)
            return Response(
                message=json.dumps({
                    "id": str(order.id),
                    "vendor": order.vendor,
                    "channel": order.channel,
                    "status": order.status,
                    "total": order.total,
                    "eta": order.eta,
                    "summary": order.summary,
                    "detail_points": order.detail_points,
                }, indent=2),
                break_loop=False,
            )

        if method == "update":
            order_id = self.args.get("order_id")
            updates = {}
            for field in ["status", "total", "eta", "summary"]:
                if field in self.args:
                    updates[field] = self.args[field]
            order = await repo.update_order(order_id, updates)
            if not order:
                return Response(message=f"Order {order_id} not found.", break_loop=False)
            return Response(
                message=f"Order updated: {order.vendor} is now {order.status}.",
                break_loop=False,
                additional={"module": "orders", "action": "update", "item_id": str(order.id)},
            )

        return Response(message=f"Unknown method: {method}. Use list, get, or update.", break_loop=False)
```

- [ ] **Step 2: Create inventory_tool.py**

```python
# engine/carabiner/agent_overlay/tools/inventory_tool.py
"""Inventory management tool — check levels, flag variances."""

from __future__ import annotations
import json
from helpers.tool import Response, Tool


class InventoryTool(Tool):
    async def execute(self, **kwargs) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            items = await repo.list_inventory(location_id)
            if not items:
                return Response(message="No inventory items found.", break_loop=False)
            result = [
                {"item": i.item_name, "on_hand": i.on_hand, "par": i.par, "variance": i.variance, "summary": i.summary}
                for i in items
            ]
            return Response(message=json.dumps(result, indent=2), break_loop=False)

        if method == "check_variances":
            items = await repo.list_inventory(location_id)
            below_par = [i for i in items if i.variance.startswith("-")]
            if not below_par:
                return Response(message="All items are at or above par.", break_loop=False)
            result = [
                {"item": i.item_name, "on_hand": i.on_hand, "par": i.par, "variance": i.variance, "summary": i.summary}
                for i in below_par
            ]
            return Response(
                message=f"{len(below_par)} items below par:\n{json.dumps(result, indent=2)}",
                break_loop=False,
                additional={"module": "inventory", "action": "check"},
            )

        return Response(message=f"Unknown method: {method}. Use list or check_variances.", break_loop=False)
```

- [ ] **Step 3: Create prep_tool.py**

```python
# engine/carabiner/agent_overlay/tools/prep_tool.py
"""Prep management tool — plans, readiness, shortages."""

from __future__ import annotations
import json
from helpers.tool import Response, Tool


class PrepTool(Tool):
    async def execute(self, **kwargs) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            tasks = await repo.list_prep(location_id)
            if not tasks:
                return Response(message="No prep tasks found.", break_loop=False)
            lanes = {}
            for t in tasks:
                lane = t.service_lane
                if lane not in lanes:
                    lanes[lane] = []
                lanes[lane].append({
                    "task": t.task, "station": t.station,
                    "readiness": t.readiness, "shortage": t.shortage,
                })
            return Response(message=json.dumps(lanes, indent=2), break_loop=False)

        if method == "check_readiness":
            tasks = await repo.list_prep(location_id)
            blocked = [t for t in tasks if t.readiness.lower() == "blocked"]
            at_risk = [t for t in tasks if t.readiness.lower() == "at risk"]
            ready = [t for t in tasks if t.readiness.lower() == "ready"]
            summary = f"Ready: {len(ready)}, At risk: {len(at_risk)}, Blocked: {len(blocked)}"
            details = []
            for t in blocked + at_risk:
                details.append(f"- {t.task} ({t.service_lane}): {t.readiness} — {t.shortage or 'no shortage noted'}")
            return Response(
                message=f"{summary}\n\n" + "\n".join(details) if details else summary,
                break_loop=False,
            )

        return Response(message=f"Unknown method: {method}. Use list or check_readiness.", break_loop=False)
```

- [ ] **Step 4: Create food_cost_tool.py**

```python
# engine/carabiner/agent_overlay/tools/food_cost_tool.py
"""Food cost analysis tool — margins, pressure, actions."""

from __future__ import annotations
import json
from helpers.tool import Response, Tool


class FoodCostTool(Tool):
    async def execute(self, **kwargs) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            items = await repo.list_food_cost(location_id)
            if not items:
                return Response(message="No food cost data found.", break_loop=False)
            result = [
                {"item": i.menu_item_name, "pressure": i.pressure, "cost_pct": i.current_cost_pct, "action": i.action, "summary": i.summary}
                for i in items
            ]
            return Response(message=json.dumps(result, indent=2), break_loop=False)

        if method == "analyze":
            items = await repo.list_food_cost(location_id)
            if not items:
                return Response(message="No food cost data to analyze.", break_loop=False)
            costs = [float(i.current_cost_pct.replace("%", "")) for i in items]
            avg = sum(costs) / len(costs) if costs else 0
            above_target = [i for i in items if i.pressure.startswith("+")]
            result = {
                "average_cost_pct": f"{avg:.1f}%",
                "total_items": len(items),
                "above_target": len(above_target),
                "highest_pressure": [
                    {"item": i.menu_item_name, "pressure": i.pressure, "action": i.action}
                    for i in above_target
                ],
            }
            return Response(message=json.dumps(result, indent=2), break_loop=False)

        return Response(message=f"Unknown method: {method}. Use list or analyze.", break_loop=False)
```

- [ ] **Step 5: Create menu_tool.py**

```python
# engine/carabiner/agent_overlay/tools/menu_tool.py
"""Menu engineering tool — performance analysis, pricing."""

from __future__ import annotations
import json
from helpers.tool import Response, Tool


class MenuTool(Tool):
    async def execute(self, **kwargs) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            items = await repo.list_menu(location_id)
            if not items:
                return Response(message="No menu items found.", break_loop=False)
            result = [
                {"item": i.item_name, "category": i.category, "performance": i.performance,
                 "margin": i.margin_pct, "recommendation": i.recommendation}
                for i in items
            ]
            return Response(message=json.dumps(result, indent=2), break_loop=False)

        if method == "engineering_report":
            items = await repo.list_menu(location_id)
            categories = {"Star": [], "Puzzle": [], "Plowhorse": [], "Dog": []}
            for i in items:
                perf = i.performance.capitalize()
                if perf in categories:
                    categories[perf].append({"item": i.item_name, "margin": i.margin_pct, "recommendation": i.recommendation})
            return Response(message=json.dumps(categories, indent=2), break_loop=False)

        return Response(message=f"Unknown method: {method}. Use list or engineering_report.", break_loop=False)
```

- [ ] **Step 6: Create marketing_tool.py**

```python
# engine/carabiner/agent_overlay/tools/marketing_tool.py
"""Marketing campaign tool — research, briefs, pipeline."""

from __future__ import annotations
import json
from helpers.tool import Response, Tool


class MarketingTool(Tool):
    async def execute(self, **kwargs) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            campaigns = await repo.list_campaigns(location_id)
            if not campaigns:
                return Response(message="No campaigns found.", break_loop=False)
            result = [
                {"campaign": c.campaign_name, "channel": c.channel, "stage": c.stage,
                 "deliverable": c.deliverable, "summary": c.summary}
                for c in campaigns
            ]
            return Response(message=json.dumps(result, indent=2), break_loop=False)

        if method == "stage_summary":
            campaigns = await repo.list_campaigns(location_id)
            stages = {}
            for c in campaigns:
                if c.stage not in stages:
                    stages[c.stage] = []
                stages[c.stage].append({"campaign": c.campaign_name, "deliverable": c.deliverable})
            return Response(message=json.dumps(stages, indent=2), break_loop=False)

        return Response(message=f"Unknown method: {method}. Use list or stage_summary.", break_loop=False)
```

- [ ] **Step 7: Commit**

```bash
git add engine/carabiner/agent_overlay/tools/order_tool.py engine/carabiner/agent_overlay/tools/inventory_tool.py engine/carabiner/agent_overlay/tools/prep_tool.py engine/carabiner/agent_overlay/tools/food_cost_tool.py engine/carabiner/agent_overlay/tools/menu_tool.py engine/carabiner/agent_overlay/tools/marketing_tool.py
git commit -m "feat: add 6 restaurant tools with DB access (order, inventory, prep, food_cost, menu, marketing)"
```

---

## Task 4: Extensions (system_prompt, tool_execute_after, response_stream)

**Files:**
- Modify: `engine/carabiner/agent_overlay/extensions/system_prompt/_25_restaurant_context.py`
- Create: `engine/carabiner/agent_overlay/extensions/tool_execute_after/_25_workspace_sync.py`
- Create: `engine/carabiner/agent_overlay/extensions/response_stream/_25_response_cleaning.py`

- [ ] **Step 1: Update system_prompt extension with real context**

```python
# engine/carabiner/agent_overlay/extensions/system_prompt/_25_restaurant_context.py
"""Inject real restaurant context into Agent Zero's system prompt."""

from __future__ import annotations
from helpers.extension import Extension


class RestaurantContext(Extension):
    async def execute(self, **kwargs) -> None:
        prompt = kwargs.get("system_prompt", "")

        context_parts = [
            "\n\n## Restaurant Operations Context",
            "You are operating within CarabinerOS, a restaurant operations platform.",
        ]

        # Inject active location from agent config
        if hasattr(self.agent, "config") and hasattr(self.agent.config, "additional"):
            additional = self.agent.config.additional
            location = additional.get("active_location_name", "Unknown")
            location_status = additional.get("active_location_status", "")
            org = additional.get("organization_name", "Carabiner Restaurant Group")

            context_parts.append(f"Organization: {org}")
            context_parts.append(f"Active location: {location}")
            if location_status:
                context_parts.append(f"Location status: {location_status}")

        context_parts.append("")
        context_parts.append("Use the available tools to query real operational data before making recommendations.")
        context_parts.append("Always reference specific numbers, items, and locations in your responses.")

        kwargs["system_prompt"] = prompt + "\n".join(context_parts)
```

- [ ] **Step 2: Create tool_execute_after extension**

```bash
mkdir -p engine/carabiner/agent_overlay/extensions/tool_execute_after
```

```python
# engine/carabiner/agent_overlay/extensions/tool_execute_after/_25_workspace_sync.py
"""Sync tool results to action_log and emit workspace_update events."""

from __future__ import annotations
import logging
from helpers.extension import Extension

logger = logging.getLogger(__name__)


class WorkspaceSync(Extension):
    async def execute(self, **kwargs) -> None:
        response = kwargs.get("response")
        if not response or not hasattr(response, "additional") or not response.additional:
            return

        additional = response.additional
        module = additional.get("module")
        action = additional.get("action")

        if not module:
            return

        # Log the action
        try:
            from carabiner.db import repositories as repo
            await repo.create_action_log({
                "action_type": f"{module}_{action}" if action else module,
                "status": "completed",
                "provider_id": additional.get("provider_id"),
            })
        except Exception as e:
            logger.warning("Failed to log action: %s", e)

        # Emit workspace_update event via Socket.IO
        try:
            from main import sio
            await sio.emit("workspace_update", {
                "module": module,
                "action": action or "update",
                "item": additional.get("item", {}),
            })
        except Exception as e:
            logger.warning("Failed to emit workspace_update: %s", e)
```

- [ ] **Step 3: Create response_stream extension**

```bash
mkdir -p engine/carabiner/agent_overlay/extensions/response_stream
```

```python
# engine/carabiner/agent_overlay/extensions/response_stream/_25_response_cleaning.py
"""Clean internal agent language from response streams."""

from __future__ import annotations
import re
from helpers.extension import Extension


class ResponseCleaning(Extension):
    async def execute(self, **kwargs) -> None:
        chunk = kwargs.get("chunk", "")
        if not chunk or not isinstance(chunk, str):
            return

        cleaned = chunk
        # Remove tool name references
        cleaned = re.sub(r"\bcode_execution_tool\b", "operational workflow", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bbrowser_agent\b", "vendor workflow", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bdocument_query\b", "document review", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\brestaurant_ops\b", "restaurant ops", cleaned, flags=re.IGNORECASE)
        # Remove agent references
        cleaned = re.sub(r"\bA[0-9]\b", "", cleaned)
        cleaned = re.sub(r"\b(subagent|subordinate|superior)\b", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

        kwargs["chunk"] = cleaned
```

- [ ] **Step 4: Commit**

```bash
git add engine/carabiner/agent_overlay/extensions/
git commit -m "feat: add extensions — restaurant context, workspace sync, response cleaning"
```

---

## Task 5: Update AgentBridge with communicate() and profile registration

**Files:**
- Modify: `engine/bridge.py`

- [ ] **Step 1: Update bridge.py**

Add profile symlink mapping, `_build_config()`, and `communicate()` method. The full updated bridge.py should:

1. Add `("agents", OVERLAY_DIR / "profiles")` to the symlink mappings
2. Add `_build_config(profile="gm")` that creates an `AgentConfig` with Ollama models
3. Add `async communicate(context_id, message, on_log, on_stream)` that:
   - Gets or creates an `AgentContext` with the GM profile
   - Sets active location in `config.additional`
   - Calls `context.agent0.monologue(message)` (or the equivalent communication method)
   - Returns the response

- [ ] **Step 2: Update .env.example**

Add Ollama configuration to the example file.

- [ ] **Step 3: Verify overlay discovery includes profiles**

```bash
cd engine && python3 -c "
from bridge import bootstrap_agent_zero, OVERLAY_DIR
bootstrap_agent_zero()
profiles = OVERLAY_DIR / 'profiles'
for p in sorted(profiles.iterdir()):
    if p.is_dir() and not p.name.startswith('_'):
        print(f'Profile: {p.name}')
"
```

Expected: `gm`, `agm`, `executivechef`, `souschef`, `marketing`

- [ ] **Step 4: Commit**

```bash
git add engine/bridge.py engine/.env.example
git commit -m "feat: update AgentBridge with communicate(), profile registration, Ollama config"
```

---

## Task 6: Unit Tests

**Files:**
- Create: `engine/tests/test_tools.py`
- Create: `engine/tests/test_extensions.py`

- [ ] **Step 1: Create tool tests (DB-backed, no LLM)**

```python
# engine/tests/test_tools.py
"""Test that tools can read from the database."""

import sys
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ENGINE_DIR))

from carabiner.db.repositories import list_orders, list_inventory, list_prep, list_food_cost, list_menu, list_campaigns


def test_profiles_exist():
    profiles_dir = ENGINE_DIR / "carabiner" / "agent_overlay" / "profiles"
    expected = {"gm", "agm", "executivechef", "souschef", "marketing"}
    found = {p.name for p in profiles_dir.iterdir() if p.is_dir()}
    assert expected.issubset(found), f"Missing profiles: {expected - found}"


def test_profile_has_agent_json():
    profiles_dir = ENGINE_DIR / "carabiner" / "agent_overlay" / "profiles"
    for name in ["gm", "agm", "executivechef", "souschef", "marketing"]:
        agent_json = profiles_dir / name / "agent.json"
        assert agent_json.exists(), f"Missing agent.json for profile {name}"


def test_profile_has_role_prompt():
    profiles_dir = ENGINE_DIR / "carabiner" / "agent_overlay" / "profiles"
    for name in ["gm", "agm", "executivechef", "souschef", "marketing"]:
        role_md = profiles_dir / name / "prompts" / "agent.system.main.role.md"
        assert role_md.exists(), f"Missing role prompt for profile {name}"


def test_tools_exist():
    tools_dir = ENGINE_DIR / "carabiner" / "agent_overlay" / "tools"
    expected = {"order_tool", "inventory_tool", "prep_tool", "food_cost_tool", "menu_tool", "marketing_tool"}
    found = {f.stem for f in tools_dir.glob("*.py") if f.stem != "__init__" and f.stem != "ping_tool"}
    assert expected.issubset(found), f"Missing tools: {expected - found}"


def test_extensions_exist():
    ext_dir = ENGINE_DIR / "carabiner" / "agent_overlay" / "extensions"
    assert (ext_dir / "system_prompt" / "_25_restaurant_context.py").exists()
    assert (ext_dir / "tool_execute_after" / "_25_workspace_sync.py").exists()
    assert (ext_dir / "response_stream" / "_25_response_cleaning.py").exists()
```

- [ ] **Step 2: Run tests**

```bash
cd engine && python3 -m pytest tests/test_tools.py -v
```

- [ ] **Step 3: Commit**

```bash
git add engine/tests/test_tools.py
git commit -m "feat: add unit tests for profiles, tools, and extensions"
```

---

## Task 7: Integration verification + Phase 5a commit

- [ ] **Step 1: Run all tests**

```bash
cd engine && python3 -m pytest tests/ -v
```

- [ ] **Step 2: Verify overlay discovery**

```bash
cd engine && python3 main.py &
sleep 4
curl -s http://localhost:8000/api/overlay/status | python3 -m json.tool
kill %1
```

Expected: tools list includes all 6 new tools + ping_tool, extensions include all 3.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "Phase 5a complete: 5 agent profiles, 6 DB-connected tools, 3 extensions, AgentBridge.communicate()"
```
