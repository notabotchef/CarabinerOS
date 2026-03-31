# Orders Module -- Functional Upgrade Plan

**Date:** 2026-03-24
**Status:** Research complete, ready for implementation
**Module:** `/orders` -- Restaurant purchasing & procurement

---

## 1. Current State

The Orders page (`frontend/src/app/orders/page.tsx`) is a read-only list view with editorial/magazine styling. It fetches from `GET /api/orders` which reads from the `workspace_orders` table (a UI-oriented summary table, not the operational `purchase_orders` table).

### What exists today

**Frontend (page.tsx):**
- Pipeline KPI strip showing counts per status: Drafting, Ready to send, Awaiting approval, Submitted, Confirmed, Delivered
- Search bar (filters by vendor/channel text)
- Status filter tabs with animated underline
- Data table with columns: Vendor, Channel, Status, Total, ETA, Created
- Empty state with conversational prompt ("Tell CarabinerOS what you need")
- "New Order" button (no handler wired)
- No row click / detail view
- No create/edit/delete UI
- No order guide view
- No vendor selector
- No line-item editing
- No delivery receiving flow
- No invoice matching

**Backend:**
- `GET /api/orders` -- list workspace orders (read-only, flask_blueprint.py)
- MCP tools: `orders_list`, `orders_get`, `orders_create`, `orders_update`, `orders_delete` -- full CRUD via AI agent, operates on `workspace_orders`
- No REST endpoints for create/update/delete (only MCP)
- No endpoints for order guides, vendors, or purchase order lines

**Data model -- what exists:**
- `WorkspaceOrder` (workspace_models.py): id, location_id, vendor (string), channel, status, total (string), eta, line_items (JSONB), summary, detail_points, prompt
- `PurchaseOrder` (models.py): id, location_id, vendor_id (FK), po_number, order_date, expected_delivery, status (draft/submitted/confirmed/received), total (Numeric)
- `PurchaseOrderLine` (models.py): id, purchase_order_id (FK), item_id (FK), quantity, estimated_price
- `OrderGuide` (models.py): id, location_id, vendor_id (FK), name
- `OrderGuideItem` (models.py): id, order_guide_id (FK), item_id (FK), par_level
- `Vendor` (models.py): id, name, contact_email, contact_phone, payment_terms, connector_id
- `Item` (models.py): id, name, category, default_uom_id, gl_account_id, last_known_price

---

## 2. Competitive Analysis

### BlueCart
- **One-click reordering** from saved order guides with par-level fill
- **Predictive ordering** using historical depletion, real-time inventory, and seasonality
- **Vendor catalogs** with custom pricing per buyer
- **Order cutoff times** and minimum order enforcement
- **AI invoice OCR** to close the order-to-invoice loop
- **Push notifications** when stock hits minimum levels
- **QuickBooks integration** for payment/cash-flow

### MarketMan
- **Order guides per vendor** replacing paper/spreadsheet guides
- **AI-driven order suggestions** based on historical usage and vendor data
- **Mobile ordering** from kitchen, warehouse, or on the go
- **Vendor payments** with automated approvals, scheduled payments, accounting sync
- **HQ mode** for multi-location central ordering
- **Bulk price editor** across location groups
- **Ordering quantity limits** per item

### Toast (via xtraCHEF)
- **Invoice scanning** (mobile, email batch, or upload)
- **Automated GL coding** and AP approval workflows
- **Price tracking and trend reporting** across vendors
- **Real-time dashboards** for cost trends and price fluctuations
- **Budget tracking** with alerts on declining budgets
- **2-way and 3-way matching** (PO vs invoice vs receiving)

### Square (Order Guide)
- **AI-powered Order Guide** that turns menus into ingredient lists
- **Vendor price sheet ingestion** from any source (portal exports, PDFs)
- **Unit normalization** ($/oz, $/lb) for cross-vendor comparison
- **Auto-generated orders** based on par levels and real-time usage
- **Centralized vendor data** with price trend tracking

### Ottimate (Plate IQ)
- **Line-item invoice extraction** with automatic GL coding
- **Complex approval workflows** with multi-level routing
- **PO fulfillment verification** (2-way and 3-way matching)
- **vCard payments** with cash-back
- **Cross-location cost comparison** and vendor price benchmarking
- **Searchable invoice archive**

### Common patterns across all competitors
1. Order guides tied to vendors with par levels
2. One-click / fill-to-par ordering
3. Mobile-first ordering experience
4. PO-to-invoice matching (2-way or 3-way)
5. Vendor price tracking and comparison
6. Approval workflows before submission
7. Delivery receiving with variance checking
8. AI-assisted order suggestions / predictive ordering
9. Multi-location central purchasing

---

## 3. Gap Analysis

| Capability | Competitors | CarabinerOS | Gap |
|---|---|---|---|
| View order list with status pipeline | All | Yes | None |
| Create/edit PO from UI | All | MCP only (no UI) | Critical |
| Order guide per vendor | BlueCart, MarketMan, Square | DB model exists, no UI | Critical |
| Fill-to-par ordering | BlueCart, MarketMan, Square | DB has par_level field, no logic | High |
| Line-item editing on PO | All | JSONB blob, no structured UI | Critical |
| Order detail / expand view | All | No row click handler | High |
| Vendor selector / management | All | Vendor model exists, no UI | High |
| Delivery receiving | All | No model or UI | High |
| PO-to-invoice matching | Toast, Ottimate, Square | No matching logic | Medium |
| Approval workflows | MarketMan, Ottimate | Status field exists, no workflow | Medium |
| Price tracking / comparison | All | PriceAlert model exists, no UI | Medium |
| Predictive / AI ordering | BlueCart, MarketMan, Square | AI agent can create orders, no auto-suggest | Medium |
| Mobile ordering | MarketMan, BlueCart | Responsive page, no mobile-specific flow | Low |
| Multi-location central ordering | MarketMan, Square | Location scoping exists, no HQ view | Low |
| Vendor payment / AP | MarketMan, Ottimate | Out of scope (invoices module) | N/A |

---

## 4. Proposed Features (Prioritized)

### P0 -- Must have for functional orders page

1. **Order detail slide-over panel** -- Click a row to see full PO with line items, vendor info, status timeline, and actions
2. **Create PO flow** -- Wire "New Order" button to a creation flow: select vendor, add line items from order guide or search, set quantities, review, save as draft
3. **Line-item editor** -- Structured line-item table (item, qty, unit, estimated price, total) replacing the JSONB blob
4. **Status transitions** -- Buttons to advance status: Draft -> Ready to send -> Submitted -> Confirmed -> Delivered, with confirmation dialogs
5. **Order guide view** -- Dedicated sub-view or tab showing vendor order guides with par levels, allowing one-click "fill to par" order creation

### P1 -- High value, build after P0

6. **Vendor selector with search** -- Dropdown/combobox to pick vendors when creating POs, with quick-add for new vendors
7. **Delivery receiving** -- "Mark as received" flow with quantity check against PO lines, flagging variances
8. **Duplicate/reorder** -- One-click to duplicate a previous PO (common pattern: "order same as last Tuesday")
9. **Bulk actions** -- Select multiple POs for batch status change (e.g., mark 5 orders as submitted)
10. **Date range filter** -- Filter orders by created/delivery date range

### P2 -- Differentiation, build after P1

11. **Price variance alerts** -- Surface PriceAlert data inline on order lines ("Tomatoes up 12% since last order")
12. **AI order suggestions** -- Use inventory counts + par levels + sales trends to suggest what to order (action card: "You're low on 8 items from Chef's Warehouse")
13. **PO-to-invoice matching** -- Link submitted POs to received invoices, flag discrepancies
14. **Order history per vendor** -- Vendor detail view showing order history, spend trend, average delivery time
15. **Print/export PO** -- Generate a clean PDF or email-ready PO for vendors who don't use digital ordering

---

## 5. Data Model

### Existing models (ready to use)

- **`PurchaseOrder`** -- operational PO with vendor FK, po_number, order_date, expected_delivery, status, total. Statuses: draft/submitted/confirmed/received
- **`PurchaseOrderLine`** -- item_id FK, quantity, estimated_price
- **`OrderGuide`** -- per-vendor per-location, with name
- **`OrderGuideItem`** -- item + par_level per guide entry
- **`Vendor`** -- name, contact info, payment terms, connector_id
- **`Item`** -- name, category, UOM, GL account, last_known_price
- **`WorkspaceOrder`** -- UI summary layer with JSONB line_items

### Models needing additions

**`PurchaseOrder` -- add fields:**
- `notes: Text` -- free-text notes for the order
- `submitted_at: DateTime` -- when the PO was sent to vendor
- `confirmed_at: DateTime` -- when vendor confirmed
- `received_at: DateTime` -- when delivery was received
- `received_by: String(100)` -- who checked it in
- `linked_invoice_id: UUID FK` -- for PO-to-invoice matching

**`PurchaseOrderLine` -- add fields:**
- `received_quantity: Numeric(12,4)` -- actual qty received (for variance)
- `unit: String(50)` -- unit of measure for display
- `notes: String(300)` -- line-level notes ("subbed for Roma tomatoes")

**`OrderGuideItem` -- add fields:**
- `preferred_vendor_sku: String(100)` -- vendor's item code
- `last_order_qty: Numeric(12,4)` -- what was ordered last time
- `last_order_date: Date` -- when it was last ordered
- `sort_order: Integer` -- custom sort within the guide

**New model: `DeliveryReceiving`:**
- `id: UUID PK`
- `purchase_order_id: UUID FK`
- `received_date: Date`
- `received_by: String(100)`
- `notes: Text`
- `status: String(20)` -- complete/partial/disputed

**`WorkspaceOrder` -- add fields:**
- `purchase_order_id: UUID FK` -- link to operational PO (optional, for orders created via UI)
- `vendor_id: UUID FK` -- typed vendor reference (optional, alongside vendor string)
- `po_number: String(100)` -- display-friendly PO number

### Status mapping

The frontend uses 6 statuses but the `PurchaseOrder` model only has 4. Align them:

| Frontend Status | PO Model Status | Notes |
|---|---|---|
| Drafting | draft | Initial state |
| Ready to send | draft | Sub-state: needs approval or just ready |
| Awaiting approval | draft | Sub-state: pending manager sign-off |
| Submitted | submitted | Sent to vendor |
| Confirmed | confirmed | Vendor acknowledged |
| Delivered | received | Goods arrived |

Options: (a) add a `sub_status` field to PurchaseOrder, or (b) expand the status enum to match the frontend's 6 values. Recommendation: expand the status enum to `draft/ready/pending_approval/submitted/confirmed/received` for a clean 1:1 mapping.

---

## 6. MCP Tools

### Existing tools (workspace_orders CRUD)
- `orders_list(location_id?)` -- list orders
- `orders_get(id)` -- get single order
- `orders_create(data)` -- create order
- `orders_update(id, data)` -- update order
- `orders_delete(id)` -- delete order

### New tools needed

**Order Guide tools:**
- `order_guides_list(location_id?, vendor_id?)` -- list order guides
- `order_guides_get(id)` -- get guide with items
- `order_guides_create(data)` -- create guide for a vendor
- `order_guides_add_item(guide_id, item_id, par_level)` -- add item to guide
- `order_guides_remove_item(guide_id, item_id)` -- remove item
- `order_guides_fill_to_par(guide_id, location_id)` -- generate a draft PO from current inventory vs par levels

**Purchase Order tools (operational):**
- `purchase_orders_create_from_guide(guide_id, overrides?)` -- create PO from order guide
- `purchase_orders_submit(id)` -- advance to submitted
- `purchase_orders_receive(id, lines?)` -- mark as received with optional line-level quantities
- `purchase_orders_duplicate(id)` -- clone a previous PO as new draft

**Vendor tools:**
- `vendors_list()` -- list all vendors
- `vendors_get(id)` -- vendor detail with order history summary
- `vendors_create(data)` -- add new vendor

**Suggestion tools:**
- `orders_suggest(location_id)` -- AI analyzes inventory vs par levels and returns suggested order items

---

## 7. API Routes

### Existing routes
- `GET /api/orders` -- list workspace orders (read-only)

### New REST routes needed

**Purchase Orders:**
- `GET /api/orders/:id` -- single PO with line items and vendor info
- `POST /api/orders` -- create new PO (returns created PO)
- `PATCH /api/orders/:id` -- update PO fields
- `DELETE /api/orders/:id` -- delete draft PO
- `POST /api/orders/:id/submit` -- advance status to submitted
- `POST /api/orders/:id/confirm` -- advance status to confirmed
- `POST /api/orders/:id/receive` -- mark as received (body: line-level quantities)
- `POST /api/orders/:id/duplicate` -- clone as new draft

**Order Guides:**
- `GET /api/order-guides` -- list guides (optional `?vendor_id=`)
- `GET /api/order-guides/:id` -- guide with items
- `POST /api/order-guides` -- create guide
- `PATCH /api/order-guides/:id` -- update guide
- `POST /api/order-guides/:id/fill-to-par` -- generate draft PO from guide

**Vendors (if not already exposed):**
- `GET /api/vendors` -- list vendors
- `GET /api/vendors/:id` -- vendor detail

---

## 8. UI Components

### Page layout (updated)

```
+------------------------------------------------------------------+
| [=] Orders                                    [Order Guides] [+ New Order] |
| Purchase orders across all vendors                                |
+------------------------------------------------------------------+
| [Drafting: 3] > [Ready: 2] > [Pending: 1] > [Submitted: 4] > [Confirmed: 2] > [Delivered: 8] |
+------------------------------------------------------------------+
| [Search vendors...]  | All (20) | Drafting (3) | Ready (2) | ... |
|                      | [Date range picker]  [Vendor filter dropdown] |
+------------------------------------------------------------------+
| Vendor         | PO #    | Channel | Status    | Total     | ETA      | Created |
|----------------|---------|---------|-----------|-----------|----------|---------|
| Chef's Wrhse   | PO-1042 | Portal  | Submitted | $2,847.50 | Mar 25   | Mar 22  |
| Sysco           | PO-1041 | Email   | Draft     | $1,523.00 | --       | Mar 22  |
| ...             |         |         |           |           |          |         |
+------------------------------------------------------------------+
```

### New components to build

1. **`order-detail-panel.tsx`** -- Slide-over panel (right side, like Solitaire card expand)
   - Header: vendor name, PO number, status badge, created date
   - Status timeline: visual progress through statuses
   - Line items table: item name, qty, unit, unit price, line total
   - Totals: subtotal, tax (if applicable), total
   - Actions bar: Edit, Submit, Duplicate, Delete (contextual per status)
   - Notes section
   - Linked invoice (if matched)

2. **`order-create-dialog.tsx`** -- Multi-step creation flow
   - Step 1: Select vendor (combobox with search)
   - Step 2: Add line items (from order guide or item search, with qty inputs)
   - Step 3: Review and save as draft
   - Alternative: single-page form for power users

3. **`order-guide-view.tsx`** -- Order guide management
   - List of guides per vendor
   - Item list with par levels, last price, last order date
   - "Fill to par" button that creates a draft PO
   - Inline editing of par levels and items

4. **`line-item-editor.tsx`** -- Reusable line-item table editor
   - Add/remove rows
   - Item search/autocomplete
   - Quantity input with unit display
   - Price display (from last known price)
   - Row totals
   - Running grand total

5. **`vendor-combobox.tsx`** -- Vendor selector
   - Search/filter vendors
   - Show recent vendors first
   - Quick-add inline ("+ Add new vendor")

6. **`receiving-dialog.tsx`** -- Delivery check-in flow
   - Shows expected line items from PO
   - Input fields for actual received quantity per line
   - Flags variances (over/under/missing)
   - Notes per line and overall
   - Submit creates receiving record and updates PO status

7. **`order-filters.tsx`** -- Enhanced filter bar
   - Date range picker
   - Vendor multi-select dropdown
   - Existing status tabs (keep)
   - Existing search (keep)

---

## 9. Implementation Plan (Revised — Chef-Approved)

> **Design principle:** The order detail is **chat-first**. No forms, no dropdowns, no line-item editor component. You open an order and TALK to it. A0 handles the mutations. Three buttons only: **Send**, **Draft**, **Cancel**.
>
> Example interactions:
> - "Add 2 cases of avocados"
> - "Push the delivery to Friday"
> - "What else do I need from Sysco to hit minimum?"
> - "Same order as last Tuesday but drop the salmon"
>
> **Rationale (from the chef):** "Most times in my daily walks through the kitchen I am looking at what I need for the rest of the week, what can I push for the weekend, what can I add to meet the minimum." This is a conversation, not a spreadsheet.

### Phase 1: Order Detail + Chat Interface (P0)
1. Add `GET /api/orders/:id` REST endpoint returning PO with lines and vendor info
2. Build `order-detail-panel.tsx` slide-over panel:
   - Header: vendor name, PO number, status badge
   - Read-only line items display (item, qty, unit, price, total)
   - **Inline chat composer** — same glass input as main chat, wired to A0 with order context
   - A0 receives the order context and can modify it via MCP tools
   - **Three buttons only:** Send (submit to vendor), Draft (save and close), Cancel (discard changes)
   - Status shown but transitions happen through chat ("submit this order") or buttons
3. Wire row clicks to open the detail panel
4. Add status transition endpoints (`submit`, `confirm`, `receive`) — called by A0 or buttons

### Phase 2: Create Order via Chat (P0)
1. Wire "New Order" button to open a blank detail panel with **vendor select dropdown** at top (populated from `GET /api/vendors`)
2. User picks vendor (e.g., Sysco) → A0 receives vendor context, creates draft PO
3. User types: "Add 5 cases Roma tomatoes, 3 cases avocados" → A0 adds line items
4. User reviews the live-updating line items display above the chat
5. User clicks **Draft** to save or **Send** to submit
6. Add `GET /api/vendors` REST endpoint (for A0 to resolve vendor names)
7. Add `POST /api/orders` and `PATCH /api/orders/:id` REST endpoints (for A0 to write)

### Phase 3: Order Guides + Fill-to-Par (P0)
1. Add order guide REST endpoints and MCP tools
2. Build `order-guide-view.tsx` — list of vendor guides with par levels
3. "Fill to par" button creates a draft PO pre-populated with items below par
4. Draft opens in the detail panel with chat — user can modify before sending
5. A0 can also suggest: "You're low on 8 items from Chef's Warehouse" via action card

### Deferred (Future phases)
- **Delivery Receiving** — push to later, manual status change for now
- **Enhanced Filters / Bulk Actions** — nice to have after core works
- **Duplicate/Reorder** — A0 already handles this via chat ("same as last Tuesday")
- **AI Suggestions / Price Alerts** — already part of action card behavior, surfaces automatically when inventory + price data exists

---

## 10. Files to Modify

### Frontend (new files)
- `frontend/src/app/orders/components/order-detail-panel.tsx` — slide-over with line items display + inline chat
- `frontend/src/app/orders/components/order-guide-view.tsx` — order guide list with fill-to-par
- `frontend/src/app/orders/components/order-chat.tsx` — inline chat composer scoped to order context (reuses ChatComposer pattern)

### Frontend (modify)
- `frontend/src/app/orders/page.tsx` — add row click, wire new button, integrate detail panel
- `frontend/src/lib/types.ts` — add PurchaseOrder, PurchaseOrderLine, OrderGuide, Vendor types
- `frontend/next.config.ts` — add API rewrites for new endpoints if needed

### Backend (new files)
- `carabiner/api/routes/orders.py` — REST endpoints for PO CRUD + status transitions
- `carabiner/api/routes/order_guides.py` — REST endpoints for order guides
- `carabiner/api/routes/vendors.py` — REST endpoints for vendors

### Backend (modify)
- `carabiner/db/models.py` — add notes/timestamp fields to PurchaseOrder
- `carabiner/api/flask_blueprint.py` — register new route blueprints
- `carabiner/api/schemas.py` — add PurchaseOrderOut, OrderGuideOut, VendorOut schemas
- `carabiner/mcp/server.py` — add order guide MCP tools, fill-to-par tool

### Database
- Alembic migration for PurchaseOrder field additions (notes, timestamps)

---

## Notes for Implementation

- Each phase is a walk-in task (>30 lines) — delegate to agents via `/rune:cook`
- **Chat-first, not form-first.** The detail panel shows data; the chat modifies it. No inline editing, no dropdowns, no line-item editor components.
- The `WorkspaceOrder` table serves as the UI cache layer; `PurchaseOrder` is the operational source of truth.
- A0 is the primary way to create/modify orders. The UI provides visibility and the three action buttons (Send/Draft/Cancel).
- Action cards handle AI suggestions and price alerts — no separate UI needed.
- Invoice upload via chat is already possible (A0 can process attachments). Guide A0's system prompt to route invoice data to the correct models.
