# Phase 4: Expo Agent (Backend)

## Goal
Create the Expo Agent profile in usr/agents/expo/, update A0's system prompt to delegate card-worthy mutations, and add Socket.IO event handlers for card interactions.

## Tasks

- [ ] **T4.1** Create Expo agent profile at `usr/agents/expo/agent.md`
  - System prompt defining Expo's role: format action cards, assess urgency, run daily sweeps
  - Instructions for reactive mode: receive delegation from A0, return structured ActionCard JSON
  - Instructions for proactive mode: query DB for today's operations, generate cards for attention-worthy items
  - Scope constraint: today's business day only
  - Card schema documentation embedded in prompt

- [ ] **T4.2** Update A0's system prompt in `usr/prompts/default/agent.system.md`
  - Add instruction to delegate card-worthy DB mutations to Expo agent
  - Define what "card-worthy" means (not typo fixes, not minor edits)
  - Include delegation format with context (what was done, why, relevant business context)

- [ ] **T4.3** Add Socket.IO event handlers for card interactions
  - Handler location: `usr/extensions/` (Agent Zero extension pattern)
  - `card_commit` handler — receives cardId, logs commit action
  - `card_dismiss` handler — receives cardId, logs dismiss
  - `card_message` handler — receives cardId + text, routes to A0 with card context
  - Emit `card_reply` back to client with A0's response
  - Emit `action_card` when Expo generates/updates a card

## Code Contracts

```python
# T4.3 — Socket.IO event payload schemas
# action_card (server → client)
{"card": {
    "id": "uuid", "type": "urgent|action|update|info",
    "module": "orders|prep|...", "action": "create|update|delete",
    "summary": "str", "detail": "str", "itemId": "uuid|null",
    "changes": [{"op": "+|!|→", "text": "str"}],
    "stats": [{"label": "str", "value": "str"}],
    "priority": 0|1|2, "deadline": "iso|null",
    "status": "new", "timestamp": 1234567890,
    "source": "reactive|proactive"
}}

# card_reply (server → client)
{"cardId": "uuid", "message": {"role": "assistant", "text": "str", "timestamp": 1234567890}}
```

## Rejection Criteria
- Must NOT modify Agent Zero core files (agent.py, python/, run_ui.py, initialize.py, webui/)
- All files in usr/ directory only
- Expo agent must return valid JSON matching the ActionCard schema
- Socket.IO handlers must not break existing state_push/chef_status flow
- Proactive sweep must filter to current business day only

## Cross-Phase Context
- Phase 1 defines the TypeScript ActionCard type — Phase 4 must emit matching JSON
- Phase 3 frontend consumes action_card and card_reply events emitted here
