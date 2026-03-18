# Phase 5a: Agent Profiles + Tools + DB Wiring — Design Spec

## Goal

Build role-based agent profiles (GM, AGM, Executive Chef, Sous Chef, Marketing Manager) with specialized tools that read/write the PostgreSQL database, plus extensions for restaurant context injection, workspace sync, and response cleaning. Wire AgentBridge.communicate() to enable FastAPI → Agent Zero communication. Configure local Ollama LLM.

## Architecture

```
User message → AgentBridge.communicate(context_id, message)
  → AgentContext with GM profile (Agent 0)
  → system_prompt extension injects restaurant context (location, priorities)
  → GM analyzes request, delegates via call_subordinate("executivechef")
  → Executive Chef (Agent 1) spawns with food_cost_tool, menu_tool
  → Tool reads/writes PostgreSQL via carabiner.db.repositories
  → tool_execute_after extension: logs action to DB, emits workspace_update
  → response_stream extension: cleans internal agent language
  → Response flows back: Agent 1 → GM → AgentBridge → caller
```

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent hierarchy | GM (A0) delegates to named subordinates | Maps to real restaurant org chart |
| Profile location | `carabiner/agent_overlay/profiles/` | Overlay pattern — non-invasive to submodule |
| Tool granularity | One tool per function | Easier to debug, test, and assign to agents |
| DB access | Tools import from `carabiner.db.repositories` | Typed async CRUD, already built |
| LLM | Local Ollama `qwen3.5:9b` | User's existing setup, no API costs |
| Profile names | `gm`, `agm`, `executivechef`, `souschef`, `marketing` | Clean, no prefix |

## LLM Configuration

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
```

## File Structure

### New Files

```
carabiner/agent_overlay/profiles/
├── gm/
│   ├── agent.json                          — GM metadata
│   └── prompts/
│       └── agent.system.main.role.md       — GM system prompt
├── agm/
│   ├── agent.json
│   └── prompts/
│       └── agent.system.main.role.md       — AGM: purchasing + inventory
├── executivechef/
│   ├── agent.json
│   └── prompts/
│       └── agent.system.main.role.md       — Exec Chef: food cost + menu
├── souschef/
│   ├── agent.json
│   └── prompts/
│       └── agent.system.main.role.md       — Sous Chef: prep plans
└── marketing/
    ├── agent.json
    └── prompts/
        └── agent.system.main.role.md       — Marketing: campaigns

carabiner/agent_overlay/tools/
├── order_tool.py                           — list, draft, review, send orders
├── inventory_tool.py                       — check levels, flag variances
├── prep_tool.py                            — generate prep plans, check readiness
├── food_cost_tool.py                       — analyze margins, suggest actions
├── menu_tool.py                            — engineering analysis, pricing
└── marketing_tool.py                       — campaign research, briefs

carabiner/agent_overlay/extensions/
├── system_prompt/
│   └── _25_restaurant_context.py           — UPDATED: inject real location + priorities
├── tool_execute_after/
│   └── _25_workspace_sync.py              — sync tool results to DB + emit events
└── response_stream/
    └── _25_response_cleaning.py           — clean internal agent language

engine/.env                                 — Ollama LLM configuration
```

### Modified Files

```
engine/bridge.py                            — add communicate(), create AgentContext with profiles
```

## Agent Profiles

### GM (General Manager) — Agent 0

```json
// carabiner/agent_overlay/profiles/gm/agent.json
{
  "title": "General Manager",
  "description": "Primary restaurant operations agent. Receives all requests and delegates to specialist subordinates.",
  "context": "Delegates purchasing/inventory to AGM, food cost/menu to Executive Chef, prep to Sous Chef, marketing to Marketing Manager."
}
```

**System prompt** (`agent.system.main.role.md`):
```markdown
You are the General Manager of a multi-location restaurant group operating through CarabinerOS.

Your role is to receive operational requests and delegate them to the right specialist:
- **AGM** (`agm`): Purchasing, vendor orders, inventory management
- **Executive Chef** (`executivechef`): Food cost analysis, menu engineering, pricing
- **Sous Chef** (`souschef`): Prep plans, station readiness, kitchen operations
- **Marketing Manager** (`marketing`): Campaigns, research, promotional briefs

When a request clearly falls under one specialist's domain, delegate immediately using call_subordinate with the appropriate agent name. For cross-functional requests, coordinate between multiple specialists.

Always respond in clear, professional language appropriate for restaurant operations. Never reference internal systems, tool names, or agent architecture.
```

### AGM (Assistant General Manager)

**System prompt focus**: Purchasing, vendor relationships, inventory levels, order building, par level management. Has access to `order_tool` and `inventory_tool`.

### Executive Chef

**System prompt focus**: Food cost analysis, menu engineering (star/puzzle/plowhorse/dog), pricing strategy, margin optimization. Has access to `food_cost_tool` and `menu_tool`.

### Sous Chef

**System prompt focus**: Prep planning, station readiness, shortage identification, service lane management. Has access to `prep_tool`.

### Marketing Manager

**System prompt focus**: Campaign strategy, competitive research, promotional briefs, channel planning. Has access to `marketing_tool`.

## Tool Specifications

All tools inherit from Agent Zero's `Tool` base class and import from `carabiner.db.repositories`.

### order_tool.py

**Methods**: `list`, `get`, `create`, `update`

```python
class OrderTool(Tool):
    async def execute(self, **kwargs) -> Response:
        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            orders = await repositories.list_orders(location_id)
            # Format as readable summary
        elif method == "get":
            order = await repositories.get_order(self.args["order_id"])
        elif method == "create":
            order = await repositories.create_order({...})
        elif method == "update":
            order = await repositories.update_order(id, {...})

        return Response(message=formatted_result, break_loop=False)
```

### inventory_tool.py

**Methods**: `list`, `get`, `check_variances`
- `list`: returns all inventory items for a location
- `check_variances`: filters items below par, returns shortage report

### prep_tool.py

**Methods**: `list`, `get`, `check_readiness`
- `list`: returns prep tasks grouped by service lane
- `check_readiness`: summarizes blocked/at-risk tasks

### food_cost_tool.py

**Methods**: `list`, `get`, `analyze`
- `analyze`: computes average cost %, identifies highest pressure items

### menu_tool.py

**Methods**: `list`, `get`, `engineering_report`
- `engineering_report`: categorizes items as star/puzzle/plowhorse/dog

### marketing_tool.py

**Methods**: `list`, `get`, `stage_summary`
- `stage_summary`: groups campaigns by stage (drafting/research/ready)

### Common Tool Pattern

Each tool follows this structure:
1. Parse `method` and `location_id` from `self.args`
2. Call the appropriate repository function
3. Format the result as a human-readable JSON or markdown string
4. Return `Response(message=..., break_loop=False, additional={...})`
5. The `additional` dict carries metadata for the `tool_execute_after` extension

## Extension Specifications

### system_prompt/_25_restaurant_context.py (UPDATED)

Currently a stub. Updated to inject real context:
- Active location name, status, sales/labor deltas
- Organization name
- Available connectors (providers + channels)
- Recent inbox items (top 3 by priority)
- Execution mode (demo vs autonomous)

Reads from DB via repositories at extension execution time.

### tool_execute_after/_25_workspace_sync.py (NEW)

Runs after any tool execution. Responsibilities:
- Logs the action to `action_log` table via `repositories.create_action_log()`
- If the tool modified data (create/update), emits a `workspace_update` Socket.IO event
- Event payload: `{ module: "orders", action: "update", item: {...} }`

Access to Socket.IO via the bridge singleton (imported from `main.py` or passed via agent config).

### response_stream/_25_response_cleaning.py (NEW)

Runs on every response stream chunk. Applies `cleanOperationalCopy` logic server-side:
- Strips "Using", "Writing" prefixes
- Replaces internal tool names with operational language
- Removes agent references (A0-A9, subordinate, superior)

This ensures even raw terminal output is clean, not just the frontend rendering.

## AgentBridge Updates

### communicate() method

```python
async def communicate(
    self,
    context_id: str,
    message: str,
    on_log: Callable | None = None,
    on_stream: Callable | None = None,
) -> str:
    """Send a message to Agent Zero and return the response.

    Args:
        context_id: Unique conversation context ID
        message: User message
        on_log: Callback for agent log entries (status updates)
        on_stream: Callback for response stream chunks
    """
    # Get or create AgentContext
    context = AgentContext.get(context_id)
    if context is None:
        config = self._build_config(profile="gm")
        context = AgentContext(config=config, id=context_id)

    # Set active location in agent config
    context.agent0.config.additional["active_location"] = ...

    # Send message and collect response
    response = await context.agent0.monologue(message)
    return response
```

### _build_config() method

Creates an `AgentConfig` with:
- `chat_model`: Ollama qwen3.5:9b
- `utility_model`: same
- `embeddings_model`: same
- `browser_model`: same
- `profile`: "gm" (or specified)
- `additional`: active location, org context

## Profile Registration

The overlay symlink pattern needs to also cover profiles. Update `bridge.py` `_create_overlay_symlinks()` to include:

```python
mappings = [
    ("tools", OVERLAY_DIR / "tools"),
    ("extensions", OVERLAY_DIR / "extensions"),
    ("prompts", OVERLAY_DIR / "prompts"),
    ("agents", OVERLAY_DIR / "profiles"),  # NEW: profiles as agents
]
```

This symlinks `agent-zero/usr/agents/` → `carabiner/agent_overlay/profiles/`, making profiles discoverable via `get_paths()` under the `usr/agents/<profile>/` search path.

## Testing Strategy

Since Agent Zero requires an LLM, testing has two tiers:

1. **Unit tests (no LLM)**: Test that tools can read/write DB, extensions modify prompts correctly, profiles are discoverable
2. **Integration tests (requires Ollama)**: Send a message through AgentBridge.communicate(), verify response contains expected content

Unit tests run in CI. Integration tests require local Ollama.

## Exit Criteria

1. 5 agent profiles created and discoverable via Agent Zero's path system
2. 6 tools read/write PostgreSQL via repositories
3. system_prompt extension injects real location context
4. tool_execute_after extension logs actions and emits workspace_update
5. response_stream extension cleans internal agent language
6. AgentBridge.communicate() sends messages to Agent Zero and returns responses
7. Ollama configuration works with qwen3.5:9b
8. Unit tests pass for tools and extensions (no LLM required)
