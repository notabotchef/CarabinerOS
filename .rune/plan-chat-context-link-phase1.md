# Phase 1: Backend — DB Column + CLI Flag + Prompt Injection

## Data Flow
```
A0 agent (context.id = "03S9Iu7R")
  → system prompt injects: "Current chat context: 03S9Iu7R"
  → A0 runs: carabiner orders create --chat-context 03S9Iu7R --vendor ... --json
  → CLI stores chat_context_id in the record
  → API returns chat_context_id in JSON response
```

## Code Contracts

### ChatContextMixin (carabiner/db/base.py)
```python
class ChatContextMixin:
    """Stores the A0 chat context ID that last modified this record."""
    chat_context_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
```

### CLI --chat-context flag (all write commands)
```python
chat_context: Optional[str] = typer.Option(None, "--chat-context", help="A0 chat context ID.")
```

### System prompt injection (_25_restaurant_context.py)
```python
# Inject current chat context ID for CLI writes
ctx_id = getattr(getattr(self.agent, 'context', None), 'id', None)
if ctx_id:
    context_parts.append(f"Current chat context ID (pass as --chat-context on writes): {ctx_id}")
```

## Tasks

### Wave 1 (parallel)

#### Task 1a: Add ChatContextMixin to base.py
- **File**: `carabiner/db/base.py`
- **Logic**: Add `ChatContextMixin` class with `chat_context_id` column (String(50), nullable)
- **touches**: [carabiner/db/base.py]
- **provides**: [ChatContextMixin]

#### Task 1b: Inject chat context ID in system prompt
- **File**: `usr/extensions/python/system_prompt/_25_restaurant_context.py`
- **Logic**: After the CLI grammar section, inject the current context ID from
  `self.agent.context.id`. Add instruction: "Always pass --chat-context <id> on writes."
- **touches**: [_25_restaurant_context.py]
- **provides**: [A0 knows its context ID]

### Wave 2 (depends on 1a)

#### Task 1c: Add mixin to workspace models
- **File**: `carabiner/db/workspace_models.py`
- **Logic**: Add `ChatContextMixin` to WorkspaceOrder, WorkspaceMenu, and other models
  that the CLI writes to. Import from base.py.
- **touches**: [workspace_models.py]
- **requires**: [ChatContextMixin from 1a]
- **depends_on**: [task-1a]

#### Task 1d: Add --chat-context to CLI write commands
- **File**: `carabiner/cli/commands/orders.py`
- **File**: `carabiner/cli/commands/prep.py`
- **File**: `carabiner/cli/commands/inventory.py`
- **Logic**: Add `chat_context` option to create/update commands. Pass through to
  repository data dict. Start with orders — pattern applies to all.
- **touches**: [orders.py, prep.py, inventory.py]
- **requires**: [ChatContextMixin column exists from 1c]
- **depends_on**: [task-1c]

### Wave 3 (depends on 1c)

#### Task 1e: Verify API responses include chat_context_id
- **File**: `carabiner/api/flask_blueprint.py` (if manual serialization)
- **Logic**: Pydantic/model_dump should auto-include the new column. Verify by reading
  the serialization code. If using `model_validate`, the field comes through automatically.
  If manual dict building, add `chat_context_id` to the output dict.
- **touches**: [flask_blueprint.py if needed]
- **depends_on**: [task-1c]

## Failure Scenarios

| When | Then | Error |
|------|------|-------|
| A0 forgets --chat-context | Record has null chat_context_id | Side-chat starts fresh — acceptable |
| Old records (pre-migration) | chat_context_id is null | Same as above — no regression |
| Invalid context ID passed | Stored as-is (no validation) | Frontend won't find chat — starts fresh |
| create_all() fails | Startup logs error | Check column type/naming conflict |

## Rejection Criteria
- DO NOT use Alembic migration — dev mode uses create_all()
- DO NOT validate the context ID format — just store it
- DO NOT make chat_context_id required — it MUST be nullable
- DO NOT add the mixin to models that are never written via CLI (read-only models)

## Cross-Phase Context
- **Assumes**: CLI commands work, system prompt extension loads (verified session 15)
- **Exports**: DB records have chat_context_id, API returns it, A0 passes it on writes
- **Phase 2 needs**: chat_context_id field in API response for order/record objects

## Acceptance Criteria
- [ ] ChatContextMixin exists in base.py
- [ ] WorkspaceOrder (and other write models) have chat_context_id column
- [ ] CLI create/update commands accept --chat-context
- [ ] System prompt includes current context ID
- [ ] API response for orders includes chat_context_id
- [ ] Existing records with null chat_context_id don't break
