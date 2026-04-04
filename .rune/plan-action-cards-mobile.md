# Plan: Action Cards — Mobile-First Smart Interface

**Status:** Draft
**Priority:** P0 — This IS the product for daily users
**Branch:** `feature/action-cards-mobile`

---

## Vision

Action cards are the mobile experience of CarabinerOS. A restaurant operator opens the app on their phone, sees their active cards, taps one, and handles it — all without navigating a dashboard. Cards appear on demand ("send my orders") or proactively from Agent Zero during the day ("Your produce delivery window closes in 2 hours").

Each card is a self-contained unit of work with:
- **Title + summary** — scannable at a glance
- **Full content** — order details, prices, vendor info, suggestions
- **Sidechat** — text + audio input to modify the card's content
- **Two action buttons** — contextual (e.g., "Send Order" / "Dismiss", or "Approve" / "Edit")
- **chat_context_id** — links card to order/record, viewable later in module pages

## Architecture

```
User message → Agent Zero → notify_user tool → action_card JSON
                                                    ↓
                                          Socket.IO "action_card" event
                                                    ↓
                                          Frontend renders card
                                                    ↓
                                    User taps → expanded view + sidechat
                                                    ↓
                                    User modifies via chat → A0 updates card
                                                    ↓
                                    User taps action button → A0 executes
```

**Data flow for orders example:**
1. User: "Please send my orders for the day"
2. A0 reads drafted orders via `carabiner orders list --status draft`
3. A0 creates 1 action card PER VENDOR with:
   - type: "action"
   - module: "orders"
   - summary: "Pacific Seafood — $2,847.50"
   - detail: full line items, quantities, prices
   - stats: [{ label: "Items", value: "23" }, { label: "Total", value: "$2,847.50" }]
   - changes: suggestions (items that might be missing based on par levels)
   - actions: [{ label: "Send Order", type: "primary" }, { label: "Dismiss", type: "secondary" }]
   - suggestedChips: ["Add salmon", "Remove halibut", "Check par levels"]
4. Frontend renders cards in mobile grid
5. User taps card → expanded view with full order + sidechat
6. User chats: "Add 10 lbs salmon" → A0 updates order via CLI → re-emits updated card
7. User taps "Send Order" → A0 executes order submission

---

## Phases

### Phase 1: Backend — Smart Card Factory (backend, no UI changes)
**Goal:** A0 reliably creates the right card for the right action.

**Tasks:**
- [ ] 1a. Implement `action_cards_handler.py` — handle card_message, card_commit, card_dismiss websocket events (tests already exist)
- [ ] 1b. Create card templates/schemas per module+action:
  - orders/create: vendor, line items, total, par suggestions
  - orders/send: confirmation card
  - inventory/alert: threshold crossings, suggested reorders
  - prep/assign: prep list card with task assignments
  - food-cost/report: daily P&L summary card
  - marketing/campaign: campaign draft approval
- [ ] 1c. Enhance `_action_cards.md` system prompt with card creation examples per module
- [ ] 1d. Add `chat_context_id` to card emission in notify_user.py (link card to record)
- [ ] 1e. Card update flow — when user modifies via sidechat, A0 re-emits updated card (same id, new content)

### Phase 2: Mobile-First Card UI (frontend overhaul)
**Goal:** Cards work beautifully on phone screens.

**Tasks:**
- [ ] 2a. New route: `/cards` — full-page card view (replaces side panel on mobile)
- [ ] 2b. Card list view — single column on mobile, scannable
  - Card preview: type color accent, module icon, summary, timestamp
  - Unread indicator (dot)
  - Swipe gestures: left=dismiss, right=commit (stretch goal)
- [ ] 2c. Card expanded view — full screen on mobile
  - Header: back arrow, title, type badge
  - Content area: scrollable, renders stats grid, line items, changes
  - Two action buttons: fixed at bottom, full width, contextual
  - Sidechat: collapsible section, text input + audio button
- [ ] 2d. Responsive breakpoints:
  - Mobile (<640px): `/cards` is the home screen, single column, full-screen expand
  - Tablet (640-1024px): 2-column grid, sheet expand
  - Desktop (>1024px): existing notification panel behavior (keep it)
- [ ] 2e. Audio input integration (Web Speech API / whisper)

### Phase 3: Contextual Action Buttons
**Goal:** The two buttons at the bottom change based on card type + module + state.

**Button matrix:**
| Module    | Action    | Primary Button    | Secondary Button |
|-----------|-----------|-------------------|------------------|
| orders    | create    | "Send Order"      | "Edit"           |
| orders    | review    | "Approve"         | "Reject"         |
| inventory | alert     | "Reorder Now"     | "Dismiss"        |
| prep      | assign    | "Start Prep"      | "Reassign"       |
| food-cost | report    | "Acknowledge"     | "Drill Down"     |
| marketing | campaign  | "Launch"          | "Edit Draft"     |
| *         | *         | "Done"            | "Dismiss"        |

- [ ] 3a. Button config lives in card JSON (actions array) — A0 sets them per context
- [ ] 3b. Frontend renders from actions array, falls back to Done/Dismiss
- [ ] 3c. Button tap emits card_commit with action label → A0 executes the right thing
- [ ] 3d. Loading state on buttons during execution

### Phase 4: Chat Context Link
**Goal:** Every card links to the conversation and the record it created.

- [ ] 4a. Card shows chat_context_id badge — tapping opens the A0 conversation
- [ ] 4b. Module pages (Orders, Inventory, etc.) show "Created via card" indicator
- [ ] 4c. Clicking an order in the Orders page opens the card's chat thread (if still active)
- [ ] 4d. Card history — dismissed/committed cards stay accessible for 7 days

---

## Card JSON Schema (canonical)

```json
{
  "id": "card_uuid",
  "type": "urgent | action | update | info",
  "module": "orders | inventory | prep | menu | food-cost | marketing | recipes",
  "action": "create | update | delete | review | alert | report",
  "summary": "Pacific Seafood — $2,847.50",
  "detail": "Full markdown content with line items, notes, etc.",
  "itemId": "order_uuid (links to the DB record)",
  "chatContextId": "chat_uuid (links to A0 conversation)",
  "stats": [
    { "label": "Items", "value": "23" },
    { "label": "Total", "value": "$2,847.50" },
    { "label": "Delivery", "value": "Tomorrow 6am" }
  ],
  "changes": [
    { "op": "+", "text": "Suggested: 5 lbs Atlantic Salmon (below par)" },
    { "op": "!", "text": "Halibut price up 12% vs last order" }
  ],
  "actions": [
    { "label": "Send Order", "type": "primary" },
    { "label": "Dismiss", "type": "secondary" }
  ],
  "priority": 1,
  "deadline": "2026-04-04T06:00:00Z",
  "status": "new | read | committed | dismissed",
  "timestamp": 1743724800,
  "source": "reactive | proactive",
  "suggestedAction": "Review the order and send before 8 PM cutoff",
  "suggestedChips": ["Add salmon", "Check par levels", "Split delivery"]
}
```

## What Already Works

- ActionCard TypeScript types (lib/types.ts) ✓
- 4 card types with color coding ✓
- notify_user.py emits action_card via Socket.IO ✓
- Expanded card view with chat thread ✓
- Suggestion chips (contextual per type+module) ✓
- _action_cards.md system prompt guides A0 on when to emit ✓
- sessionStorage persistence of cards ✓
- Card sorting by priority/deadline ✓

## What Needs Building

- action_cards_handler.py (tests exist, source missing)
- Mobile-first layout (current is 460px desktop drawer)
- Audio input
- chat_context_id on cards
- Card update/re-emission flow
- Contextual action button execution
- `/cards` route

## Implementation Order

**Start with Phase 1** — get the backend solid so cards are reliably created.
Then Phase 2 (mobile UI) and Phase 3 (buttons) can be built in parallel.
Phase 4 (chat context linking) is the polish layer.

Each phase is a separate PR. Each is testable independently.
