## Tool: invoice_tool

Manages vendor invoices — upload, extract data via vision/OCR, match to orders, approve or dispute.

### Methods

**list** — List all invoices
```json
{
  "method": "list",
  "location_id": "optional-uuid"
}
```
Returns: Array of invoices with vendor_name, invoice_number, status, total, source, summary.

**get** — Get full invoice details
```json
{
  "method": "get",
  "invoice_id": "uuid-of-invoice"
}
```
Returns: Complete invoice including line_items, gl_codes, extracted_data.

**process** — Extract data from an uploaded invoice using vision (images) or OCR (PDFs)
```json
{
  "method": "process",
  "invoice_id": "uuid-of-invoice"
}
```
Returns: Extraction results with vendor, total, line items count, new status.
The tool will automatically detect the file type and use the appropriate extraction method:
- Images (JPG/PNG): compressed and sent to the LLM as a vision message
- PDFs: text/tables extracted via PyMuPDF + Tesseract OCR, then parsed by LLM

**match** — Compare extracted invoice data against existing vendor orders
```json
{
  "method": "match",
  "invoice_id": "uuid-of-invoice"
}
```
Returns: Matching orders (if any) or a review flag if no match found.

**approve** — Mark an invoice as approved
```json
{
  "method": "approve",
  "invoice_id": "uuid-of-invoice"
}
```

**dispute** — Flag an invoice as disputed
```json
{
  "method": "dispute",
  "invoice_id": "uuid-of-invoice",
  "reason": "Line item pricing does not match PO"
}
```

### Workflow
1. Invoice is uploaded (via REST endpoint or email webhook) with status "uploaded"
2. Call **process** to extract structured data → status becomes "matched" or "review"
3. Call **match** to compare against existing orders
4. Call **approve** or **dispute** to finalize

### Status values
- `uploaded` — File received, not yet processed
- `processing` — Extraction in progress
- `matched` — Extracted and matched to an order
- `review` — Needs manual review (no match or partial extraction)
- `approved` — Approved for payment
- `disputed` — Flagged for discrepancy
- `error` — Extraction failed

## Write Operations (via MCP)
To create new invoice records or delete existing ones, use the carabiner_db MCP tools:
- `carabiner_db.invoices_create` — Create a new invoice record (e.g., before uploading a file)
- `carabiner_db.invoices_update` — Update invoice fields directly (status, vendor, total, etc.)
- `carabiner_db.invoices_delete` — Remove an invoice record

Note: For the standard approve/dispute/process/match workflow, use the `invoice_tool` methods above. Use the MCP tools for direct record management outside the normal workflow.
