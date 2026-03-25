# Phase 2: Visual Polish — Icons, Animations, Midnight Kitchen

## Goal
Make action cards feel premium: module icons on every card, card-stack arrival animation on the top-bar icon (back card flips to front with type color), polished Midnight Kitchen styling throughout.

## Data Flow
```
Socket.IO "action_card" event
    → useActionCards adds card to state
    → top-bar icon animates (back→front flip, type color flash)
    → notification panel card list animates new card in (slide + fade)
    → each card shows module icon matching sidebar nav
```

## Code Contracts

```typescript
// Module icon mapping — reuse lucide icons from sidebar
const MODULE_ICONS: Record<string, LucideIcon> = {
  orders: ShoppingCart,     // matches sidebar
  inventory: Package,       // matches sidebar
  prep: ChefHat,           // matches sidebar
  food_cost: DollarSign,   // matches sidebar
  menu: Utensils,          // matches sidebar
  recipes: BookOpen,       // matches sidebar
  invoices: FileText,      // matches sidebar
  marketing: Megaphone,    // matches sidebar
  reporting: BarChart3,    // matches sidebar
}

// Top-bar card-duo: new animation variant
const newCardVariants = {
  idle: { ... },
  hovered: { ... },
  notify: {
    // back card slides to front, takes type color, then settles
  }
}

// Card list entry animation
const cardEntryVariants = {
  initial: { opacity: 0, y: -20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, x: 100 }
}
```

## Tasks

### Wave 1 (parallel — no dependencies)

- [ ] Task 1 — Add module icons to collapsed cards
  - File: `frontend/src/components/action-card.tsx` (modify)
  - Test: N/A (visual — verify in browser)
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(ui): add module icons to action cards`
  - Logic:
    - Import lucide icons matching sidebar: ShoppingCart, Package, ChefHat, DollarSign, Utensils, BookOpen, FileText, Megaphone, BarChart3
    - Create MODULE_ICONS map (module string → icon component)
    - Render icon (size-3.5, muted-foreground/60) next to the type·module tag in card header
    - Fallback: if module not in map, show Info icon
  - Edge: unknown module → fallback icon, no crash

- [ ] Task 2 — Add module icons to expanded card
  - File: `frontend/src/components/action-card-expanded.tsx` (modify)
  - Test: N/A (visual)
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(ui): add module icons to expanded action card`
  - Logic:
    - Same MODULE_ICONS map (extract to shared file or duplicate — small enough to duplicate)
    - Show icon next to module tag in the expanded card header
    - Slightly larger (size-4) in expanded view

### Wave 2 (depends on Wave 1 for icon map)

- [ ] Task 3 — Card-stack arrival animation on top-bar icon
  - File: `frontend/src/components/top-bar.tsx` (modify)
  - depends_on: [Task 1]
  - Test: N/A (visual)
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(ui): card-stack flip animation on new card arrival`
  - Logic:
    - Add `lastCardType` prop (or derive from cards array) to TopBar
    - New animation variant `notify`: back card rotates to front position, temporarily takes type color (amber/blue/emerald/violet border+bg tint), then settles back
    - Trigger: when unreadCount increases (useEffect comparing prev value)
    - Animation sequence:
      1. Back card: rotate from 5° → -6° (swings to front), border-color → type color, bg → type color/10
      2. Front card: rotate from -2° → 8° (swings to back)
      3. Both settle back to idle after 600ms
    - Use framer-motion `useAnimation` controls to trigger programmatically
  - Edge: rapid multiple cards → debounce animation (only play once per 500ms)

- [ ] Task 4 — Card list entry/exit animations
  - File: `frontend/src/components/notification-panel.tsx` (modify)
  - depends_on: [Task 1]
  - Test: N/A (visual)
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(ui): smooth card entry/exit animations in panel`
  - Logic:
    - Wrap card list in AnimatePresence
    - Each ActionCard wrapped in motion.div with:
      - initial: { opacity: 0, y: -20, scale: 0.95 }
      - animate: { opacity: 1, y: 0, scale: 1 }
      - exit: { opacity: 0, x: 100, scale: 0.95 }
      - transition: spring, stiffness 300, damping 25
    - Use layout prop for smooth reordering when priority changes
    - Stagger children with delayChildren: 0.05

- [ ] Task 5 — Midnight Kitchen polish pass
  - File: `frontend/src/components/action-card.tsx` (modify)
  - File: `frontend/src/components/action-card-expanded.tsx` (modify)
  - File: `frontend/src/components/notification-panel.tsx` (modify)
  - depends_on: [Task 1, Task 2]
  - Test: N/A (visual)
  - Verify: `cd frontend && pnpm build`
  - Commit: `style(ui): Midnight Kitchen polish on action cards`
  - Logic:
    - Use glass-subtle on notification panel header
    - Urgent cards: warm-glow shadow (already defined in globals.css)
    - Stats grid: use primary/10 tint background instead of muted/30
    - "What changed" section: subtle left border accent matching change op color
    - Empty state: replace plain text with a subtle icon + warmer message
    - Committed cards: strikethrough on summary + emerald checkmark, not just opacity
  - Check light AND dark mode — both must look good with OKLCH variables

## Failure Scenarios

| When | Then | Error Type |
|------|------|-----------|
| Unknown module name | Show fallback Info icon | No error |
| Cards arrive faster than animation | Debounce top-bar animation to 500ms | No error |
| 0 cards → no animation trigger | useEffect guards on unreadCount > prev | No error |
| Very long summary text | CSS truncation (line-clamp-2) already in place | No error |

## Rejection Criteria (DO NOT)
- DO NOT rewrite components from scratch — enhance existing code
- DO NOT add new npm dependencies — lucide-react and framer-motion already installed
- DO NOT change the ActionCard TypeScript interface — work with existing fields
- DO NOT use hardcoded colors — use Tailwind utilities that respect OKLCH theme variables
- DO NOT add module icons as image files — use lucide-react components only

## Cross-Phase Context
- **Assumes**: Phase 1 delivers working action_card tool that emits cards via Socket.IO. If Phase 1 is not done, cards can be tested by manually emitting from browser console: `socket.emit("action_card", {card: {...}})`.
- **Exports for Phase 3**: Card expanded view is where inline chat lives. Visual polish here improves Phase 3's chat UX automatically.
- **No new interfaces or props** except: TopBar may need `lastCardType?: string` prop or access to cards array for animation trigger.

## Acceptance Criteria
- [ ] Every card shows its module icon (matching sidebar icons)
- [ ] Top-bar card-duo animates when new card arrives (back→front flip with type color)
- [ ] New cards animate into the panel list smoothly (slide + fade)
- [ ] Dismissed cards animate out (slide right + fade)
- [ ] Cards look premium in both light and dark mode
- [ ] `pnpm build` passes with no errors
- [ ] No new dependencies added

## Files Touched
- `frontend/src/components/action-card.tsx` — modify (icons + polish)
- `frontend/src/components/action-card-expanded.tsx` — modify (icons + polish)
- `frontend/src/components/notification-panel.tsx` — modify (entry/exit animations + polish)
- `frontend/src/components/top-bar.tsx` — modify (card-stack arrival animation)
