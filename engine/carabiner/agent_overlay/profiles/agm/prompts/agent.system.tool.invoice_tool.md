## Tool: invoice_tool

Manages invoice processing, PO matching, and AP workflow for the active location.

### Methods

**list** -- List all invoices
```json
{
  "method": "list",
  "location_id": "optional-uuid"
}
```
Returns: Array of invoices with vendor, invoice_number, date, status, total, summary.

**get** -- Get a specific invoice with full details
```json
{
  "method": "get",
  "invoice_id": "uuid-of-invoice"
}
```
Returns: Full invoice details including line_items, gl_codes, po_match_id, variance_notes.

**process** -- Start OCR extraction on an uploaded invoice
```json
{
  "method": "process",
  "invoice_id": "uuid-of-invoice"
}
```
Transitions invoice from "Uploaded" to "Processing". Extracts line items and matches to inventory.

**match** -- Match an invoice to a purchase order
```json
{
  "method": "match",
  "invoice_id": "uuid-of-invoice",
  "po_id": "PO-XX-NNNN",
  "variance_notes": "optional notes about price variances"
}
```
Transitions invoice to "Matched" status with PO reference.

**approve** -- Approve a matched invoice for payment
```json
{
  "method": "approve",
  "invoice_id": "uuid-of-invoice"
}
```
Transitions invoice from "Matched" to "Approved".

**dispute** -- Flag an invoice for dispute
```json
{
  "method": "dispute",
  "invoice_id": "uuid-of-invoice",
  "reason": "Description of the dispute"
}
```
Transitions invoice to "Disputed" status.

**update** -- Update invoice fields
```json
{
  "method": "update",
  "invoice_id": "uuid-of-invoice",
  "status": "Matched",
  "total": "$1,500"
}
```

### Status Workflow
Uploaded -> Processing -> Matched -> Approved -> Paid
Any status (except Paid) can be moved to "Disputed".
Disputed invoices can be reprocessed (back to "Processing").

### Notes
- Always specify location_id when listing to get location-specific results
- Status values: "Uploaded", "Processing", "Matched", "Approved", "Paid", "Disputed"
- Line items include description, qty, unit_price, total, and gl_code
- GL codes are auto-assigned based on item category when available
- Variance notes flag price differences between invoice and PO
