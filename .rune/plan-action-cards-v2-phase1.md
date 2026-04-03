# Phase 1: A0 Card Schema — Structured JSON in notify_user

## Data Flow
```
A0 runs CLI write → gets JSON result → builds card payload → calls notify_user(detail=JSON)
                                                                    ↓
                                                        NotificationManager.add_notification()
                                                                    ↓
                                                              mark_dirty_all()
                                                                    ↓
                                                          state_push → frontend
```

## Code Contracts

### Card JSON Schema (sent in notify_user `detail` field)
```json
{
  "module": "orders",
  "action": "create",
  "item_id": "uuid-of-record",
  "stats": [{"label": "Vendor", "value": "Pacific Seafood"}, {"label": "Total", "value": "$180"}],
  "changes": [{"op": "+", "text": "New draft order created"}],
  "actions": [
    {"label": "Send Order", "type": "primary"},
    {"label": "Edit Items", "type": "secondary"},
    {"label": "Delete", "type": "danger"}
  ],
  "deadline": "2026-04-01T17:00:00Z",
  "suggested_action": "Send this order to Pacific Seafood",
  "suggested_chips": ["Send now", "Add items", "Check prices"]
}
```

## Tasks

### Task 1a: Update system prompt with card JSON schema
- **File**: `usr/extensions/python/system_prompt/_25_restaurant_context.py`
- **Logic**: Replace the current notify_user example with the structured JSON format.
  Show A0 the exact schema to put in the `detail` field. Include 2 examples:
  one for order create (with "Send Order" primary action) and one for delete
  (with "Undo" primary action).
- **Edge cases**: A0 may wrap JSON in markdown code blocks — frontend must handle
- **touches**: [_25_restaurant_context.py]
- **provides**: [card JSON schema in A0 system prompt]

### Task 1b: Update agent profile prompts with card JSON examples
- **File**: `usr/agents/agm/prompts/agent.system.main.role.md`
- **File**: `usr/agents/souschef/prompts/agent.system.main.role.md`
- **File**: `usr/agents/executivechef/prompts/agent.system.main.role.md`
- **File**: `usr/agents/marketing/prompts/agent.system.main.role.md`
- **Logic**: Each agent's NOTIFY section should include a module-specific example
  of the card JSON. AGM shows orders example, souschef shows prep, etc.
- **touches**: [4 agent prompt files]
- **provides**: [per-agent card JSON examples]
- **depends_on**: [task-1a for schema definition]

## Failure Scenarios

| When | Then | Error |
|------|------|-------|
| A0 sends invalid JSON in detail | Frontend falls back to flat text display | No crash — graceful degradation |
| A0 omits detail field entirely | Frontend uses title/message only (current behavior) | No change from today |
| A0 sends actions but misspells field | Frontend ignores unknown fields, shows defaults | Fallback to getActionLabel() |

## Rejection Criteria
- DO NOT create a new A0 tool — use existing notify_user
- DO NOT add new Socket.IO events — use existing state_push pipeline
- DO NOT make the JSON schema more than 10 fields — keep token cost low
- DO NOT require A0 to always send perfect JSON — MUST degrade gracefully

## Cross-Phase Context
- **Assumes**: notify_user pipeline works (verified in session 15)
- **Exports**: A0 sends `detail` field containing JSON with actions/stats/module
- **Phase 2 needs**: the exact JSON schema defined here to parse in notificationToCard()

## Acceptance Criteria
- [ ] A0 system prompt includes card JSON schema with examples
- [ ] Agent profiles include module-specific notify_user examples with JSON detail
- [ ] Schema is minimal (≤10 fields) to limit token cost
- [ ] A0 sends structured detail JSON after a CLI write (verified in Docker logs)
