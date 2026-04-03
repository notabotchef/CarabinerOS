# Phase 3: Card UI Polish — Contextual Buttons, Module Badge, Mobile

## Data Flow
```
ActionCard (with actions[], module, deadline)
         ↓
action-card.tsx: renders A0-specified primary action button label
                 renders module badge from card.module (not "GENERAL")
         ↓
action-card-expanded.tsx: renders action button row from card.actions[]
                          renders deadline countdown if present
         ↓
notification-panel.tsx: sorts by priority + deadline (already works)
```

## Code Contracts

### Updated getActionLabel (action-card.tsx)
```typescript
function getActionLabel(card: ActionCard): string {
  // A0-specified action takes priority
  if (card.actions?.length) return card.actions[0].label;
  // Fallback: existing type+module mapping
  return FALLBACK_LABELS[`${card.type}:${card.module}`]
    ?? FALLBACK_LABELS[card.type]
    ?? "Review";
}
```

### Action button row in expanded card
```typescript
{card.actions?.length > 0 && (
  <div className="flex gap-2 px-4 py-3 border-t border-border">
    {card.actions.map((a, i) => (
      <button key={a.label} className={
        a.type === "primary" ? "bg-primary text-primary-foreground ..."
        : a.type === "danger" ? "bg-red-500/10 text-red-500 ..."
        : "bg-muted text-muted-foreground ..."
      }>
        {a.label}
      </button>
    ))}
  </div>
)}
```

## Tasks

### Task 3a: Fix module badge — use card.module not "GENERAL"
- **File**: `frontend/src/components/action-card.tsx`
- **Logic**: The module pill badge (line ~93) already renders `card.module`. The issue
  is upstream: notificationToCard was setting module to "general". After Phase 2,
  this will show the correct module. Verify the pill renders card.module uppercase.
  If card.module is still "general", show nothing instead of "GENERAL".
- **touches**: [action-card.tsx]
- **requires**: [Phase 2 notificationToCard fix]

### Task 3b: Update getActionLabel to use A0-specified actions
- **File**: `frontend/src/components/action-card.tsx`
- **Logic**: Modify `getActionLabel` (line 58) to check `card.actions[0].label` first.
  If A0 provided actions, the first one is the primary. Otherwise fall back to the
  existing type+module mapping. Pass full `card` instead of `(type, module)`.
- **touches**: [action-card.tsx]
- **requires**: [actions field on ActionCard from Phase 2]
- **depends_on**: [task-3a]

### Task 3c: Render action button row in expanded card
- **File**: `frontend/src/components/action-card-expanded.tsx`
- **Logic**: Add an action button row above the chat section. If `card.actions` exists,
  render each as a button styled by type (primary/secondary/danger). Primary button
  is larger, full-width on mobile. Each button click should pre-fill the chat with
  the action label text (e.g. clicking "Send Order" types "Send Order" in the chat
  input — A0 handles the rest via conversation).
- **Edge cases**: No actions array → don't render the section (existing chips still work)
- **touches**: [action-card-expanded.tsx]
- **requires**: [actions field on ActionCard from Phase 2]

### Task 3d: Deadline countdown on urgent cards
- **File**: `frontend/src/components/action-card.tsx`
- **Logic**: If card.deadline exists and is within 4 hours, show a countdown badge
  below the module pill: "Closes in 32 min" using amber text. Use a 60-second
  interval to update. If past deadline, show "OVERDUE" in red.
- **touches**: [action-card.tsx]
- **requires**: [deadline field populated from Phase 2]

## Failure Scenarios

| When | Then | Error |
|------|------|-------|
| card.actions is empty/undefined | getActionLabel falls back to type+module map | Current behavior preserved |
| card.module is "general" | Badge hidden instead of showing "GENERAL" | Cleaner UI |
| card.deadline is in the past | Show "OVERDUE" in red badge | Visual urgency signal |
| Action button clicked | Pre-fills chat input with button label | A0 responds via conversation |

## Rejection Criteria
- DO NOT change the card grid layout (2-column, solitaire style)
- DO NOT change color tokens — use existing TYPE_STYLES from action-card.tsx
- DO NOT add new Socket.IO events for action buttons — use chat pre-fill pattern
- DO NOT make cards wider than current — mobile-first, one-hand usable
- DO NOT use shadow-lg (design tokens: shadow-sm at rest, shadow-md on hover)
- DO NOT use rounded-2xl (design tokens: all cards = rounded-xl)

## Cross-Phase Context
- **Assumes Phase 2**: ActionCard has actions[], module, deadline, stats, changes populated
- **Exports**: Fully rendered contextual action cards with A0-specified buttons

## Acceptance Criteria
- [ ] Module badge shows "ORDERS", "INVENTORY", etc. — not "GENERAL"
- [ ] Primary action button shows A0-specified label (e.g. "Send Order")
- [ ] Expanded card shows action button row when A0 provides actions
- [ ] Deadline countdown visible on time-sensitive cards
- [ ] All buttons are tap-friendly (min 44px touch target)
- [ ] No design token violations (checked against DESIGN_TOKENS.md)
- [ ] Cards with no actions array still work (existing behavior preserved)

## Outcome
### What Was Planned
3-phase plan to make action cards context-aware: A0 sends structured JSON (Phase 1),
frontend parses it (Phase 2), UI renders contextual buttons/badges/deadlines (Phase 3).

### Immediate Next Action
Execute Phase 1: update `_25_restaurant_context.py` with card JSON schema and examples.

### How to Measure
| Check | Command |
|-------|---------|
| A0 sends JSON detail | `docker logs carabiner-os-agent-zero-1 \| grep notify_user` |
| Module badge correct | Visual: card shows "ORDERS" not "GENERAL" |
| Action button shows | Visual: "Send Order" instead of "Review?" |
| No TS errors | `cd frontend && npx tsc --noEmit` |
