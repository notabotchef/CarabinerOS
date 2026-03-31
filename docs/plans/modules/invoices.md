# Invoices Module -- Functional Upgrade Plan

**Module**: Invoices (AP Automation & Invoice Processing)
**Date**: 2026-03-24
**Status**: Research complete, ready for implementation
**Priority**: P1 competitive gap closer

---

## 1. Current State

### Frontend (`frontend/src/app/invoices/page.tsx`)
- Single-page table view with pipeline status bar (Uploaded > Processing > Matched > Approved > Paid)
- Filter tabs by status, text search by vendor/invoice number
- StatusBadge component with color-coded pipeline stages
- "Upload Invoice" button exists in header but is non-functional (no handler)
- Uses `useWorkspace<Invoice>("/api/invoices")` hook -- read-only, no mutations
- No detail/expanded view for individual invoices
- No line-item visibility in the table
- No file preview, no drag-and-drop upload, no OCR integration

### Backend Models
- **`Invoice`** (models.py): vendor_id FK, invoice_number, invoice_date, due_date, subtotal/tax/total, status (pending/processing/matched/approved/paid/disputed). Has `line_items` relationship. Location-scoped.
- **`InvoiceLineItem`** (models.py): invoice_id FK, item_id FK (optional), description, quantity, unit_price, total, gl_account_id FK (optional). No PO matching fields.
- **`WorkspaceInvoice`** (workspace_models.py): UI-oriented flat model with vendor_name (string, not FK), file_path, file_mime, source, line_items (JSONB), gl_codes (JSONB), extracted_data (JSONB), summary, detail_points, prompt. Status default "uploaded".
- **`Vendor`** (models.py): name, contact_email, contact_phone, payment_terms, connector_id. No address, no tax ID, no default GL, no payment method.
- **`PurchaseOrder`** + **`PurchaseOrderLine`** (models.py): Exist but have no FK link to invoices. No three-way match infrastructure.
- **`PriceAlert`** (models.py): item_id, vendor_id, previous_price, new_price, pct_change, alert_date, acknowledged. Exists but not wired to invoice processing pipeline.

### MCP Tools (`carabiner/mcp/server.py`)
- `invoices_list`, `invoices_get`, `invoices_create`, `invoices_update`, `invoices_delete` -- basic CRUD on WorkspaceInvoice. Marked as "(legacy)".
- No OCR tool, no file-upload tool, no PO-matching tool, no approval-workflow tool.

### API Routes (`carabiner/api/flask_blueprint.py`)
- Single GET-only route: `/api/invoices` -- lists WorkspaceInvoice rows with optional location_id filter.
- No POST/PUT/DELETE routes for invoices.
- No file upload endpoint.

### Pydantic Schema (`carabiner/api/schemas.py`)
- `InvoiceOut`: serializes WorkspaceInvoice fields. Read-only output schema. No input/create schema.

---

## 2. Competitive Landscape

### xtraCHEF (Toast)
- **Invoice capture**: Mobile scan (iOS/Android), upload, email forwarding, EDI
- **OCR**: ML + human QC operators; line-item extraction within 24 hours
- **GL coding**: Line-item level GL coding, multi-dimensional
- **Approval**: Configurable approval rules
- **Reconciliation**: Auto-reconcile vendor statements against invoices
- **Integration**: Toast POS, QuickBooks, Sage Intacct
- **Strength**: Deep Toast ecosystem integration, combines invoice data with POS sales data

### Ottimate (formerly Plate IQ)
- **OCR**: 99% accuracy, instant capture, custom extraction fields and validation rules
- **Line-item coding**: Per-department GL allocation (e.g., lettuce to salad bar vs. grill)
- **Approval**: Custom multi-rule workflows based on line-item criteria
- **Reporting**: Drill-down by GL account, category, line item, time period
- **Strength**: Best-in-class line-item extraction accuracy; eliminates 90%+ manual accounting

### MarketMan
- **Invoice capture**: Mobile snap, upload, email; AI-powered OCR (digital + handwritten)
- **Vendor ordering**: In-app ordering with delivery day/cutoff management, EDI with Sysco/US Foods
- **Payments**: Integrated vendor payments (credit, ACH) directly from app
- **Inventory link**: Invoices auto-update inventory costs and par levels
- **Strength**: Tight inventory-to-invoice loop; auto-reorder when stock is low

### Restaurant365
- **Approval workflow**: Up to 10 approval levels per workflow; routing by location, vendor, category, amount
- **Duplicate detection**: Auto-flags duplicate invoices, billing discrepancies, unusual trends
- **Dashboard**: Centralized AP dashboard across all locations
- **Audit trail**: Full approval/rejection audit log
- **Strength**: Enterprise-grade multi-location approval workflows with granular controls

### MarginEdge
- **Invoice capture**: 5 input methods (scan, upload, email, photo, EDI)
- **Processing**: Tech + human operators; coded in under 48 hours, handles handwritten notes
- **Price alerts**: Auto-email when prices exceed custom thresholds per item
- **Real-time costing**: Combines POS sales + invoice data for daily P&L and theoretical usage
- **Strength**: Price change tracking and real-time food cost visibility

### Choco
- **Ordering**: 3-tap ordering from all distributors; mobile-first
- **Communication**: In-app messaging with vendors; order via email, WhatsApp, text, fax
- **AI capture**: Voicemail, email, text, handwritten notes all captured by AI
- **Sales rep tools**: AI alerts for upsell/churn; real-time product catalog
- **Strength**: Vendor communication layer; free for restaurants

---

## 3. Feature Gap Analysis

| Capability | Competitors | CarabinerOS Today | Gap |
|---|---|---|---|
| Photo/PDF upload | All 6 | Button exists, no handler | Critical |
| OCR line-item extraction | xtraCHEF, Ottimate, MarketMan, MarginEdge | `extracted_data` JSONB field exists but unpopulated | Critical |
| PO-to-invoice matching | xtraCHEF, Ottimate, R365 | PurchaseOrder model exists but no FK to Invoice | Critical |
| Price variance detection | MarginEdge, xtraCHEF, MarketMan | PriceAlert model exists but not wired | High |
| Approval workflow | R365, Ottimate, xtraCHEF | Status field exists, no workflow engine | High |
| GL coding per line item | Ottimate, xtraCHEF, R365 | gl_account_id on InvoiceLineItem exists | Medium |
| Vendor statement reconciliation | xtraCHEF, R365 | None | Medium |
| AP aging report | R365, standard AP | None | Medium |
| Payment tracking | MarketMan, R365, MarginEdge | Status has "paid" but no payment details | Medium |
| Email forwarding intake | xtraCHEF, MarginEdge, Ottimate | None | Low (Phase 2) |
| EDI vendor connections | MarketMan, MarginEdge | connector_id on Vendor | Low (Phase 2) |
| Vendor in-app messaging | Choco | None | Low (Phase 3) |

---

## 4. Target UX Vision

Think like a GM at 7 AM with a stack of last night's delivery invoices.

**Flow**: Snap photo or drop PDF --> AI extracts vendor, line items, totals in seconds --> system auto-matches to open PO --> flags any price increases over threshold --> routes to approval if over $X --> mark paid when check cuts.

### Primary Screens

1. **Invoice List** (upgrade current page)
   - Pipeline bar stays (counts per stage)
   - Add: file-type icon per row (PDF/photo/email), line-item count badge, PO match indicator (green check / yellow warning / red X), days-until-due or days-overdue coloring
   - Bulk actions: approve selected, export selected, mark paid

2. **Invoice Detail** (new slide-over or dedicated page)
   - Left panel: file preview (PDF viewer or image zoom)
   - Right panel: extracted header fields (vendor, date, number, totals) with inline edit
   - Line-item table: description, qty, unit price, total, matched item, GL code, PO line reference
   - Price variance callouts inline (red highlight if unit price > threshold vs. last invoice)
   - Approval actions at bottom: Approve / Reject / Request Info
   - Activity timeline: upload, extraction, match, approval, payment events

3. **Upload Flow** (new modal or drawer)
   - Drag-and-drop zone + camera button (mobile) + "Forward to invoices@..." email address display
   - Multi-file upload support
   - Progress indicator: Uploading > Extracting > Review
   - Quick-review screen after extraction showing parsed fields for confirmation

4. **AP Dashboard** (new tab or widget on reporting page)
   - AP aging buckets: Current, 1-30, 31-60, 61-90, 90+
   - Total outstanding by vendor
   - Upcoming payments this week
   - Price alert feed

---

## 5. Data Model Changes

### New Fields on Existing Tables

**`invoices` table** (or WorkspaceInvoice):
- `purchase_order_id` (UUID FK, nullable) -- link to matched PO
- `match_status` (String: unmatched / partial / full / exception)
- `match_score` (Numeric, 0-100) -- confidence of auto-match
- `approved_by` (String, nullable) -- who approved
- `approved_at` (DateTime, nullable)
- `rejected_reason` (Text, nullable)
- `payment_method` (String, nullable) -- check/ACH/card
- `payment_reference` (String, nullable) -- check number, transaction ID
- `paid_at` (DateTime, nullable)
- `ocr_confidence` (Numeric, 0-100, nullable)
- `ocr_raw` (JSONB, nullable) -- raw OCR output for debugging

**`invoice_line_items` table** (or JSONB within WorkspaceInvoice):
- `po_line_id` (UUID FK, nullable) -- link to PurchaseOrderLine
- `price_variance_pct` (Numeric, nullable) -- vs. last known price
- `flagged` (Boolean, default false) -- manual or auto flag

**`vendors` table**:
- `default_gl_account_id` (UUID FK, nullable)
- `default_payment_terms_days` (Integer, nullable) -- net 30, net 15, etc.
- `tax_id` (String, nullable)
- `address` (Text, nullable)
- `auto_approve_below` (Numeric, nullable) -- auto-approve invoices under this amount

### New Tables

**`invoice_events`** (audit trail):
- id, invoice_id FK, event_type (uploaded/extracted/matched/approved/rejected/paid/commented), actor (String), detail (JSONB), created_at

**`approval_rules`** (workflow configuration):
- id, location_id FK (nullable for org-wide), rule_name, condition_type (amount_above/vendor/category), condition_value (JSONB), approver_role (String), priority (Integer), is_active

---

## 6. API Endpoints Needed

### Invoice CRUD + Actions
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/invoices` | Create invoice (metadata only, before file) |
| POST | `/api/invoices/upload` | Upload file(s), trigger OCR pipeline |
| GET | `/api/invoices/:id` | Full invoice detail with line items |
| PUT | `/api/invoices/:id` | Update invoice fields |
| POST | `/api/invoices/:id/approve` | Approve invoice |
| POST | `/api/invoices/:id/reject` | Reject invoice with reason |
| POST | `/api/invoices/:id/mark-paid` | Record payment |
| POST | `/api/invoices/:id/match` | Trigger or confirm PO match |
| GET | `/api/invoices/:id/events` | Audit trail for invoice |
| DELETE | `/api/invoices/:id` | Soft-delete invoice |

### Supporting
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/invoices/aging` | AP aging summary (current/30/60/90+) |
| GET | `/api/invoices/stats` | Dashboard stats (total outstanding, due this week, alerts) |
| GET | `/api/vendors/:id/price-history` | Price history for a vendor's items |
| GET | `/api/vendors/:id/invoices` | All invoices for a vendor |

### MCP Tools (Agent-Facing)
- `invoices_upload` -- accept file path, trigger OCR, return extracted data
- `invoices_match_po` -- given invoice ID, find and score PO matches
- `invoices_approve` -- approve with optional note
- `invoices_price_check` -- compare line items against historical prices, return variances
- `invoices_aging_report` -- generate AP aging summary

---

## 7. OCR / Extraction Pipeline

### Architecture
1. **File intake**: POST `/api/invoices/upload` accepts multipart file (PDF, JPEG, PNG, HEIC)
2. **Storage**: Save to local filesystem or S3-compatible store; store path in `file_path`
3. **Extraction**: Send file to LLM vision model (GPT-4o or Claude) via LiteLLM with structured prompt requesting: vendor name, invoice number, date, due date, subtotal, tax, total, and line items array (description, qty, unit, unit_price, total)
4. **Validation**: Compare extracted total vs. sum of line items; flag if mismatch > $0.01
5. **Entity resolution**: Fuzzy-match extracted vendor name against `vendors` table; fuzzy-match line item descriptions against `items` table
6. **Populate**: Write extracted data to `extracted_data` JSONB and structured fields; set status to "Extracted"
7. **Auto-match**: If vendor + date range matches an open PO, attempt line-by-line quantity/price match; set `match_status` and `match_score`

### Why LLM Vision Over Traditional OCR
- Restaurant invoices are notoriously inconsistent: handwritten notes, thermal paper, mixed formats, vendor-specific layouts
- LLM vision (GPT-4o, Claude) handles layout understanding natively -- no template training needed
- Can extract semantic meaning ("2 cs Romaine" = 2 cases of Romaine lettuce) that traditional OCR misses
- CarabinerOS already has LiteLLM configured -- zero new infrastructure

### Fallback
- If extraction confidence < 70%, set status to "Processing" and surface for manual review
- User can edit any extracted field inline; corrections improve future matching

---

## 8. Implementation Phases (Revised — Chef-Approved)

> **Design principle:** Chat IS the upload flow. Drop a photo/PDF in chat → A0 extracts everything → invoice appears. No separate upload modal. Chat for approvals, disputes, questions.
>
> **Two user profiles:**
> 1. **Large operations (Alinea model):** Chef tracks budget in the budget tracker (inventory module). Accountant team processes invoices weekly. Chef just needs "am I over budget?"
> 2. **Small restaurants:** Chef IS the accountant. Processes invoices, pays vendors, tracks AP — on top of running the kitchen. This module is their lifeline.
>
> **CarabinerOS differentiator:** xtraCHEF charges $200/month/location for invoice OCR. A0 does it with one LiteLLM vision call — zero new infrastructure, zero per-invoice cost.

### Phase 1: Chat-Based Upload + Extract (P0)
1. **File upload via chat** — user drops photo/PDF in the main chat or invoice page chat. A0 receives the file, extracts via LLM vision (LiteLLM), creates the invoice record.
2. File storage: local `/uploads/invoices/` with UUID naming (S3 later)
3. LLM vision extraction: vendor, invoice number, date, due date, line items (description, qty, unit price, total), totals
4. Entity resolution: fuzzy-match vendor name → `vendors` table, line item descriptions → `items` table
5. Invoice detail slide-over: file preview on left, extracted fields on right, line-item table
6. **Chat at bottom of detail** — "that tomato price is wrong, should be $24", "approve it", "what did we pay for avocados last time?"
7. Price variance auto-detection: compare each line item against `Item.last_known_price`, flag spikes as action cards
8. Update `Item.last_known_price` from invoice line items (keeps prices current across all modules)
9. New API: `POST /api/invoices/upload`, `GET /api/invoices/:id`
10. New MCP tools: `invoices_upload`, `invoices_price_check`

### Phase 2: PO Matching + Budget Feed (P1)
11. Auto-match invoices to open POs (vendor + date window + line-item fuzzy match)
12. Match indicators in list view (green check / yellow warning / red X)
13. **Feed into budget tracker** — invoice totals auto-populate the daily vendor spend in the inventory budget view (the Roister spreadsheet pattern)
14. AP aging summary: current / 30 / 60 / 90+ days
15. MCP tools: `invoices_match_po`, `invoices_aging_report`

### Phase 3: Approval + Payment (P2)
16. Status transitions via chat: "approve", "reject — wrong vendor", "mark paid check #4521"
17. `invoice_events` audit trail table
18. Bulk approve via chat: "approve all invoices under $500"
19. AP dashboard widget on reporting page

### Deferred
- Formal approval workflow engine (rules, routing, multi-level) — chat-based approval is enough for v1
- Email forwarding intake — future (A0 could read Gmail via Google MCP integration)
- Vendor statement reconciliation — future
- Auto-payment integration (MarginEdge-style) — future, requires payment processor partnership
- Export to CSV/PDF for accountant — A0 can generate this via chat
- Duplicate detection — A0 can be prompted to check

---

## 9. Agent Integration Points

CarabinerOS's differentiator is the AI agent. The invoices module should leverage it heavily:

| Trigger | Agent Action |
|---|---|
| Invoice uploaded | Auto-extract via vision, populate fields, attempt PO match |
| Price variance > 5% | Create action card: "Sysco raised Romaine Hearts from $24.50 to $28.00 (+14%). Approve or dispute?" |
| Invoice unmatched for 24h | Create action card: "Invoice #4521 from US Foods has no matching PO. Create PO retroactively or flag for review?" |
| AP aging > 60 days | Create action card: "3 invoices from Performance Food Group are 60+ days overdue, totaling $4,280. Schedule payment?" |
| Approval needed | Create action card: "$2,400 invoice from Restaurant Depot needs your approval. View details." |
| Weekly digest | Agent summarizes: "This week: 12 invoices processed ($8,420), 2 price alerts, 1 disputed. AP aging: $3,200 current, $1,100 at 30 days." |

The agent should be able to answer natural language questions like:
- "How much did we spend on produce last month?"
- "Show me all invoices from Sysco with price increases"
- "What's our AP aging look like?"
- "Approve all invoices under $500"

---

## 10. Success Metrics

| Metric | Target | How Measured |
|---|---|---|
| Invoice processing time | < 30 seconds from upload to extracted | Timestamp delta (uploaded_at to extracted_at) |
| OCR extraction accuracy | > 90% fields correct without manual edit | Compare extracted vs. final saved values |
| PO match rate | > 70% auto-matched on first pass | match_status = "full" / total invoices with open POs |
| Price alert catch rate | 100% of variances > threshold flagged | PriceAlert records created vs. actual price changes |
| Approval cycle time | < 4 hours from extraction to approval | Timestamp delta |
| User adoption | GM processes invoices in-app instead of paper/spreadsheet | Weekly active invoice uploads per location |
| AP aging accuracy | Matches accountant's report within 1% | Cross-reference with QuickBooks/Xero export |

---

## Files Referenced

- `/Users/estebannunez/Projects/carabiner-os/frontend/src/app/invoices/page.tsx` -- current frontend page
- `/Users/estebannunez/Projects/carabiner-os/carabiner/db/models.py` -- Invoice, InvoiceLineItem, Vendor, PurchaseOrder, PriceAlert models
- `/Users/estebannunez/Projects/carabiner-os/carabiner/db/workspace_models.py` -- WorkspaceInvoice model
- `/Users/estebannunez/Projects/carabiner-os/carabiner/mcp/server.py` -- invoices_* MCP tools (lines 653-713)
- `/Users/estebannunez/Projects/carabiner-os/carabiner/api/flask_blueprint.py` -- GET /api/invoices route
- `/Users/estebannunez/Projects/carabiner-os/carabiner/api/schemas.py` -- InvoiceOut schema (line 295)
