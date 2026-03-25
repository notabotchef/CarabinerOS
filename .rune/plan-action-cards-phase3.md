# Phase 3: Card Chat — Wire card_message to A0

## Goal
Replace the stub `card_message` handler with real A0 agent routing. When the user types in a card's inline chat, A0 processes the message with card context and returns a real response.

## Data Flow
```
User types in card chat input
    → Frontend emits "card_message" { cardId, text }
    → action_cards_handler.py receives event
    → Finds or creates A0 agent context with card info injected
    → A0 processes message (LLM call)
    → Handler emits "card_reply" { cardId, message: { role, text, timestamp } }
    → Frontend appends to chat thread, hides loading spinner
```

## Code Contracts

```python
# python/websocket_handlers/state_sync_handler/action_cards_handler.py
class ActionCardsHandler(WebSocketHandler):
    async def _handle_message(self, card_id: str, data: dict, sid: str) -> WebSocketResult:
        """Route card message to A0 for processing."""
        # 1. Get card context from data (summary, module, type)
        # 2. Build a prompt: "The chef is responding to action card: {summary}. Their message: {text}"
        # 3. Use A0's message processing to get a response
        # 4. Emit card_reply with the response
```

## Tasks

### Wave 1 (no dependencies)

- [ ] Task 1 — Wire card_message to A0 agent
  - File: `python/websocket_handlers/state_sync_handler/action_cards_handler.py` (modify)
  - Test: `tests/test_action_cards_handler.py` (new)
  - Verify: `pytest tests/test_action_cards_handler.py -v`
  - Commit: `feat(cards): wire card_message to A0 agent processing`
  - Logic:
    - In `_handle_message`, extract `text` and optional `card` context from data
    - Card context includes: summary, module, type, detail, changes, stats (sent by frontend)
    - Build context prompt: "Chef is responding to a {type} action card about {module}: '{summary}'. Message: {text}"
    - Use AgentContext or the message processing pipeline to get A0's response
    - Look at how the main chat `/message` endpoint works in `python/api/` to understand A0 message routing
    - Extract the text response from A0
    - Emit `card_reply` with `{ cardId, message: { role: "assistant", text: response_text, timestamp: time.time() } }`
  - Edge: A0 takes too long → set a timeout (30s), return "I'm still working on this. Please check back."
  - Edge: A0 errors → catch, return "Something went wrong. Try asking in the main chat."

- [ ] Task 2 — Send card context with card_message from frontend
  - File: `frontend/src/hooks/use-action-cards.ts` (modify)
  - Test: N/A (integration)
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(cards): send card context with card_message event`
  - Logic:
    - In `sendCardMessage`, find the card by id from the cards array
    - Include card context in the emitted event: `{ cardId, text, card: { summary, module, type, detail } }`
    - This gives the backend enough context without needing card persistence

## Failure Scenarios

| When | Then | Error Type |
|------|------|-----------|
| A0 agent not available | Return fallback message "Agent unavailable" | Logged warning |
| A0 times out (>30s) | Return timeout message | Logged warning |
| A0 throws exception | Return error message, log exception | Logged error |
| Empty text | Return error (already handled) | MISSING_TEXT |
| Card context missing | Process with just the text, no card context | No error |

## Rejection Criteria (DO NOT)
- DO NOT create a separate agent/sub-agent system — use existing A0 message pipeline
- DO NOT add card persistence/storage — keep it stateless (card context sent from frontend)
- DO NOT modify the frontend ActionCard interface
- DO NOT block the WebSocket event handler — process A0 call asynchronously
- DO NOT modify A0 core files — work within the handler

## Cross-Phase Context
- **Assumes**: Phase 1 delivers working action_card tool. Phase 2 delivers polished card UI with inline chat input (already exists from prior work).
- **Assumes**: Frontend already emits `card_message { cardId, text }` and listens for `card_reply { cardId, message }` — this is implemented in `use-action-cards.ts`.
- **Exports for Phase 4**: Card context is sent from frontend, not stored server-side. Phase 4 (persistence) only needs to persist card state in sessionStorage, not chat threads.

## Acceptance Criteria
- [ ] User types in card chat → receives real A0 response (not stub)
- [ ] Card context (summary, module, type) is included in A0 prompt
- [ ] Errors handled gracefully — user always gets a response
- [ ] Loading spinner shows while A0 processes
- [ ] `pnpm build` passes, `pytest` passes
- [ ] No A0 core files modified

## Files Touched
- `python/websocket_handlers/state_sync_handler/action_cards_handler.py` — modify
- `frontend/src/hooks/use-action-cards.ts` — modify (add card context to emit)
- `tests/test_action_cards_handler.py` — new
