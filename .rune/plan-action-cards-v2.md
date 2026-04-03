# Plan: Action Cards v2 — Context-Aware Smart Cards

## Goal
Make action cards smart, actionable widgets with contextual buttons, module badges,
priority sorting, and time-sensitive alerts. Chef can act on cards during service
from their phone with one tap.

## Key Insight
The frontend ActionCard type ALREADY supports: `changes`, `stats`, `suggestedAction`,
`suggestedChips`, `deadline`, `itemId`, `module`, `priority`. The expanded card
ALREADY renders all of these. The gap is: A0 sends flat text → `notificationToCard()`
produces empty fields.

## Architecture Decision
A0 encodes a JSON action-card payload in notify_user's `detail` field. The frontend
parses it in `notificationToCard()`. No new Socket.IO events, no new A0 tools needed.

## Phases

| # | Phase | Status | Files | Session |
|---|-------|--------|-------|---------|
| 1 | A0 Card Schema — teach A0 to send structured JSON in notify_user | ✅ Done | 5 | 15 |
| 2 | Frontend Parsing — notificationToCard extracts rich fields from detail JSON | ✅ Done | 2 | 15 |
| 3 | Card UI Polish — module badge fix, action button labels, mobile tap targets | ✅ Done | 3 | 15 |

## Key Decisions
- **D1**: Use notify_user `detail` field for JSON payload (not a new tool or Socket.IO event)
- **D2**: A0 decides the actions/buttons (LLM intelligence), frontend just renders them
- **D3**: Build on existing card UI from sessions 6-9, don't rewrite
- **D4**: `getActionLabel()` becomes fallback — A0's suggested action takes priority

## Risks
- A0 may not reliably produce valid JSON in detail field → fallback to current flat text
- Token cost of structured JSON in notify_user → keep schema minimal

## Outcome
- [ ] A0 sends structured JSON with actions, stats, module, deadline in notify_user
- [ ] Frontend parses and renders contextual action buttons
- [ ] Module badge shows correct module (not "GENERAL")
- [ ] Cards sort by priority and deadline
