# Feature: Action Cards UI Overhaul

## Overview
Redesign action cards from a Sheet-based list into a solitaire-style card grid (2-col) with flip-to-expand animation. Fix scroll, badge, button overlap bugs. Add contextual chat suggestions and completed-card section.

## Phases
| # | Name | Status | Plan File | Summary |
|---|------|--------|-----------|---------|
| 1 | Foundation Fixes | Pending | plan-action-cards-ui-phase1.md | Badge z-index, scroll fix, button overlap (issues 1, 2, 6) |
| 2 | Solitaire Redesign | Pending | plan-action-cards-ui-phase2.md | 2-col grid, flip expand, action buttons, chat chips, completed section, design system (issues 3, 4, 5, 7, 9, 10) |

## Key Decisions
- Phase 1 is independent CSS/layout fixes — can run in parallel with Phase 2
- Phase 2 is one coherent agent because card grid, flip animation, action buttons, and chat features are deeply interconnected — splitting would produce inconsistent design
- Phase 2 agent runs rune:design to establish restaurant-first visual identity (not "another Claude website")
- Phase 2 agent has creative freedom + can research online for inspiration
- Completed cards remain expandable, sit at bottom with green tint

## Architecture
```
TopBar (badge fix) ──────────────────────── Phase 1
NotificationPanel (scroll + grid layout) ─── Phase 1 + 2
ActionCard (2-col solitaire + flip) ──────── Phase 2
ActionCardExpanded (inline + chat chips) ── Phase 1 (overlap) + Phase 2
use-action-cards.ts (completed sort) ────── Phase 2
types.ts (suggestedAction field) ────────── Phase 2
```

## Risks
- Phase 2 is large (~300 LOC) — mitigated by single-agent coherence and rune:design guidance
- Merge conflict between Phase 1 and Phase 2 on action-card-expanded.tsx — Phase 1 only fixes header spacing, Phase 2 restructures body. Low conflict risk.
