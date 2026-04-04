# Agent Zero Internals -- The Definitive Reference

> How Agent Zero works under the hood, and how CarabinerOS extends it.
> Written for developers building on top of the platform.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Extension System](#2-extension-system)
3. [Tool System](#3-tool-system)
4. [API Handler System](#4-api-handler-system)
5. [Socket.IO Protocol](#5-socketio-protocol)
6. [Agent Delegation](#6-agent-delegation)
7. [Memory System](#7-memory-system)
8. [Configuration](#8-configuration)
9. [CarabinerOS Extensions](#9-carabineros-extensions)

---

## 1. Architecture Overview

### How the App Starts

Entry point: `run_ui.py` line 556-559.

```python
if __name__ == "__main__":
    runtime.initialize()
    dotenv.load_dotenv()
    run()
```

The `run()` function (line 412) executes the following startup sequence:

1. **Migration** -- `initialize.initialize_migration()` runs data migrations and reloads `.env`/settings.
2. **API handler discovery** -- `load_classes_from_folder("python/api", "*.py", ApiHandler)` scans `python/api/` and auto-registers each handler class as a Flask route at `/{filename}`.
3. **WebSocket namespace discovery** -- `_build_websocket_handlers_by_namespace()` scans `python/websocket_handlers/` for handler classes, then `configure_websocket_namespaces()` wires them to Socket.IO events with auth/CSRF enforcement per namespace.
4. **Agent Zero init** -- `init_a0()` loads persisted chats, initializes MCP servers, starts the job loop (scheduler), and fires preload hooks.
5. **ASGI assembly** -- Flask is wrapped in `WSGIMiddleware`, combined with Starlette mounts for `/mcp` and `/a2a`, then wrapped by `socketio.ASGIApp`. Uvicorn serves the resulting ASGI app.

### What Runs Where

| Component | Technology | Port | Role |
|-----------|-----------|------|------|
| Agent Zero (BOH) | Flask + Socket.IO + Uvicorn (ASGI) | 5000 | AI agents, tools, LLM, memory, API |
| Next.js (FOH) | React 19, TypeScript | 3000 | Expo Station UI |
| PostgreSQL | Async SQLAlchemy + Alembic | 5432 | Relational data (CarabinerOS domain) |
| Ollama (dev) | Local LLM server | 11434 | Chat/utility/embedding model provider |

### Key Source Files

| File | Purpose |
|------|---------|
| `run_ui.py` | Flask app, ASGI assembly, Socket.IO server, API/WS registration |
| `initialize.py` | Agent config creation, chat loading, MCP init, job loop startup |
| `agent.py` | `Agent` class, `AgentContext`, `AgentConfig`, monologue loop |
| `models.py` | LiteLLM wrapper, `ModelConfig`, `unified_call()` |
| `python/helpers/tool.py` | `Tool` base class, `Response` dataclass |
| `python/helpers/extension.py` | `Extension` base class, `call_extensions()` |
| `python/helpers/api.py` | `ApiHandler` base class |
| `python/helpers/websocket_manager.py` | `WebSocketManager`, event routing, connection lifecycle |
| `python/helpers/state_monitor.py` | `StateMonitor`, dirty tracking, debounced snapshot push |
| `python/helpers/settings.py` | Settings loading, `A0_SET_` env prefix, type normalization |

---

## 2. Extension System

Extensions are the primary customization mechanism. They execute at defined lifecycle hooks during agent operation without modifying core files.

### Extension Base Class

**File:** `python/helpers/extension.py`

```python
class Extension:
    def __init__(self, agent: "Agent|None", **kwargs):
        self.agent = agent
        self.kwargs = kwargs

    @abstractmethod
    async def execute(self, **kwargs) -> Any:
        pass
```

Every extension is a class inheriting from `Extension` with a single `async def execute()` method. The `self.agent` attribute provides access to the full agent instance, config, context, and history.

### How Extensions Are Loaded

The `call_extensions()` function (line 27) resolves extension classes from the agent's folder hierarchy:

```python
async def call_extensions(extension_point, agent=None, **kwargs):
    paths = subagents.get_paths(agent, "extensions", extension_point, default_root="python")
    all_exts = [cls for path in paths for cls in _get_extensions(path)]
    # Deduplicate by filename -- first occurrence wins (override)
    unique = {}
    for cls in all_exts:
        file = _get_file_from_module(cls.__module__)
        if file not in unique:
            unique[file] = cls
    # Execute in lexicographic order
    classes = sorted(unique.values(), key=lambda cls: _get_file_from_module(cls.__module__))
    for cls in classes:
        await cls(agent=agent).execute(**kwargs)
```

**Resolution order** (first match wins for same filename):
1. `agents/{profile}/extensions/{hook}/` -- agent profile-specific
2. `usr/extensions/{hook}/` -- user-space customizations
3. `python/extensions/{hook}/` -- core framework

Extension classes are cached after first load (`_cache` dict) for performance.

### Priority Numbering

Extensions within a hook directory execute in **lexicographic filename order**. Use numeric prefixes to control sequence:

```
_10_first_thing.py       # runs first
_25_restaurant_context.py  # runs second
_50_recall_memories.py   # runs third
_90_final_cleanup.py     # runs last
```

### All Hook Points

These are the extension hook directories discovered in the codebase:

| Hook Directory | When It Fires | Typical `**kwargs` |
|---------------|---------------|-------------------|
| `agent_init/` | Agent constructor completes | (none) |
| `banners/` | UI banner display | |
| `system_prompt/` | Building system prompt | `system_prompt: list[str]`, `loop_data` |
| `monologue_start/` | Before monologue loop begins | `loop_data` |
| `message_loop_start/` | Start of each loop iteration | `loop_data` |
| `message_loop_prompts_before/` | Before prompt assembly | `loop_data` |
| `message_loop_prompts_after/` | After prompt assembly, before LLM call | `loop_data` |
| `before_main_llm_call/` | Immediately before LLM invocation | `loop_data` |
| `reasoning_stream_chunk/` | Each chunk of reasoning stream | `loop_data`, `stream_data` |
| `reasoning_stream/` | Full reasoning text accumulated | `loop_data`, `text` |
| `reasoning_stream_end/` | Reasoning stream finished | `loop_data` |
| `response_stream_chunk/` | Each chunk of response stream | `loop_data`, `stream_data` |
| `response_stream/` | Full response text + parsed JSON | `loop_data`, `text`, `parsed` |
| `response_stream_end/` | Response stream finished | `loop_data` |
| `tool_execute_before/` | Before a tool runs | `tool_args`, `tool_name` |
| `tool_execute_after/` | After a tool runs | `response`, `tool_name` |
| `error_format/` | Formatting error messages | `msg` (dict with "message" key) |
| `hist_add_before/` | Before adding to history | `content_data`, `ai` |
| `hist_add_tool_result/` | Before tool result enters history | `data` |
| `message_loop_end/` | End of each loop iteration | `loop_data` |
| `monologue_end/` | After monologue loop exits | `loop_data` |
| `process_chain_end/` | After full process chain completes | `data` |
| `util_model_call_before/` | Before utility model call | `call_data` |
| `user_message_ui/` | UI user message processing | |

### Built-in Extensions (Core)

**`python/extensions/system_prompt/`**
- `_10_system_prompt.py` -- Loads the main system prompt from prompt files
- `_20_behaviour_prompt.py` -- Injects behavior rules and tool descriptions

**`python/extensions/message_loop_start/`**
- `_10_iteration_no.py` -- Tracks iteration count, adds to loop data

**`python/extensions/monologue_end/`**
- `_50_memorize_fragments.py` -- Extracts conversation facts, stores in `Memory.Area.FRAGMENTS`
- `_51_memorize_solutions.py` -- Captures successful patterns, stores in `Memory.Area.SOLUTIONS`
- `_90_waiting_for_input_msg.py` -- Logs "Waiting for input" when agent finishes

### Creating a Custom Extension

1. Create a file in the appropriate hook directory under `usr/extensions/`:

```python
# usr/extensions/system_prompt/_30_my_context.py
from python.helpers.extension import Extension

class MyContextExtension(Extension):
    async def execute(self, system_prompt=[], loop_data=None, **kwargs):
        system_prompt.append("You are also an expert in X.")
```

2. The filename prefix (`_30_`) controls execution order relative to other extensions in the same hook.
3. To **override** a core extension, give your file the same name. The `usr/` version takes priority (first occurrence wins during deduplication).
4. To **inject persistent context** into the LLM prompt, modify `loop_data.extras_persistent`:

```python
loop_data.extras_persistent["my_data"] = "Important context here"
```

---

## 3. Tool System

Tools are the actions an agent can take. The LLM outputs a JSON tool request; the framework parses it, finds the matching tool class, and executes it.

### Tool Base Class

**File:** `python/helpers/tool.py`

```python
@dataclass
class Response:
    message: str           # Result text returned to agent
    break_loop: bool       # True = end monologue, return to user
    additional: dict | None = None  # Optional metadata for history

class Tool:
    def __init__(self, agent, name, method, args, message, loop_data, **kwargs):
        self.agent = agent
        self.name = name
        self.method = method     # Sub-method if tool_name contains ":"
        self.args = args
        self.loop_data = loop_data
        self.message = message
        self.progress = ""

    @abstractmethod
    async def execute(self, **kwargs) -> Response:
        pass

    async def before_execution(self, **kwargs):
        # Logs tool usage to console and UI
        ...

    async def after_execution(self, response, **kwargs):
        # Adds result to history, logs to UI
        ...
```

### How Tools Are Resolved

`Agent.get_tool()` (agent.py line 974) uses a path-based lookup:

```python
paths = subagents.get_paths(self, "tools", name + ".py", default_root="python")
```

**Resolution order:**
1. `agents/{profile}/tools/{name}.py` -- profile-specific override
2. `usr/tools/{name}.py` -- user-space custom tool (CarabinerOS adds tools here)
3. `python/tools/{name}.py` -- core framework tool

If no matching file is found, `python/tools/unknown.py` is used as a fallback.

**MCP tools are checked first** (before local lookup) via `mcp_handler.MCPConfig.get_instance().get_tool()`. MCP tools from external servers are transparent to the agent.

### Tool Execution Flow

1. LLM outputs JSON: `{"tool_name": "code_execution_tool", "tool_args": {"runtime": "python", "code": "..."}}`
2. `process_tools()` parses the JSON via `extract_tools.json_parse_dirty()`
3. If `tool_name` contains `:`, it splits into `tool_name` and `tool_method`
4. MCP lookup first, then local `get_tool()` fallback
5. `tool.before_execution()` -- logs to console/UI
6. Extension hook: `tool_execute_before` fires
7. `tool.execute(**tool_args)` -- the actual work
8. Extension hook: `tool_execute_after` fires
9. `tool.after_execution(response)` -- adds result to history
10. If `response.break_loop` is `True`, monologue ends and result returns to user

### Built-in Tools

| Tool File | Name | Purpose |
|-----------|------|---------|
| `code_execution_tool.py` | `code_execution_tool` | Execute Python/Node/shell code via SSH |
| `call_subordinate.py` | `call_subordinate` | Delegate task to a sub-agent |
| `response.py` | `response` | Return final answer (sets `break_loop=True`) |
| `input.py` | `input` | Send keyboard input to a running process |
| `memory_save.py` | `memory_save` | Persist information to memory |
| `memory_load.py` | `memory_load` | Retrieve from memory |
| `memory_delete.py` | `memory_delete` | Remove a memory entry |
| `memory_forget.py` | `memory_forget` | Forget memories matching criteria |
| `knowledge_tool._py` | `knowledge_tool` | Unified memory + web search |
| `browser_agent.py` | `browser_agent` | Web automation via browser-use |
| `skills_tool.py` | `skills_tool` | Load/execute SKILL.md files |
| `search_engine.py` | `search_engine` | Web search via SearXNG |
| `scheduler.py` | `scheduler` | Create/manage scheduled tasks |
| `wait.py` | `wait` | Pause execution for N seconds |
| `document_query.py` | `document_query` | Query uploaded documents |
| `behaviour_adjustment.py` | `behaviour_adjustment` | Modify agent behavior dynamically |
| `vision_load.py` | `vision_load` | Process images with vision model |
| `a2a_chat.py` | `a2a_chat` | Agent-to-Agent protocol communication |
| `notify_user.py` | `notify_user` | Send notification to user |

### Creating a Custom Tool

1. Create `usr/tools/my_tool.py`:

```python
from python.helpers.tool import Tool, Response

class MyTool(Tool):
    async def execute(self, **kwargs) -> Response:
        query = kwargs.get("query", "")
        # Do work here...
        result = f"Processed: {query}"
        return Response(message=result, break_loop=False)
```

2. Create a prompt file `prompts/default/agent.system.tool.my_tool.md` describing the tool's interface for the LLM:

```markdown
## tool: my_tool
Describe what the tool does and its parameters.
~~~json
{"tool_name": "my_tool", "tool_args": {"query": "search term"}}
~~~
```

3. The tool is automatically discovered on next startup. No registration code needed.

---

## 4. API Handler System

REST endpoints are auto-discovered from `python/api/`. Each file becomes a route at `/{filename}`.

### ApiHandler Base Class

**File:** `python/helpers/api.py`

```python
class ApiHandler:
    def __init__(self, app: Flask, thread_lock):
        self.app = app
        self.thread_lock = thread_lock

    @classmethod
    def requires_loopback(cls) -> bool:  return False
    @classmethod
    def requires_api_key(cls) -> bool:   return False
    @classmethod
    def requires_auth(cls) -> bool:      return True
    @classmethod
    def get_methods(cls) -> list[str]:   return ["POST"]
    @classmethod
    def requires_csrf(cls) -> bool:      return cls.requires_auth()

    @abstractmethod
    async def process(self, input: Input, request: Request) -> Output:
        pass
```

### How Registration Works

In `run_ui.py` line 459:

```python
handlers = load_classes_from_folder("python/api", "*.py", ApiHandler)
for handler in handlers:
    register_api_handler(webapp, handler)
```

`register_api_handler()` wraps each handler with the appropriate security decorators:
- `requires_loopback` -> `@requires_loopback` (restricts to localhost)
- `requires_auth` -> `@requires_auth` (validates session)
- `requires_api_key` -> `@requires_api_key` (validates X-API-KEY header)
- `requires_csrf` -> `@csrf_protect` (validates X-CSRF-Token header)

The route is registered as `/{filename}` with the methods from `get_methods()`.

### Adding a Custom API Route

Create `python/api/my_endpoint.py`:

```python
from python.helpers.api import ApiHandler, Input, Output
from flask import Request

class MyEndpoint(ApiHandler):
    @classmethod
    def requires_auth(cls) -> bool:
        return True  # or False for public endpoints

    @classmethod
    def get_methods(cls) -> list[str]:
        return ["POST", "GET"]

    async def process(self, input: Input, request: Request) -> Output:
        # input is the parsed JSON body (or empty dict)
        name = input.get("name", "world")
        return {"greeting": f"Hello, {name}!"}
```

This creates `POST /my_endpoint` and `GET /my_endpoint` automatically.

### Helper: use_context()

`ApiHandler.use_context(ctxid)` resolves or creates an `AgentContext`:

```python
context = self.use_context(request_data.get("context_id", ""))
# Now you can call context.communicate(UserMessage(...))
```

### Key Endpoints (Existing)

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/health` | GET | Health check |
| `/csrf_token` | GET/POST | Get CSRF token for session |
| `/api_message` | POST | Send message to agent (async) |
| `/api_reset_chat` | POST | Reset chat context |
| `/api_terminate_chat` | POST | Kill running agent task |
| `/chat_create` | POST | Create new chat context |
| `/chat_load` | POST | Load persisted chat |
| `/chat_remove` | POST | Delete a chat |
| `/get_settings` | POST | Retrieve current settings |
| `/set_settings` | POST | Update settings |
| `/agents` | POST | List available agent profiles |
| `/carabiner_workspace` | POST | CarabinerOS workspace operations |

---

## 5. Socket.IO Protocol

### Architecture

Agent Zero uses a **hybrid push/pull WebSocket architecture**:

- **Socket.IO server** runs as an ASGI app wrapping the Flask/Starlette stack (`run_ui.py` line 69-78)
- **Namespaces** are auto-discovered from `python/websocket_handlers/`
- **WebSocketManager** routes events to registered handlers

### Namespace Discovery

**File:** `python/helpers/websocket_namespace_discovery.py`

Handler files in `python/websocket_handlers/` declare their namespace. The `StateSyncHandler` serves namespace `/state_sync`. The `_default.py` handler serves the root `/` namespace.

### Connection Lifecycle

1. Client connects to a namespace
2. `_handle_connect_with_namespace_gatekeeper()` validates the namespace exists
3. Auth validation: session check (if `requires_auth`) + CSRF token (if `requires_csrf`)
4. `websocket_manager.handle_connect(namespace, sid, user_id=...)` tracks the connection
5. Handler's `on_connect(sid)` fires -- e.g., `StateMonitor.register_sid()`
6. On disconnect: `on_disconnect(sid)` fires, then `handle_disconnect()` cleans up

### State Push / State Request Protocol

**File:** `python/websocket_handlers/state_sync_handler.py`

The state synchronization protocol works on the `/state_sync` namespace:

**Client -> Server: `state_request`**

```json
{
  "context": "abc12345",
  "log_from": 0,
  "notifications_from": 0,
  "timezone": "America/New_York",
  "correlationId": "uuid-here"
}
```

The server parses this via `parse_state_request_payload()`, updates the `StateMonitor` projection for this sid, and marks it dirty to trigger an initial snapshot push.

**Server -> Client: `state_push`**

The `StateMonitor` (state_monitor.py) implements debounced dirty tracking:

1. Any state change calls `mark_dirty(namespace, sid, reason=...)` or `mark_dirty_all(reason=...)`
2. A debounce timer (default 25ms) coalesces rapid changes
3. When the timer fires, `build_snapshot_from_request()` creates a snapshot containing:
   - Context list with metadata
   - Log entries (incremental from `log_from`)
   - Agent status
   - Notifications
4. The snapshot is emitted as `state_push` to the specific sid

### Envelope Format

Events route through `WebSocketManager.route_event()`:

```python
await websocket_manager.route_event(namespace, event_type, payload, sid)
```

Handlers return results via `WebSocketResult`:
- `result_ok(data, correlation_id)` -- success response
- `result_error(code, message, correlation_id)` -- error response

### Custom Events

CarabinerOS adds custom events like `chef_status` emitted directly via the Socket.IO server:

```python
await sio.emit("chef_status", {
    "status": "completed",
    "tool": tool_name,
    "text": "Heard.",
    "active": False
}, namespace="/state_sync")
```

---

## 6. Agent Delegation

### How call_subordinate Works

The `call_subordinate` tool creates a new `Agent` instance with a higher number, linked via `agent.data`:

```
User -> Agent 0 (A0)
            |
            v  call_subordinate(message, agent_name="researcher")
        Agent 1 (A1) -- has A0 as superior
            |
            v  call_subordinate(...)
        Agent 2 (A2) -- has A1 as superior
```

### Agent Hierarchy Data

```python
Agent.DATA_NAME_SUPERIOR = "_superior"      # agent.data["_superior"] -> parent Agent
Agent.DATA_NAME_SUBORDINATE = "_subordinate" # agent.data["_subordinate"] -> child Agent
```

### The Process Chain

**`AgentContext._process_chain()`** (agent.py line 276) maintains the callstack:

1. Adds user message to agent history
2. Calls `agent.monologue()` -- the inner loop
3. When monologue returns, checks for a superior agent
4. If superior exists, recursively calls `_process_chain(superior, response, user=False)` -- this feeds the subordinate's result back as a tool result
5. After the full chain unwinds, calls `process_chain_end` extensions

This recursive pattern means that even if the callstack is lost (e.g., chat loaded from disk), the chain reconstructs itself.

### Agent Profiles

Profiles are directories under `agents/` that customize agent behavior:

```
agents/
  agent0/           # Default general-purpose
    prompts/
      agent.system.main.role.md
  researcher/        # Analysis-focused
    prompts/
      agent.system.main.role.md
      agent.system.main.communication.md
  developer/         # Code-focused
    prompts/
      agent.system.main.role.md
  hacker/            # Security-focused
    prompts/
      agent.system.main.role.md
      agent.system.main.environment.md
  _example/          # Template for new profiles
    tools/
      example_tool.py
    extensions/
      agent_init/_10_example_extension.py
    prompts/
      agent.system.main.role.md
      agent.system.tool.example_tool.md
```

**Profile structure:**
- `prompts/` -- Override any prompt file. Falls back to `prompts/default/` for non-overridden files.
- `tools/` -- Profile-specific tools. These are checked first during tool resolution.
- `extensions/` -- Profile-specific extensions. These are checked first during extension resolution.
- `_context.md` -- Context description file for the profile.

### Shared vs. Isolated State

| Shared (same AgentContext) | Isolated (per Agent) |
|---------------------------|---------------------|
| `context.log` -- unified log | `agent.history` -- separate conversation |
| `context.paused` -- pause state | `agent.data` -- agent-specific data |
| `context.streaming_agent` -- current streamer | `agent.loop_data` -- loop state |
| `context.task` -- the running DeferredTask | `agent.number` -- sequential ID |

### Intervention

When a user sends a message while an agent is running, it becomes an **intervention**:

```python
def communicate(self, msg, broadcast_level=1):
    if self.task and self.task.is_alive():
        # Set intervention on current agent and broadcast_level superiors
        intervention_agent = current_agent
        while intervention_agent and broadcast_level != 0:
            intervention_agent.intervention = msg
            broadcast_level -= 1
            intervention_agent = intervention_agent.data.get("_superior", None)
```

The running agent checks `handle_intervention()` at multiple points in the monologue loop. When an intervention is detected, it raises `InterventionException`, which restarts the loop with the new message in history.

---

## 7. Memory System

### Architecture

Agent Zero uses **FAISS (Facebook AI Similarity Search)** for persistent vector storage. Each memory subdirectory gets its own FAISS index (cached singleton pattern).

### Memory Areas

| Area | Purpose | Populated By |
|------|---------|-------------|
| `MAIN` | General knowledge, imported documents | Knowledge imports |
| `FRAGMENTS` | Conversation facts/snippets | `_50_memorize_fragments.py` extension |
| `SOLUTIONS` | Successful problem-solving patterns | `_51_memorize_solutions.py` extension |
| `INSTRUMENTS` | Custom function descriptions | Knowledge imports |

### Storage Structure on Disk

```
memory/{subdir}/
  index.faiss           # FAISS vector data
  index.pkl             # Python pickle with docstore + metadata
  embedding.json        # Embedding model config (triggers re-index on change)
  knowledge_import.json # Import tracking with MD5 hashes
```

### Save/Load/Search

**Save:** Uses the embedding model to vectorize text, then stores in FAISS with metadata (id, timestamp, area, source_file, file_type).

**Search:** Performs similarity search on the FAISS index. Supports Python expression filtering on document metadata. Default limits: 5 memories, 3 solutions per prompt.

**Embedding model:** Configured via `embed_model_*` settings. Changing the model triggers a full re-index of all stored memories.

### Automatic Memory Ingestion

Two extensions fire at `monologue_end`:

1. **Fragment memorization** (`_50_memorize_fragments.py`):
   - Calls utility LLM to extract important facts from conversation
   - Checks for similar existing memories (up to 8)
   - Consolidation decisions: merge, update, keep separate, or skip

2. **Solution memorization** (`_51_memorize_solutions.py`):
   - Identifies successful problem-solving patterns
   - Formats as structured markdown with problem/solution sections
   - Same consolidation logic

### Memory Recall

The `_50_recall_memories.py` extension (in `message_loop_prompts_after/`) injects relevant memories before each LLM call:

1. Optionally generates optimized search queries via utility LLM
2. Searches MAIN/FRAGMENTS and SOLUTIONS separately
3. Optionally post-filters with LLM for relevance
4. Injects formatted results into `loop_data.extras_persistent`

### Knowledge Import

Files placed in the knowledge directory are imported with change detection:
- MD5 hash comparison identifies new/changed/removed files
- Only modified files trigger document loading and re-embedding
- Tracked via `knowledge_import.json`

---

## 8. Configuration

### Settings Loading

**File:** `python/helpers/settings.py`

Settings use a split-storage model:
- **`usr/settings.json`** -- Non-sensitive config (model names, ctx lengths, behavior flags)
- **`usr/.env`** -- Sensitive credentials (API keys, passwords)

### A0_SET_ Environment Variable Override

Any setting can be overridden via environment variable with the prefix `A0_SET_`:

```bash
A0_SET_chat_model_provider=ollama_chat
A0_SET_chat_model_name=glm-4.7-flash:latest
A0_SET_chat_model_api_base=http://localhost:11434
A0_SET_chat_model_ctx_length=8192
A0_SET_chat_model_kwargs={"temperature": 0.7}
```

**Type normalization** is automatic:
- `bool`: parses from `true/1/yes/on` (case-insensitive)
- `dict`: parses JSON strings
- `int/float`: type constructors
- `str`: whitespace trimmed

Environment variables take **highest priority** over `settings.json`.

The `get_default_value(name, value)` function handles this:

```python
def get_default_value(name, value):
    env_value = dotenv.get_dotenv_value(f"A0_SET_{name}", ...)
    if env_value is None:
        return value
    # Auto-normalize type to match default value type
    ...
```

### Model Configuration

Four independent model roles, each with their own provider/name/settings:

| Role | Settings Prefix | Purpose |
|------|----------------|---------|
| Chat | `chat_model_*` | Primary agent reasoning, tool decisions |
| Utility | `util_model_*` | Memory extraction, query generation (cheaper model OK) |
| Browser | `browser_model_*` | Web automation (vision recommended) |
| Embedding | `embed_model_*` | Vector embeddings for memory search |

**Fields per model:**

| Field | Type | Description |
|-------|------|-------------|
| `provider` | str | LiteLLM provider (e.g., `ollama_chat`, `openrouter`, `anthropic`) |
| `name` | str | Model identifier |
| `api_base` | str | Custom API endpoint |
| `ctx_length` | int | Token context window |
| `vision` | bool | Image input support |
| `limit_requests` | int | Rate limit: requests/min |
| `limit_input` | int | Rate limit: input tokens/min |
| `limit_output` | int | Rate limit: output tokens/min |
| `kwargs` | dict | Provider-specific params (temperature, etc.) |

### AgentConfig Dataclass

**File:** `agent.py` line 298

```python
@dataclass
class AgentConfig:
    chat_model: ModelConfig
    utility_model: ModelConfig
    embeddings_model: ModelConfig
    browser_model: ModelConfig
    mcp_servers: str
    profile: str = ""
    memory_subdir: str = ""
    knowledge_subdirs: list[str] = field(default_factory=lambda: ["default", "custom"])
    browser_http_headers: dict = field(default_factory=dict)
    code_exec_ssh_enabled: bool = True
    code_exec_ssh_addr: str = "localhost"
    code_exec_ssh_port: int = 55022
    code_exec_ssh_user: str = "root"
    code_exec_ssh_pass: str = ""
    additional: Dict[str, Any] = field(default_factory=dict)
```

Created by `initialize_agent()` in `initialize.py`, which:
1. Loads settings via `get_settings()`
2. Creates `ModelConfig` instances for each model role
3. Normalizes kwargs (string-to-number conversion)
4. Applies SSH/Docker runtime config
5. Applies command-line arg overrides

### How usr/ Overlay Works

The `usr/` directory provides persistent user data isolation:

```
usr/
  .env              # Sensitive config (API keys, passwords)
  settings.json     # Non-sensitive settings
  chats/            # Persisted chat histories
  memory/           # FAISS indices and embeddings
  knowledge/        # Knowledge base files for import
  extensions/       # Custom extensions (override or add)
  tools/            # Custom tools (NOT directly used -- see agents/)
  agents/           # Agent profiles with custom prompts/tools/extensions
```

When mounted as a Docker volume (`-v /local/path:/a0/usr`), user data persists across container restarts and upgrades.

**For prompts:** Custom prompt directories in `agents/{profile}/prompts/` enable selective overrides. If a file exists in the custom directory, it is used. Otherwise, the system falls back to `prompts/default/`.

---

## 9. CarabinerOS Extensions

### Philosophy

CarabinerOS customizes Agent Zero through the `usr/` overlay system. All customization lives in `usr/extensions/`, `usr/tools/`, and `agents/` -- **never modifying core Agent Zero files**.

### Custom Agent Profiles

CarabinerOS adds restaurant-specific agent profiles in `agents/`:

| Profile | Role |
|---------|------|
| `gm` | General Manager -- overall operations oversight |
| `executivechef` | Executive Chef -- kitchen, menu, food cost |
| `souschef` | Sous Chef -- prep, inventory, day-to-day kitchen |
| `marketing` | Marketing -- campaigns, social media, promotions |
| `agm` | Assistant General Manager |

Each profile has its own prompts in `agents/{profile}/prompts/` that customize the agent's personality, knowledge domain, and communication style.

### Custom Extensions

**`usr/extensions/system_prompt/_25_restaurant_context.py`** (`RestaurantContext`)

Injects restaurant identity and operational context into every agent's system prompt:
- Sets the agent identity as "CarabinerOS" (never "Agent Zero")
- Injects active location, organization name, and location ID
- Directs the agent to speak like a seasoned General Manager

```python
system_prompt.append("\n".join([
    "## Your Identity & Role",
    "You ARE CarabinerOS -- the AI-powered restaurant operations platform.",
    "NEVER refer to yourself as 'Agent Zero' or 'an AI assistant'.",
    ...
]))
```

**`usr/extensions/response_stream_chunk/_25_response_cleaning.py`** (`ResponseCleaning`)

Cleans internal Agent Zero language from the response stream before it reaches the UI:
- Strips `$$` directives
- Replaces tool names with operational language (e.g., `code_execution_tool` -> `operational workflow`)
- Removes agent references (`Agent 0`, `A1`, `subordinate agent`)
- Cleans up whitespace artifacts

**`usr/extensions/tool_execute_after/_10_chef_status.py`** (`ChefStatusAfter`)

Emits `chef_status` Socket.IO events when tools complete, used by the Expo Station UI to show real-time status updates:

```python
await sio.emit("chef_status", {
    "status": "completed",
    "tool": tool_name,
    "text": "Heard.",
    "active": False
}, namespace="/state_sync")
```

**`usr/extensions/tool_execute_before/_10_chef_status.py`** -- Similar, emits status when tools start.

**`usr/extensions/monologue_end/_10_chef_status.py`** -- Emits final status when agent finishes.

### Custom Tools

CarabinerOS adds restaurant-specific tools in `usr/tools/`:

| Tool | Purpose |
|------|---------|
| `food_cost_tool.py` | Food cost calculations and analysis |
| `inventory_tool.py` | Inventory queries and management |
| `invoice_tool.py` | Invoice processing and lookup |
| `marketing_tool.py` | Marketing campaign management |
| `menu_tool.py` | Menu analysis and engineering |
| `order_tool.py` | Order management |
| `ping_tool.py` | Simple connectivity test |
| `prep_tool.py` | Prep list planning |
| `recipe_tool.py` | Recipe lookup and scaling |
| `reporting_tool.py` | Operational reporting |

### Custom API Endpoint

**`python/api/carabiner_workspace.py`** -- Adds workspace operations for the CarabinerOS domain layer.

### Frontend Integration

The Next.js frontend (`frontend/`) connects to Agent Zero via Socket.IO on the `/state_sync` namespace. It:
- Sends `state_request` with the active context ID
- Receives `state_push` events with log updates
- Listens for `chef_status` events to show real-time tool execution status
- Falls back to HTTP polling via `/poll` if WebSocket fails

---

## Appendix: Quick Reference

### Extension Hook Execution Order in a Single Monologue

```
agent_init (once, at construction)
  monologue_start
    message_loop_start
      message_loop_prompts_before
      system_prompt
      message_loop_prompts_after
      before_main_llm_call
      reasoning_stream_chunk (repeated)
      reasoning_stream_end
      response_stream_chunk (repeated)
      response_stream_end
      tool_execute_before
      tool_execute_after
    message_loop_end
    (loop repeats until response tool or error)
  monologue_end
process_chain_end
```

### Tool Request JSON Format

The LLM outputs this format (parsed by `extract_tools.json_parse_dirty()`):

```json
{
  "tool_name": "tool_name_here",
  "tool_args": {
    "arg1": "value1",
    "arg2": "value2"
  }
}
```

For sub-methods: `"tool_name": "skills_tool:load"` splits into `name="skills_tool"`, `method="load"`.

### File Resolution Hierarchy

For tools, extensions, and prompts, the resolution order is:

```
1. agents/{profile}/{type}/{name}   -- profile-specific (highest priority)
2. usr/{type}/{name}                -- user-space custom
3. python/{type}/{name}             -- core framework (lowest priority)
```

First match wins. Same-filename in a higher-priority location overrides the lower one.
