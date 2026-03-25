# Phase 1: action_card Tool + Socket.IO Emit

## Goal
Create a new A0 tool that lets the LLM emit structured action cards directly via Socket.IO. Add a system prompt extension teaching A0 when/how to use it.

## Data Flow
```
A0 LLM → action_card tool(type, module, summary, ...)
    → get sio from agent.config.additional["sio"]
    → sio.emit("action_card", {card}, namespace="/state_sync")
    → Frontend useActionCards receives via socket.on("action_card")
```

## Code Contracts

```python
# python/tools/action_card.py
class ActionCardTool(Tool):
    """Emit a structured action card to the chef's notification panel."""
    async def execute(self, **kwargs) -> Response:
        # self.args keys: type, module, summary, detail, action,
        #   stats (list[{label,value}]), changes (list[{op,text}]),
        #   priority (0|1|2), deadline (ISO string|None)
        # Emits via sio.emit("action_card", {card: {...}})
        # Returns Response confirming card was sent
```

```markdown
# usr/extensions/system_prompt/_action_cards.md
Teaches A0:
- Use action_card tool after DB writes, alerts, proactive insights
- type: urgent (needs immediate action), action (needs approval),
        update (FYI, something changed), info (background context)
- module: orders, inventory, prep, food_cost, menu, recipes, invoices, marketing, reporting
- Include stats [{label, value}] for KPIs, changes [{op, text}] for diffs
- priority: 0=low, 1=high, 2=critical. Set deadline for time-sensitive items.
```

## Tasks

### Wave 1 (parallel — no dependencies)

- [ ] Task 1 — Create action_card tool
  - File: `python/tools/action_card.py` (new)
  - Test: `tests/test_action_card_tool.py` (new)
  - Verify: `pytest tests/test_action_card_tool.py -v`
  - Commit: `feat(tools): add action_card tool for direct sio emit`
  - Logic:
    - Extract args: type, module, action, summary, detail, stats, changes, priority, deadline
    - Generate UUID id, set status="new", timestamp=int(time.time()), source="reactive"
    - Get sio from `self.agent.config.additional.get("sio")` (fallback: import from run_ui)
    - `await sio.emit("action_card", {"card": card_dict}, namespace="/state_sync")`
    - Return Response(message="Action card sent to chef.", break_loop=False)
  - Edge: missing sio → log warning, still return success (card lost but agent continues)
  - Edge: missing required fields (type, module, summary) → return error Response

- [ ] Task 2 — Create system prompt extension
  - File: `usr/extensions/system_prompt/_action_cards.md` (new)
  - Test: N/A (prompt file, tested via integration)
  - Verify: `cat usr/extensions/system_prompt/_action_cards.md`
  - Commit: `feat(prompts): teach A0 when/how to emit action cards`
  - Content: Instructions for A0 on when to use action_card tool:
    - After any successful DB write (create/update/delete) — type=update
    - When detecting anomalies (high food cost, low inventory) — type=urgent
    - When completing a requested task — type=info
    - When something needs chef approval — type=action
    - Always include relevant stats and changes
    - Set priority=2 and deadline for time-sensitive items

### Wave 2 (depends on Wave 1)

- [ ] Task 3 — Register tool in A0 tool registry
  - File: Check how other tools like `notify_user` are registered. May be auto-discovered from `python/tools/` or may need explicit registration.
  - depends_on: [Task 1]
  - Test: N/A (integration — verify tool appears in A0 tool list)
  - Verify: Start backend, check tool is available
  - Commit: `chore: register action_card tool` (if needed)
  - Logic: Follow same registration pattern as notify_user.py

- [ ] Task 4 — Write integration test
  - File: `tests/test_action_card_tool.py` (modify — add integration case)
  - depends_on: [Task 1]
  - Test: N/A — this IS the test
  - Verify: `pytest tests/test_action_card_tool.py -v`
  - Commit: `test(tools): integration tests for action_card emit`
  - Cases:
    - Valid card with all fields → emits via sio
    - Minimal card (type + module + summary only) → fills defaults, emits
    - Missing summary → returns error
    - No sio available → logs warning, returns gracefully

## Failure Scenarios

| When | Then | Error Type |
|------|------|-----------|
| Missing type/module/summary | Return error Response with message | No exception (tool returns error) |
| sio not available | Log warning, return success (card lost) | No exception |
| sio.emit raises | Catch, log error, return success | Logged exception |
| Invalid type value | Default to "info" | No error |
| Invalid priority value | Default to 0 | No error |

## Rejection Criteria (DO NOT)
- DO NOT modify `python/tools/notify_user.py` — it's A0 core
- DO NOT modify `_30_action_card_emit.py` — leave it as fallback for now
- DO NOT parse text/JSON from responses — the tool receives structured args directly
- DO NOT add DB persistence for cards — that's Phase 4
- DO NOT add complex validation — trust the LLM, provide sensible defaults

## Cross-Phase Context
- **Assumes**: Frontend `useActionCards` hook already listens for `action_card` Socket.IO events and renders them. ActionCard type interface defined in `lib/types.ts`.
- **Exports for Phase 2**: Cards will start appearing in the notification panel. Phase 2 polishes how they look.
- **Exports for Phase 3**: card_message handler needs to know card context. Phase 1 doesn't persist cards, so Phase 3 may need to track them.

## Acceptance Criteria
- [ ] `action_card` tool exists and can be called by A0
- [ ] Tool emits valid ActionCard JSON via Socket.IO on `/state_sync`
- [ ] System prompt extension teaches A0 when to use the tool
- [ ] All tests pass
- [ ] Cards appear in frontend notification panel when tool is called
- [ ] No modifications to A0 core files

## Files Touched
- `python/tools/action_card.py` — new
- `usr/extensions/system_prompt/_action_cards.md` — new
- `tests/test_action_card_tool.py` — new
