# Homepage Redesign — Design Spec

## Overview

Three changes to the CarabinerOS homepage (`home-view.tsx` and related components). All changes preserve the existing color scheme and Tailwind theme tokens. Work on a feature branch, review before merge.

## Changes

### 1. KPI Cards — Grid Layout with Click-to-Expand

**Current**: 4 small stacked "solitaire" cards with rotation, 120px wide, minimal info.

**New**: Clean 4-column grid. Larger cards (~160px+ wide, ~140px min-height) with:
- SVG icon in a colored icon wrap (lucide icons matching existing set)
- Label, large value, subtitle
- Thin color-coded progress bar at bottom
- Click to expand: overlay reveals detailed breakdown (4 stat rows), click again to close
- Hover: lift + scale + shadow (spring easing)

**Files**: Replace `solitaire-cards.tsx` content (rename component to `KpiGrid` or keep filename).

**Data**: Keep the same 4 hardcoded KPI items (Orders, Food Cost, Prep, Covers). Add `expandedRows` array to each card's data. Front shows brief, click reveals the extra rows.

### 2. Daily Briefing — Animated, Clickable, Expanding

**Current**: Static bullet list with staggered entrance animation. Sits between greeting and composer.

**New position**: Moves below the composer (greeting -> composer -> briefing -> KPI cards).

**Animations**:
- Shimmer: 2px gradient line across top edge, `translateX` animation looping.
- Pulsing dots: Each insight bullet dot pulses with staggered delays.
- Rows are clickable with hover state (subtle background + border tint).

**Click-to-expand behavior** (critical animation spec):
- Container has `position: relative` with `transition: min-height` for smooth sizing.
- Insight rows live in a list div. Detail panels are `position: absolute` overlays in the same parent.
- **Opening**: Rows fade out (opacity only, they keep their space so container never shrinks). After ~250ms, detail panel fades in with slight `translateY` upward. If detail content is taller than rows, container smoothly grows via `min-height` transition.
- **Closing**: Detail fades out. Rows crossfade back in (starting ~200ms into the detail fade). Container `min-height` smoothly eases back to original row height. Container **never collapses** during either direction.
- X button in top-right corner of detail view triggers close.

**Detail view contents** (per insight): tag badge, title, description paragraph, 2x2 grid of stat tiles, action buttons. All placeholder/mock data for now.

**Files**: Modify `home-view.tsx` (reorder components, update briefing section). Insight detail data added to the existing `INSIGHTS` array or a parallel data structure.

### 3. Top Bar — Playing Card Notification Icon

**Current**: Bell icon button with badge count, opens a Sheet panel.

**New**: Replace bell with two overlapping card shapes (CSS rectangles with rounded corners and borders). No icon/symbol inside the cards — just plain card shapes.
- Back card: slightly rotated clockwise, offset right
- Front card: slightly rotated counter-clockwise, on top
- Badge count sits on top-right corner
- **Hover**: cards fan out subtly (front rotates more CCW + translateX left, back rotates more CW + translateX right). Small separation. Spring easing.
- Click behavior: same as before — opens the notification panel Sheet.
- No tooltips, no labels.

**Files**: Modify `top-bar.tsx`. Replace the `<Button>` with bell icon with the card-duo element. Keep `onBellClick` handler wired to the new element.

## Layout Order (top to bottom)

1. Top bar (brand left, location + card icon right)
2. Greeting ("Good morning, Chef" + time context)
3. Chat composer
4. Daily briefing card
5. KPI cards grid

## Non-Goals

- No color/theme changes — use existing `primary`, `foreground`, `muted-foreground`, `border`, `card` tokens
- No changes to chat functionality, notification panel Sheet, or action card components
- No backend/data changes — all new detail content is hardcoded mock data
- No mobile-specific layout changes in this pass

## Technical Notes

- Use Framer Motion for animations (already in the project)
- Use lucide-react for SVG icons (already in the project)
- All new components use existing shadcn/ui primitives where applicable
- Feature branch: `feat/homepage-redesign`
- Review work before merging to main

## Reference Mockup

Interactive mockup at `.superpowers/brainstorm/20851-1773904895/homepage-v5.html`
