# Phase 4: Persistence — sessionStorage Card State

## Goal
Cards survive page refresh within a browser tab. Use sessionStorage to persist card state — no DB table, no backend changes.

## Data Flow
```
Socket.IO "action_card" → useActionCards state update
    → serialize cards to sessionStorage("cos_action_cards")
    → on mount: hydrate from sessionStorage
    → on card commit/dismiss: update sessionStorage
```

## Code Contracts

```typescript
// In use-action-cards.ts
const STORAGE_KEY = "cos_action_cards";
const THREAD_STORAGE_KEY = "cos_card_threads";

// Persist on every state change
useEffect(() => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}, [cards]);

// Hydrate on mount
const [cards, setCards] = useState<ActionCard[]>(() => {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
});
```

## Tasks

### Wave 1 (no dependencies)

- [ ] Task 1 — Persist cards to sessionStorage
  - File: `frontend/src/hooks/use-action-cards.ts` (modify)
  - Test: N/A (browser behavior — manual test)
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(cards): persist action cards in sessionStorage`
  - Logic:
    - Initialize `cards` state from sessionStorage (lazy initializer in useState)
    - Add useEffect that writes `cards` to sessionStorage on every change
    - Key: `cos_action_cards`
    - Handle SSR: guard sessionStorage access with `typeof window !== "undefined"`
    - Parse safely: wrap JSON.parse in try/catch, fallback to empty array
  - Edge: corrupted sessionStorage data → clear it, start fresh
  - Edge: SSR/hydration mismatch → initialize with empty array on server, hydrate on client

- [ ] Task 2 — Persist chat threads to sessionStorage
  - File: `frontend/src/hooks/use-action-cards.ts` (modify)
  - depends_on: [Task 1]
  - Test: N/A (browser behavior)
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(cards): persist card chat threads in sessionStorage`
  - Logic:
    - chatThreads is a Map — serialize as Object.fromEntries
    - Key: `cos_card_threads`
    - Same SSR guards as Task 1
    - Hydrate: new Map(Object.entries(parsed))
  - Edge: Map serialization — must convert to/from plain object

- [ ] Task 3 — Clear stale cards on session start
  - File: `frontend/src/hooks/use-action-cards.ts` (modify)
  - depends_on: [Task 1]
  - Test: N/A
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(cards): auto-clear cards older than 24h`
  - Logic:
    - On hydration, filter out cards where `Date.now()/1000 - card.timestamp > 86400`
    - Also filter out dismissed cards (status === "dismissed")
    - This prevents stale cards from accumulating

## Failure Scenarios

| When | Then | Error Type |
|------|------|-----------|
| sessionStorage unavailable (incognito/full) | Silent fallback — cards work but don't persist | No error |
| Corrupted JSON in storage | Clear storage, start with empty array | Caught by try/catch |
| SSR renders with no window | Initialize empty, hydrate on client mount | No error |
| 100+ cards in storage | 24h cleanup keeps it bounded | No error |
| Hydration mismatch (server [] vs client [cards]) | Use useEffect for client-only hydration, not useState initializer | No error |

## Rejection Criteria (DO NOT)
- DO NOT use localStorage — sessionStorage is per-tab, which is correct for this use case
- DO NOT add backend persistence — this is frontend-only
- DO NOT modify the ActionCard interface
- DO NOT persist to a database
- DO NOT use a state management library (Redux, Zustand) — keep it in the existing hook
- DO NOT break SSR — all sessionStorage access must be client-side only

## Cross-Phase Context
- **Assumes**: Phases 1-3 deliver working card emission, rendering, and chat. This phase adds durability.
- **No exports**: This is the final phase. No downstream dependencies.
- **Interface contract**: No changes to ActionCard type or hook return type. Persistence is transparent to consumers.

## Acceptance Criteria
- [ ] Cards survive page refresh (F5)
- [ ] Chat threads survive page refresh
- [ ] Cards older than 24h are auto-cleaned on load
- [ ] Dismissed cards are cleaned on load
- [ ] SSR works without hydration errors
- [ ] sessionStorage failure is silent (no crashes)
- [ ] `pnpm build` passes

## Files Touched
- `frontend/src/hooks/use-action-cards.ts` — modify (add sessionStorage read/write)
