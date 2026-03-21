# Phase 2: Collapsed Card + Panel UI

## Goal
Evolve the existing ActionCard component and NotificationPanel to use the new types and hook. Cards render in the slide-over panel with urgency banner and proper sorting.

## Tasks

- [ ] **T2.1** Rewrite `frontend/src/components/action-card.tsx` (collapsed card)
  - Use new `ActionCard` type from types.ts
  - Pulsing colored dot per type (urgent=amber, action=blue, update=green, info=violet)
  - Type + Module tags (e.g., "URGENT · ORDERS")
  - Summary text, relative timestamp
  - Optional deadline badge for time-sensitive cards
  - Amber glow border (warm-glow class) for urgent cards
  - Slightly bigger than current cards
  - onClick prop to expand card
  - Warm hospitality palette (oklch hue 50-70)

- [ ] **T2.2** Rewrite `frontend/src/components/notification-panel.tsx`
  - Wire to `useActionCards` hook (sortedCards, unreadCount, urgentBanner)
  - Urgency banner at top when urgentBanner is non-null
  - Banner: amber background, count + earliest deadline text
  - Render sortedCards as ActionCard components
  - Empty state: "All clear. Nothing to review."
  - Pass onExpand to each card

- [ ] **T2.3** Update `frontend/src/app/layout.tsx` or relevant page to wire useActionCards
  - Ensure the hook is initialized in the component tree
  - Pass unreadCount to TopBar (already wired)
  - Pass cards + panel state to NotificationPanel

## Code Contracts

```typescript
// T2.1 — ActionCard component props
interface ActionCardProps {
  card: ActionCard;
  onExpand: (id: string) => void;
  onCommit: (id: string) => void;
  onDismiss: (id: string) => void;
}

// T2.2 — NotificationPanel props (evolved)
interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: ActionCard[];
  urgentBanner: { count: number; earliestDeadline: string } | null;
  unreadCount: number;
  onExpand: (id: string) => void;
  onCommit: (id: string) => void;
  onDismiss: (id: string) => void;
}
```

## Rejection Criteria
- Must use warm hospitality palette (oklch, not hex/rgb for theme colors)
- Must use glass-subtle and warm-glow CSS classes where appropriate
- Urgent cards must be visually distinct at a glance
- Panel must handle 0, 1, and 20+ cards gracefully

## Cross-Phase Context
- Imports from Phase 1: `ActionCard` type, `useActionCards` hook
- Phase 3 will add: expanded card view that replaces the panel content when a card is tapped
