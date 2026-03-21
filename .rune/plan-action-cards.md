# Master Plan: Action Cards System

**Feature**: Action Cards — expo window for CarabinerOS
**Spec**: `docs/superpowers/specs/2026-03-20-action-cards-design.md`
**Workspace**: `.rune/features/action-cards/`
**Branch**: `feature/frontend-refresh` (current)

## Phases

| # | Phase | Status | Files | Session |
|---|-------|--------|-------|---------|
| 1 | Types + Hook (data layer) | ⬚ Pending | 3 files | 1 |
| 2 | Collapsed Card + Panel UI | ⬚ Pending | 3 files | 1 |
| 3 | Expanded Card + Inline Chat UI | ⬚ Pending | 2 files | 2 |
| 4 | Expo Agent (backend) | ⬚ Pending | 3 files | 3 |

## Phase Dependencies

```
Phase 1 (types + hook) → Phase 2 (collapsed card UI) → Phase 3 (expanded card UI)
Phase 1 (types) → Phase 4 (expo agent — uses same card schema)
```

Phase 1 + 2 can fit in one session (small, tightly coupled).
Phase 3 is standalone (expanded card is a new component).
Phase 4 is backend-only (expo agent profile, A0 prompt update, Socket.IO handlers).

## Constraints (from decisions.md)

- Warm hospitality oklch palette (hue 50-70)
- Glass utility classes (glass-subtle, warm-glow)
- Per-metric accent colors
- Never modify Agent Zero core files
- All customization in usr/, carabiner/, frontend/
