# Action Cards v2 — Deterministic Card Factory

## Problem
Action cards are dumb notification stubs. A0 emits one card per tool call (3 cards for one order workflow), cards have no structured content (no line items, no totals), buttons say "Review?" instead of "Send to Vendor", and cards aren't linked to the mother chat.

## Solution
A **frontend-driven card recipe map** that deterministically maps module + action to the right title, buttons, detail renderer, and fetch URL. Zero LLM calls. The backend just passes facts (module, action, itemId, chatId). The frontend does all the smart rendering.

## Architecture

### Card Recipe Map (`frontend/src/lib/card-recipes.ts`)
```ts
type CardRecipe = {
  titleTemplate: string;        // "Draft Order — {vendor}"
  fetchUrl: string;             // "/api/orders/{itemId}"
  detailRenderer: string;       // "OrderDetailCard"
  buttons: ActionCardAction[];  // [{label: "Send to Vendor", type: "primary"}, ...]
  chips: string[];              // ["Add items", "Change quantities"]
};

// Lookup: CARD_RECIPES[module][action] → CardRecipe
```

### Per-Module Detail Renderers
Each module gets a detail component that fetches from the API and renders structured content:
- **OrderDetailCard**: vendor, channel, ETA, total, line items table (Item/Qty/Unit/Price/Total)
- **InventoryDetailCard**: item name, on-hand vs par, variance badge, storage area, last count date
- **InvoiceDetailCard**: vendor, invoice #, dates, total, line items table, approval status
- **PrepDetailCard**: task, station, readiness badge, shortage notes, assigned to
- **RecipeDetailCard**: name, category, yield, cost, components/ingredients list
- **MenuDetailCard**: item, price, food cost, margin, performance badge (Star/Dog/etc)
- **BriefingDetailCard**: already works (stats + changes from daily_brief_tool)

### Backend Changes
- `action_card.py`: pass `chatId` from the agent's current chat context
- `ActionCard` type: add `chatId?: string`
- Card dedup: frontend merges cards with same `itemId` instead of creating duplicates

## Phases

### Phase 1: Foundation (card recipes + backend IDs)
Files:
- NEW `frontend/src/lib/card-recipes.ts` — recipe map for all module×action combos
- EDIT `frontend/src/lib/types.ts` — add `chatId?: string` to ActionCard
- EDIT `python/tools/action_card.py` — extract chatId from agent context, include in payload
- EDIT `frontend/src/hooks/use-action-cards.ts` — deduplicate by itemId (update existing card instead of adding)

### Phase 2: Detail renderers (orders + inventory first)
Files:
- NEW `frontend/src/components/card-details/order-detail-card.tsx`
- NEW `frontend/src/components/card-details/inventory-detail-card.tsx`
- EDIT `frontend/src/components/action-card-expanded.tsx` — when card has itemId + module, render the recipe's detail component instead of generic detail text; use recipe's buttons instead of card.actions

### Phase 3: Remaining module renderers
Files:
- NEW `frontend/src/components/card-details/invoice-detail-card.tsx`
- NEW `frontend/src/components/card-details/prep-detail-card.tsx`
- NEW `frontend/src/components/card-details/recipe-detail-card.tsx`
- NEW `frontend/src/components/card-details/menu-detail-card.tsx`

### Phase 4: Chat linkage
Files:
- EDIT `frontend/src/components/action-card-expanded.tsx` — when card has chatId, load that chat's messages into the card's existing chat thread panel (the thread UI already exists)

## Design Tokens (from DESIGN_TOKENS.md)
- All cards = `rounded-xl`, `p-4`, `gap-4`
- Numbers/prices/dates = `font-mono`
- Shadows = `shadow-sm` rest, `shadow-md` hover
- Colors = Tailwind keywords only, no hex in classNames
- Tables inside cards: use `text-sm`, `tabular-nums` for numeric columns

## Out of Scope
- Expo agent / any LLM calls for card creation
- Card lifecycle state machine (draft→sent→delivered) — future
- Multi-user card sharing — future
- Push notifications — future

## Acceptance Criteria
1. Creating an order produces ONE card (not 3), with line items table in expanded view
2. Card buttons say "Send to Vendor" / "Draft" / "Cancel" for orders
3. Updating inventory produces a card with current on-hand vs par, "Add to Order" button
4. Cards with same itemId merge (update, not duplicate)
5. Card chatId links to mother conversation (chat messages visible in card thread)
6. No LLM calls for card creation — pure deterministic frontend rendering
7. All design tokens respected (font-mono for numbers, rounded-xl, etc.)
