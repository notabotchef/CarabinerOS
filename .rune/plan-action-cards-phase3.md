# Phase 3: Expanded Card + Inline Chat UI

## Goal
Build the full panel takeover view when a card is tapped. Includes detail grid, changes diff, and inline chatbox.

## Tasks

- [ ] **T3.1** Create `frontend/src/components/action-card-expanded.tsx`
  - Full panel takeover (replaces card list when expandedCardId is set)
  - Header: Back button (left) + Dismiss text + Commit checkmark button (right, green)
  - Type/module tag badges
  - Title (bold, larger font)
  - Detail text (Expo's full description)
  - Stats grid (2x2, max 4 stats) with label/value in rounded boxes
  - "What changed" section — diff-style list with +/!/→ markers
  - Warm hospitality palette for all colors

- [ ] **T3.2** Add inline chat to expanded card
  - Chat thread display (CardChatMessage[] for this card)
  - Text input + send button at bottom
  - Optimistic user message append on send
  - Assistant replies arrive via card_reply socket event
  - Loading state while waiting for reply
  - Label: "Make changes to this [module]"

- [ ] **T3.3** Wire expanded view into NotificationPanel
  - When expandedCardId is set, render ActionCardExpanded instead of card list
  - Back button calls collapseCard()
  - Commit button calls commitCard(id) then collapseCard()
  - Dismiss calls dismissCard(id) then collapseCard()
  - Transition: simple fade or slide (framer-motion)

## Code Contracts

```typescript
// T3.1+T3.2 — ActionCardExpanded props
interface ActionCardExpandedProps {
  card: ActionCard;
  chatThread: CardChatMessage[];
  onBack: () => void;
  onCommit: (id: string) => void;
  onDismiss: (id: string) => void;
  onSendMessage: (id: string, text: string) => void;
  chatLoading: boolean;
}
```

## Rejection Criteria
- Inline chat must not bleed into main chat
- Commit checkmark must be clearly visible and tappable
- Stats grid must handle 0-4 stats gracefully
- Changes list must handle 0-10+ changes
- Chat input must be usable on mobile (touch-friendly sizing)

## Cross-Phase Context
- Imports from Phase 1: `ActionCard`, `CardChatMessage` types
- Imports from Phase 2: integrated into NotificationPanel
- Phase 4 (backend) will emit the action_card and card_reply events this UI consumes
