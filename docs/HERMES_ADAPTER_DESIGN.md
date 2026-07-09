# Hermes Adapter Design

> **SUPERSEDED — 2026-07-09.** This document was written blind to hermes-agent (NousResearch, v0.14.0). The facts it assumes ("Hermes not present as active code", "no concrete Hermes package/API is assumed") are wrong; the package is installed locally and pin-publishable as `hermes-agent==0.14.0`. The **adapter-boundary thinking** (chat/tools/cards/audit/policy/realtime; test-first; A0 fallback) is sound and is adopted in `docs/HERMES_BETA_MIGRATION_PLAN.md`. For the current plan, read **FABLE_REPO_REAUDIT.md** + **HERMES_REQUIREMENTS_AND_CAPABILITIES.md** + **HERMES_BETA_MIGRATION_PLAN.md** instead.

## Purpose

This design defines adapter boundaries for migrating CarabinerOS away from direct Agent Zero runtime coupling. The adapters must first wrap the current Agent Zero implementation. Hermes implementations should be added behind the same interfaces only after contract tests cover current behavior.

No Hermes runtime code exists in this repo yet, so future Hermes targets below are intentionally described as integration points, not concrete package APIs.

## Proposed Module Paths

Recommended new package:

```text
carabiner/runtime/
  __init__.py
  config.py
  orchestration.py
  chat.py
  tools.py
  action_cards.py
  audit.py
  policy.py
  realtime.py
  agent_zero/
    __init__.py
    orchestration.py
    chat.py
    tools.py
    action_cards.py
    realtime.py
  hermes/
    __init__.py
    orchestration.py
    chat.py
    tools.py
    action_cards.py
    realtime.py
```

Default implementation should be Agent Zero until Hermes parity is proven.

## Proposed Interfaces

### OrchestrationAdapter

Responsibility: route high-level user tasks to the active runtime and preserve role/team semantics.

```python
class OrchestrationAdapter:
    async def run(
        self,
        *,
        message: str,
        context_id: str | None,
        role: str = "gm",
        metadata: dict | None = None,
    ) -> "OrchestrationResult": ...
```

Contract:

- input: user message, optional chat context, role id, metadata
- output: final text, optional stream id, tool calls, trace id, warnings/errors
- roles: `gm`, `agm`, `executivechef`, `souschef`, `marketing`, `expo`

Current A0 mapping:

- `AgentContext.first().communicate(...)`
- `usr/agents/*`
- `call_subordinate` behavior inside Agent Zero

Future Hermes mapping:

- Hermes role orchestrator, once available
- same role names and prompt responsibilities

Tests:

- GM routes to specialist without losing role identity
- fallback to Agent Zero when Hermes unavailable
- unknown role rejected or downgraded to `gm` with warning

### ChatRuntimeAdapter

Responsibility: create/list/load/remove chats and send/stream messages.

```python
class ChatRuntimeAdapter:
    async def list_chats(self) -> list[dict]: ...
    async def get_messages(self, context_id: str) -> list[dict]: ...
    async def create_chat(self) -> dict: ...
    async def delete_chat(self, context_id: str) -> None: ...
    async def send_message(
        self,
        *,
        context_id: str | None,
        message: str,
        stream: bool,
    ) -> "ChatSendResult": ...
```

Current A0 mapping:

- `carabiner/api/chats.py`
- A0 `/api/message`, `/api/message_async`, `/api/chats`
- `AgentContext`
- `FallbackChatStore`

Future Hermes mapping:

- Hermes chat/session runtime behind same endpoint contract

Data contract:

- chat summary has `id`, `name`, `created_at`, `last_message`, `type`, `running`
- message has `role` and `content`
- send result has `ok`, `context_id`, `message` or `error`

Error handling:

- runtime unavailable returns structured error
- fallback store remains available for CRUD
- no raw stack traces to frontend

Tests:

- list/create/delete works with A0 stub
- A0 failure falls back where current code falls back
- `message_async` contract stays stable

### ToolExecutionAdapter

Responsibility: execute domain tools with stable policy and CLI behavior.

```python
class ToolExecutionAdapter:
    async def execute(
        self,
        *,
        tool_name: str,
        args: dict,
        context_id: str | None,
        actor: str,
    ) -> "ToolExecutionResult": ...
```

Current A0 mapping:

- `usr/tools/carabiner_read.py`
- `usr/tools/carabiner_write.py`
- `python/tools/action_card.py`
- `python/tools/daily_brief_tool.py`
- A0 `helpers.tool.Tool` and `Response`

Future Hermes mapping:

- Hermes tool invocation/runtime API
- same tool names and args until prompts are updated

Data contract:

- read result: JSON string or parsed JSON plus stdout/stderr metadata
- write result: JSON record, side-effect metadata, notification/audit ids if available
- errors: `code`, `message`, `tool_name`, `retryable`

Tests:

- invalid resource denied
- invalid verb denied
- `--json` is appended
- timeouts return safe error
- write notification failure does not hide successful CLI result

### ActionCardAdapter

Responsibility: validate/build/emit action-card payloads.

```python
class ActionCardAdapter:
    async def emit(self, card: dict, *, context_id: str | None = None) -> "EmitResult": ...
    def validate(self, card: dict) -> "ValidationResult": ...
    def build_daily_brief(self, data: dict) -> dict: ...
```

Current A0 mapping:

- `python/tools/action_card.py`
- `python/tools/daily_brief_tool.py`
- `helpers.ws_manager.send_data`

Future Hermes mapping:

- Hermes event emitter or shared realtime service

Data contract:

- event name: `action_card`
- payload shape: `{"card": {...}}`
- card fields include `id`, `type`, `module`, `action`, `summary`, `detail`, `itemId`, `changes`, `stats`, `priority`, `deadline`, `status`, `timestamp`, `source`

Error handling:

- validation errors are returned before emit
- emitter failure returns structured warning/error
- missing realtime manager does not crash the runtime

Tests:

- valid card emits
- invalid type/action rejected
- priority coerced
- daily brief no-data and urgent cases stable

### AuditLogAdapter

Responsibility: persist tool/action/runtime traces without depending on Agent Zero history.

```python
class AuditLogAdapter:
    async def record(
        self,
        *,
        action_type: str,
        actor: str,
        resource: str,
        resource_id: str | None,
        input: dict,
        result: dict,
        context_id: str | None,
    ) -> "AuditResult": ...
```

Current mapping:

- `ActionLog` in `carabiner/db/workspace_models.py`
- `InvoiceEvent`
- `EightySixLog`
- `create_action_log` in `carabiner/db/repositories.py`
- A0 conversation/tool history as secondary trace

Future Hermes mapping:

- Hermes trace ids plus existing DB audit/event tables

Data contract:

- every write flow should have actor, action, resource, result, context_id where available
- failures should be logged with `outcome=error` or equivalent existing field, if schema supports it

Tests:

- write adapter creates action log
- failure path creates safe trace
- log can be queried by location/resource where supported

### PolicyGateAdapter

Responsibility: approve/deny mutations before execution.

```python
class PolicyGateAdapter:
    async def evaluate(
        self,
        *,
        tool_name: str,
        resource: str,
        verb: str,
        args: dict,
        actor: str,
        context_id: str | None,
    ) -> "PolicyDecision": ...
```

Current mapping:

- resource/verb allowlists in `usr/tools/carabiner_read.py`
- resource/verb allowlists in `usr/tools/carabiner_write.py`
- prompts in `usr/prompts/agent.system.tool.carabiner_write.md`
- action-card validators

Future Hermes mapping:

- centralized Hermes policy preflight, if available, or Carabiner policy module

Data contract:

- decision: `allow`, `deny`, or `requires_approval`
- reason code and user-safe message
- normalized args for execution

Tests:

- write denied for read tool
- invalid resource denied
- missing `location_id` requires more context for create flows
- raw SQL/tool escape denied

### RealtimeEventAdapter

Responsibility: normalize websocket events, call runtime adapters, and emit replies.

```python
class RealtimeEventAdapter:
    async def process_event(
        self,
        *,
        event_type: str,
        data: dict,
        sid: str,
    ) -> dict: ...

    async def broadcast(self, event: str, payload: dict) -> None: ...
```

Current A0 mapping:

- `python/websocket_handlers/state_sync_handler/action_cards_handler.py`
- `helpers.ws_manager.send_data`
- fallback to `sio.emit`
- frontend `/ws` Socket.IO client

Future Hermes mapping:

- Hermes realtime/event server or adapter-compatible bridge

Data contract:

- `card_message` requires `cardId` and `text`
- `card_commit` returns `{"ok": True, "data": {"status": "committed"}}`
- `card_dismiss` returns `{"ok": True, "data": {"status": "dismissed"}}`
- `card_reply` payload contains `cardId` and assistant message with text/timestamp

Tests:

- missing card id/text returns stable errors
- card message calls active chat adapter
- broadcast failure does not fail successful response

## Current A0 Implementation Mapping

| A0 concept | File(s) | Adapter |
|---|---|---|
| Agent context/message loop | `engine/agent-zero`, `carabiner/api/chats.py` | `OrchestrationAdapter`, `ChatRuntimeAdapter` |
| Tool base/response | `usr/tools/*`, `python/tools/*` | `ToolExecutionAdapter` |
| API handler dispatch | `carabiner/api/_a0_handlers.py`, startup stubs | `ChatRuntimeAdapter`, future plain API routes |
| Socket.IO send | `helpers.ws_manager.send_data`, `action_cards_handler.py` | `RealtimeEventAdapter`, `ActionCardAdapter` |
| Startup extension | `usr/plugins/carabiner/.../_10_carabiner_init.py` | bootstrap/init adapter |
| Role profiles | `usr/agents/*` | `OrchestrationAdapter` |
| Tool prompts | `usr/prompts/*` | `ToolExecutionAdapter`, `PolicyGateAdapter` |

## Future Hermes Implementation Mapping

Hermes implementation must be discovered or added later. Until concrete Hermes APIs exist, adapter methods should raise `NotImplementedError` or return `runtime_unavailable` when `CARABINER_RUNTIME=hermes` is requested without implementation.

Required Hermes capabilities:

- accept chat/task input with context id
- stream or return response
- invoke named tools with JSON args
- emit or forward realtime events
- support role-specific prompts/config
- return trace ids or trace metadata
- surface errors safely

## Error Handling

- Adapters return typed results, not raw exceptions.
- User-facing errors must not leak secrets, stack traces, DB URLs, or env values.
- Tool timeouts should be explicit and retryable where safe.
- Policy denials should include reason codes.
- Audit write failure should be visible to logs/tests; write flow should define whether audit failure blocks mutation before implementation.
- Realtime emit failure should be recoverable for non-critical card display, but write flows requiring action-card confirmation must define blocking semantics.

## Logging/Audit Requirements

For every Hermes write slice:

- evaluate policy before mutation
- execute through `ToolExecutionAdapter`
- write `ActionLog` or suitable existing event model
- emit action card or record why no card was emitted
- include actor, context id, resource, verb, args summary, result summary, and trace id if available

No new audit schema should be added until tests prove existing `ActionLog`/event models are insufficient.

## Test Strategy

1. Add A0-backed adapter tests first.
2. Use current passing tests as baseline: action card, daily brief, action card handler.
3. Add contract tests for adapters with stubbed A0 objects and fake Hermes implementations.
4. Add one read-only Hermes slice test.
5. Add one write Hermes slice test with policy, audit, and action card assertions.
6. Keep frontend tests for socket/action cards passing.
7. Keep Docker config and routing tests passing.

## Configuration

Recommended config:

```text
CARABINER_RUNTIME=agent_zero
CARABINER_ENABLE_HERMES_READS=false
CARABINER_ENABLE_HERMES_WRITES=false
CARABINER_REQUIRE_AUDIT_FOR_WRITES=true
```

Default values must preserve current Agent Zero behavior.
