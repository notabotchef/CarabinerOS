# Phase 1: Foundation Fixes

## Goal
Fix 3 independent CSS/layout bugs: badge hidden behind sheet overlay, panel scroll broken, dismiss/commit buttons overlapping.

## Data Flow
```
TopBar badge ─── z-index fix + type-colored badge ─── visible above Sheet overlay
NotificationPanel ─── ScrollArea ─── overflow fix ─── all cards scrollable
ActionCardExpanded header ─── flex spacing fix ─── buttons no longer overlap
```

## Code Contracts

```tsx
// top-bar.tsx: Badge should use type color and sit above z-50 Sheet
// The card-duo icon container needs z-[51] or the badge needs absolute positioning above overlay

// notification-panel.tsx: ScrollArea needs proper height constraint
// Current: flex-1 without max-height — ScrollArea can't calculate scroll region

// action-card-expanded.tsx: header buttons need gap/spacing fix
// Current: "Dismiss" text and green check button overlap on narrow widths
```

## Tasks

### Wave 1 (parallel — no dependencies)

- [ ] Task 1 — Fix notification badge z-index and add type color
  - File: `frontend/src/components/top-bar.tsx` (modify lines 132-166)
  - What: Move the Badge to render outside the Sheet's z-50 stacking context. When `lastCardType` is set, tint the badge background to match that type's color (amber for urgent, blue for action, emerald for update, violet for info). Keep the card-duo icon at current z-index.
  - Test: N/A (visual)
  - Verify: `cd frontend && npx tsc --noEmit`
  - Commit: `fix(ui): badge z-index above sheet overlay + type-colored tint`

- [ ] Task 2 — Fix notification panel scroll
  - File: `frontend/src/components/notification-panel.tsx` (modify lines 70-160)
  - What: The Sheet uses `flex flex-col` and ScrollArea uses `flex-1` but the scroll container doesn't have a bounded height. Add `overflow-hidden` to the parent and ensure ScrollArea has `min-h-0` so flexbox allows it to shrink and scroll. Also check if SheetContent needs `overflow-hidden`.
  - Test: N/A (visual)
  - Verify: `cd frontend && npx tsc --noEmit`
  - Commit: `fix(ui): notification panel scroll — add min-h-0 to ScrollArea container`

- [ ] Task 3 — Fix dismiss/commit button overlap
  - File: `frontend/src/components/action-card-expanded.tsx` (modify lines 82-105)
  - What: The header flex container has `justify-between` but the right side buttons need `gap-3` and `shrink-0` on both elements. The "Dismiss" text wraps on narrow widths — add `whitespace-nowrap`. Ensure the green check button has `shrink-0`.
  - Test: N/A (visual)
  - Verify: `cd frontend && npx tsc --noEmit`
  - Commit: `fix(ui): prevent dismiss/commit button overlap in expanded card header`

## Failure Scenarios

| When | Then | Error Type |
|------|------|-----------|
| lastCardType is undefined | Badge uses default primary color (no tint) | No error |
| ScrollArea content shorter than panel | No scrollbar appears, content displays normally | No error |
| Very long "Dismiss" text (i18n future) | whitespace-nowrap prevents wrap, text clips with ellipsis if needed | No error |

## Rejection Criteria
- DO NOT change the Sheet component (`ui/sheet.tsx`) — fix at the consumer level
- DO NOT change card data types or hook logic — this phase is CSS/layout only
- DO NOT add new dependencies
- DO NOT change the card-duo animation logic — only the Badge positioning

## Cross-Phase Context
- **Assumes**: Nothing — these are independent fixes
- **Exports for Phase 2**: Phase 2 will restructure notification-panel.tsx significantly. These scroll/layout fixes establish the correct container behavior that Phase 2 builds on. Phase 2 should preserve `min-h-0` on scroll containers.

## Acceptance Criteria
- [ ] Badge visible above Sheet overlay when panel is open
- [ ] Badge color matches the most recent card's type color
- [ ] All 6 cards scrollable in notification panel (no cut-off)
- [ ] Dismiss and Commit buttons never overlap at 400px panel width
- [ ] `npx tsc --noEmit` passes with zero errors
