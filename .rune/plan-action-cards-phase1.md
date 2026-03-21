# Phase 1: Types + useActionCards Hook

## Goal
Establish the data layer — updated TypeScript types and a new hook that manages card state from Socket.IO events.

## Tasks

- [ ] **T1.1** Update `ActionCard` type in `frontend/src/lib/types.ts`
  - Replace existing ActionCard interface wholesale
  - Add `CardChatMessage` interface
  - Add `ActionCardChange` and `ActionCardStat` helper types

- [ ] **T1.2** Create `useActionCards` hook at `frontend/src/hooks/use-action-cards.ts`
  - State: `cards: ActionCard[]`, per-card chat threads `Map<string, CardChatMessage[]>`
  - Computed: `unreadCount`, `sortedCards` (priority DESC → deadline ASC → timestamp DESC)
  - Computed: `urgentBanner` (cards with priority >= 1 and deadline within 4 hours)
  - Actions: `commitCard(id)`, `dismissCard(id)`, `sendCardMessage(id, text)`, `expandCard(id)`, `collapseCard()`
  - Receives socket instance from context, listens for `action_card` and `card_reply` events
  - New card with existing id → replace. New id → append.
  - Mark cards as "read" when panel opens

- [ ] **T1.3** Register Socket.IO listeners in `frontend/src/components/socket-provider.tsx`
  - Add `action_card` and `card_reply` event listeners alongside existing `state_push`
  - Pass socket to useActionCards hook via context or direct ref

## Code Contracts

```typescript
// T1.1 — types.ts additions
export interface ActionCardChange { op: "+" | "!" | "→"; text: string }
export interface ActionCardStat { label: string; value: string }
export interface ActionCard { /* per spec */ }
export interface CardChatMessage { role: "user" | "assistant"; text: string; timestamp: number }

// T1.2 — hook return type
interface UseActionCardsReturn {
  cards: ActionCard[];
  sortedCards: ActionCard[];
  unreadCount: number;
  urgentBanner: { count: number; earliestDeadline: string } | null;
  expandedCardId: string | null;
  chatThread: (cardId: string) => CardChatMessage[];
  commitCard: (id: string) => void;
  dismissCard: (id: string) => void;
  sendCardMessage: (id: string, text: string) => void;
  expandCard: (id: string) => void;
  collapseCard: () => void;
}
```

## Rejection Criteria
- Hook must not break existing socket functionality (state_push, chef_status)
- Types must not break existing components that import from types.ts
- No new dependencies

## Cross-Phase Context
- Phase 2 imports: `useActionCards` hook, `ActionCard` type, `CardChatMessage` type
- Phase 3 imports: all of Phase 2 exports + `expandCard`, `collapseCard`, `chatThread`, `sendCardMessage`
