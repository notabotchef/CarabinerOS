# Phase 2: Frontend — ModuleChat Reads chat_context_id From Record

## Data Flow
```
Order detail panel loads order from API
  → order.chat_context_id = "03S9Iu7R"
  → passes to ModuleChat as prop
  → ModuleChat subscribes to context "03S9Iu7R"
  → useChat processes snapshot → shows conversation that created this order
  → user types → message goes to same conversation with [module=orders] prepended
```

## Code Contracts

### ModuleChat new prop
```typescript
interface ModuleChatProps {
  moduleId: string;
  buildContext: () => string;
  chatContextId?: string | null;  // ← NEW: from record's chat_context_id
  placeholder?: string;
  chips?: string[];
  onMessageSent?: () => void;
}
```

### Subscribe logic
```typescript
// On mount: if record has a chat_context_id, subscribe to it
useEffect(() => {
  if (chatContextId) {
    subscribe(chatContextId);
  }
}, [chatContextId, subscribe]);
```

## Tasks

### Wave 1

#### Task 2a: Add chatContextId prop to ModuleChat
- **File**: `frontend/src/components/module-chat.tsx`
- **Logic**: Add optional `chatContextId` prop. On mount, if provided and non-null,
  subscribe to that context. Remove the `activeContextId` from Shell approach
  (replaced by record-level prop). If chatContextId is null/undefined, don't subscribe
  (side-chat starts fresh when user types).
- **touches**: [module-chat.tsx]
- **provides**: [ModuleChat subscribes to record's chat context]

### Wave 2 (depends on 2a)

#### Task 2b: Pass chat_context_id from order detail panel
- **File**: `frontend/src/app/orders/components/order-detail-panel.tsx`
- **Logic**: The order object from the API now has `chat_context_id`. Pass it to
  ModuleChat: `<ModuleChat chatContextId={order?.chat_context_id} ... />`
- **Edge case**: order.chat_context_id may be null for old orders → ModuleChat handles this
- **touches**: [order-detail-panel.tsx]
- **requires**: [chatContextId prop from 2a]
- **depends_on**: [task-2a]

#### Task 2c: Clean up Shell activeContextId (remove dead code)
- **File**: `frontend/src/components/shell.tsx`
- **File**: `frontend/src/app/chat/[contextId]/page.tsx`
- **Logic**: Remove `activeContextId` and `setActiveContextId` from ShellContext — no
  longer needed since chat association is record-level, not session-level.
- **touches**: [shell.tsx, chat/[contextId]/page.tsx]
- **depends_on**: [task-2a, task-2b]

## Failure Scenarios

| When | Then | Error |
|------|------|-------|
| order.chat_context_id is null | ModuleChat doesn't subscribe, starts fresh | Normal — old records |
| order.chat_context_id points to deleted chat | Subscribe returns empty snapshot | Side-chat shows empty — user can start new |
| User navigates between orders | chatContextId prop changes, re-subscribes | Correct — each order shows its own chat |
| A0 container restarted (chats lost) | Context ID exists but chat gone | Side-chat empty — acceptable for dev |

## Rejection Criteria
- DO NOT store chat context in localStorage — it comes from the DB record
- DO NOT create separate chat contexts per order — attach to the EXISTING main chat
- DO NOT subscribe if chatContextId is null — let side-chat start fresh
- DO NOT keep the Shell activeContextId approach — replace it entirely

## Cross-Phase Context
- **Assumes Phase 1**: API returns chat_context_id on order objects
- **Exports**: Side-chat shows the conversation that created/modified each record

## Acceptance Criteria
- [ ] ModuleChat accepts chatContextId prop
- [ ] Order detail panel passes order.chat_context_id to ModuleChat
- [ ] Clicking different orders shows different conversations in side-chat
- [ ] Orders without chat_context_id show empty side-chat (fresh start)
- [ ] Shell activeContextId dead code removed
- [ ] TypeScript compiles with no new errors

## Outcome
### What Was Planned
2-phase plan: backend stores chat_context_id on DB records (Phase 1), frontend
reads it and subscribes the side-chat to the right conversation (Phase 2).

### Immediate Next Action
Execute Phase 1: add ChatContextMixin to base.py and apply to workspace models.

### How to Measure
| Check | Command |
|-------|---------|
| Column exists | `docker exec carabiner-os-agent-zero-1 carabiner orders list --json \| python3 -c "import sys,json; print(json.load(sys.stdin)['orders'][0].keys())"` |
| CLI accepts flag | `docker exec carabiner-os-agent-zero-1 carabiner orders create --help \| grep chat-context` |
| API returns field | `curl -s localhost:8080/api/orders \| python3 -c "import sys,json; print(json.load(sys.stdin)[0].get('chat_context_id'))"` |
| Side-chat shows conversation | Visual: click order that was created via chat → see conversation |
| TS compiles | `cd frontend && npx tsc --noEmit` |
