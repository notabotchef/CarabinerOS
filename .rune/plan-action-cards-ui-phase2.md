# Phase 2: Solitaire Card Redesign

## Goal
Transform action cards from a flat list into a solitaire-style 2-column card grid with flip-to-expand animation. Add contextual action buttons, chat suggestions, and a completed-cards section. Run rune:design first to establish restaurant-first visual identity.

## Data Flow
```
ActionCard[] → 2-col grid layout → click card → flip animation (full-width) → inline expand
                                                    ↓
                                    other cards push away (layout animation)
                                                    ↓
                              expanded view: stats + changes + ✗/✓ buttons + chat chips
                                                    ↓
                              committed cards → green section at bottom (still expandable)
```

## Code Contracts

```tsx
// types.ts — add suggested action field
interface ActionCard {
  // ... existing fields
  suggestedAction?: string;    // Pre-filled chat suggestion, e.g. "Want me to order more?"
  suggestedChips?: string[];   // Quick-action chip labels, e.g. ["Notify everyone", "86 it"]
}

// Helper: generate default suggestions based on card type + module
function getDefaultSuggestion(card: ActionCard): string;
function getDefaultChips(card: ActionCard): string[];

// Action button labels per type/module
const ACTION_LABELS: Record<string, Record<string, string>> = {
  urgent:    { orders: "Confirm", inventory: "86 It", default: "Act Now" },
  action:    { inventory: "Order Now", menu: "Add to Menu", default: "Take Action" },
  update:    { prep: "Mark Done", invoices: "Approve", default: "Acknowledge" },
  info:      { default: "Got It" },
};
```

## Pre-Work: Design System

Before coding, run `rune:design` to establish:
- Card visual language that says "restaurant" not "chatbot" — think ticket printers, kitchen display screens, order chits
- Color palette for card states (keep existing type colors but refine)
- Typography/spacing for the solitaire grid
- Flip animation style reference
- The agent has FULL creative freedom and SHOULD research online for inspiration (Dribbble, kitchen display systems, POS interfaces)

Save design decisions to `.rune/design-system.md` for reference.

## Tasks

### Wave 1 (foundation — no dependencies)

- [ ] Task 1 — Run rune:design for card visual identity
  - Output: `.rune/design-system.md` with card-specific design tokens
  - What: Invoke rune:design focusing on action card components. Research restaurant POS, kitchen display systems, ticket printers for inspiration. Define card surface treatment, typography, spacing, animation curves. Must move away from generic "AI dashboard" look.
  - Commit: N/A (design artifact, not code)

- [ ] Task 2 — Add suggestedAction and suggestedChips to ActionCard type
  - File: `frontend/src/lib/types.ts` (modify — add 2 optional fields to ActionCard interface)
  - What: Add `suggestedAction?: string` and `suggestedChips?: string[]` to the ActionCard interface
  - Verify: `cd frontend && npx tsc --noEmit`
  - Commit: `feat(types): add suggestedAction and suggestedChips to ActionCard`

### Wave 2 (depends on Wave 1)

- [ ] Task 3 — Redesign ActionCard as solitaire card with action buttons
  - File: `frontend/src/components/action-card.tsx` (rewrite)
  - depends_on: [Task 1, Task 2]
  - What: Redesign the collapsed card to work in a 2-column grid. Apply design system from Task 1. Add a primary action button (label from ACTION_LABELS map based on type + module). Card should have a "face-down" feel that invites flipping. Include ✗ (red/dismiss) and ✓ (green/commit) small icon buttons. Keep: module icon, type dot, summary text, deadline badge, relative time.
  - Verify: `cd frontend && npx tsc --noEmit`
  - Commit: `feat(cards): solitaire card design with action buttons`

- [ ] Task 4 — Create suggestion helpers
  - File: `frontend/src/components/action-card-expanded.tsx` (modify — add helper functions)
  - depends_on: [Task 2]
  - What: Add `getDefaultSuggestion(card)` and `getDefaultChips(card)` functions. Map card type + module to contextual suggestions:
    - inventory low stock → "Want me to place an emergency order?"
    - orders rush → "Should I notify the kitchen?"
    - menu new dish → "Add this to tonight's specials?"
    - invoices received → "Approve all matched invoices?"
    - prep update → "Mark these as complete?"
    - food-cost report → "Send this to the team?"
    - Default chips: ["Notify team", "Remind me later", "Show details"]
  - Verify: `cd frontend && npx tsc --noEmit`
  - Commit: `feat(cards): contextual suggestion helpers for chat pre-fill`

### Wave 3 (depends on Wave 2)

- [ ] Task 5 — Rebuild notification panel with 2-col grid + inline flip expand
  - File: `frontend/src/components/notification-panel.tsx` (rewrite)
  - depends_on: [Task 3, Task 4]
  - What: Replace the current AnimatePresence list/expanded view swap with:
    1. A 2-column CSS grid (`grid-cols-2 gap-3`) for cards
    2. When a card is clicked: it expands to `col-span-2` full width with a flip animation (rotateY or scale+fade). Other cards animate away (Framer Motion `layout` prop handles this automatically).
    3. Expanded card shows inline: stats grid, changes diff, ✗/✓ buttons with suggestion text, chat input with pre-filled suggestion, quick-action chips above input.
    4. Completed (committed) cards section at bottom: green-tinted background (`bg-emerald-500/5 border-emerald-500/15`), grouped under a "Completed" divider. Still expandable. On hover, show a dismiss ✗ button.
    5. Keep the Sheet container, urgency banner, empty state.
    6. Ensure `min-h-0` on scroll containers (from Phase 1).
  - Verify: `cd frontend && npx tsc --noEmit`
  - Commit: `feat(cards): solitaire 2-col grid with flip-expand animation`

- [ ] Task 6 — Add quick-action chips and pre-filled chat to expanded view
  - File: `frontend/src/components/action-card-expanded.tsx` (modify)
  - depends_on: [Task 4, Task 5]
  - What: Since the expanded view is now inline (not a separate view), modify the chat section to:
    1. Show quick-action chips above the input (horizontal scroll, pill buttons)
    2. Pre-fill the input placeholder with `suggestedAction` or `getDefaultSuggestion(card)`
    3. Clicking a chip fills the input and auto-sends
    4. Keep existing chat thread, loading state, send button
  - Verify: `cd frontend && npx tsc --noEmit`
  - Commit: `feat(cards): quick-action chips and pre-filled chat suggestions`

### Wave 4 (depends on Wave 3)

- [ ] Task 7 — Update use-action-cards hook for completed card sorting
  - File: `frontend/src/hooks/use-action-cards.ts` (modify sortCards function)
  - depends_on: [Task 5]
  - What: Modify `sortCards()` to put committed cards at the end (after all active cards). Within committed cards, sort by timestamp DESC (most recently committed first). Add a `committedCards` computed value to the hook return for the panel to use for the separated section.
  - Verify: `cd frontend && npx tsc --noEmit`
  - Commit: `feat(cards): sort committed cards to bottom + expose committedCards`

## Failure Scenarios

| When | Then | Error Type |
|------|------|-----------|
| Card has no suggestedAction | Use getDefaultSuggestion() fallback based on type+module | No error |
| Card has no suggestedChips | Use getDefaultChips() fallback | No error |
| Only 1 card in grid | Single card spans full width, no 2-col needed | No error |
| All cards committed | Active section empty, completed section shows all | No error |
| Flip animation on slow device | Use `prefers-reduced-motion` — skip flip, use fade | No error |
| Card type not in ACTION_LABELS | Fall back to "default" key | No error |

## Rejection Criteria
- DO NOT use a separate full-screen view for expanded cards — expand INLINE in the grid
- DO NOT remove the Sheet container — keep it as the panel shell
- DO NOT break existing Socket.IO card delivery — suggestedAction/suggestedChips are optional fields
- DO NOT use generic "AI dashboard" styling — restaurant-first visual identity (rune:design output)
- DO NOT hardcode suggestions in the component — use the helper functions for maintainability
- DO NOT remove the existing card chat functionality — enhance it, don't replace it

## Cross-Phase Context
- **Assumes from Phase 1**: Scroll fix (`min-h-0` on flex containers), button overlap fix in header
- **Exports**: Final card UI. No future phases depend on this — this is the terminal phase.

## Acceptance Criteria
- [ ] Cards display in 2-column grid inside the notification panel
- [ ] Clicking a card triggers a flip/expand animation to full-width
- [ ] Other cards push away smoothly during expand (Framer Motion layout)
- [ ] Each card has contextual action button (label matches type + module)
- [ ] ✗ (red) and ✓ (green) buttons visible on each card
- [ ] Chat input pre-filled with contextual suggestion
- [ ] Quick-action chips appear above chat input, clicking sends message
- [ ] Committed cards grouped at bottom with green tint, still expandable
- [ ] Hover on committed card reveals dismiss button
- [ ] Design passes the "not another Claude website" test — looks like restaurant software
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `prefers-reduced-motion` respected for flip animation
