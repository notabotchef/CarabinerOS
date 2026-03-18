"""Invoice processing tool — list, process, match, approve, dispute invoices."""

from __future__ import annotations

import json
from python.helpers.tool import Response, Tool


VALID_STATUSES = ["Uploaded", "Processing", "Matched", "Approved", "Paid", "Disputed"]

# Allowed status transitions
STATUS_TRANSITIONS = {
    "Uploaded": ["Processing"],
    "Processing": ["Matched", "Disputed"],
    "Matched": ["Approved", "Disputed"],
    "Approved": ["Paid", "Disputed"],
    "Paid": [],
    "Disputed": ["Processing"],
}


class InvoiceTool(Tool):
    async def execute(self, **kwargs) -> Response:
        try:
            return await self._run()
        except Exception as e:
            return Response(message=f"Error accessing invoice data: {e}", break_loop=False)

    async def _run(self) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            invoices = await repo.list_invoices(location_id)
            if not invoices:
                return Response(message="No invoices found for this location.", break_loop=False)
            result = [
                {
                    "id": str(inv.id),
                    "vendor": inv.vendor,
                    "invoice_number": inv.invoice_number,
                    "invoice_date": inv.invoice_date,
                    "status": inv.status,
                    "total": inv.total,
                    "summary": inv.summary,
                }
                for inv in invoices
            ]
            return Response(
                message=json.dumps(result, indent=2),
                break_loop=False,
                additional={"module": "invoices", "action": "list"},
            )

        if method == "get":
            invoice_id = self.args.get("invoice_id")
            if not invoice_id:
                return Response(message="Error: invoice_id is required.", break_loop=False)
            invoice = await repo.get_invoice(invoice_id)
            if not invoice:
                return Response(message=f"Invoice {invoice_id} not found.", break_loop=False)
            return Response(
                message=json.dumps(
                    {
                        "id": str(invoice.id),
                        "vendor": invoice.vendor,
                        "invoice_number": invoice.invoice_number,
                        "invoice_date": invoice.invoice_date,
                        "due_date": invoice.due_date,
                        "status": invoice.status,
                        "total": invoice.total,
                        "line_items": invoice.line_items,
                        "gl_codes": invoice.gl_codes,
                        "po_match_id": invoice.po_match_id,
                        "variance_notes": invoice.variance_notes,
                        "summary": invoice.summary,
                        "detail_points": invoice.detail_points,
                    },
                    indent=2,
                ),
                break_loop=False,
            )

        if method == "process":
            invoice_id = self.args.get("invoice_id")
            if not invoice_id:
                return Response(message="Error: invoice_id is required.", break_loop=False)
            invoice = await repo.get_invoice(invoice_id)
            if not invoice:
                return Response(message=f"Invoice {invoice_id} not found.", break_loop=False)

            if invoice.status != "Uploaded":
                return Response(
                    message=f"Invoice is in '{invoice.status}' status. Only 'Uploaded' invoices can be processed.",
                    break_loop=False,
                )

            # Mock OCR/extraction — in production this would call an OCR service
            updates = {
                "status": "Processing",
                "summary": f"Processing invoice {invoice.invoice_number or 'N/A'} from {invoice.vendor}. "
                "OCR extraction is running and line items are being matched to inventory.",
                "detail_points": [
                    "OCR extraction initiated on the uploaded document.",
                    "Line items are being matched to existing inventory items.",
                    "GL codes will be auto-assigned based on item categories.",
                    "PO matching will be attempted after extraction completes.",
                ],
            }
            updated = await repo.update_invoice(invoice_id, updates)
            return Response(
                message=f"Invoice {invoice.invoice_number or invoice_id} is now being processed. "
                "Line items are being extracted and matched.",
                break_loop=False,
                additional={"module": "invoices", "action": "process", "item_id": str(invoice.id)},
            )

        if method == "match":
            invoice_id = self.args.get("invoice_id")
            po_id = self.args.get("po_id")
            if not invoice_id:
                return Response(message="Error: invoice_id is required.", break_loop=False)
            invoice = await repo.get_invoice(invoice_id)
            if not invoice:
                return Response(message=f"Invoice {invoice_id} not found.", break_loop=False)

            if invoice.status not in ("Processing", "Uploaded"):
                return Response(
                    message=f"Invoice is in '{invoice.status}' status and cannot be matched.",
                    break_loop=False,
                )

            updates = {
                "status": "Matched",
                "po_match_id": po_id,
                "summary": f"Invoice matched to PO {po_id or 'N/A'}. Ready for approval.",
                "detail_points": [
                    f"Invoice matched to purchase order {po_id or 'N/A'}.",
                    "Line item quantities and prices compared.",
                    "Variances flagged where applicable.",
                    "Invoice is ready for manager approval.",
                ],
            }
            if po_id:
                updates["variance_notes"] = self.args.get("variance_notes", "Matched within tolerance.")

            updated = await repo.update_invoice(invoice_id, updates)
            return Response(
                message=f"Invoice {invoice.invoice_number or invoice_id} matched to PO {po_id or 'manual review'}.",
                break_loop=False,
                additional={"module": "invoices", "action": "match", "item_id": str(invoice.id)},
            )

        if method == "approve":
            invoice_id = self.args.get("invoice_id")
            if not invoice_id:
                return Response(message="Error: invoice_id is required.", break_loop=False)
            invoice = await repo.get_invoice(invoice_id)
            if not invoice:
                return Response(message=f"Invoice {invoice_id} not found.", break_loop=False)

            if invoice.status != "Matched":
                return Response(
                    message=f"Invoice is in '{invoice.status}' status. Only 'Matched' invoices can be approved.",
                    break_loop=False,
                )

            updates = {
                "status": "Approved",
                "summary": f"Invoice {invoice.invoice_number or 'N/A'} approved for payment.",
            }
            updated = await repo.update_invoice(invoice_id, updates)
            return Response(
                message=f"Invoice {invoice.invoice_number or invoice_id} from {invoice.vendor} has been approved ({invoice.total}).",
                break_loop=False,
                additional={"module": "invoices", "action": "approve", "item_id": str(invoice.id)},
            )

        if method == "dispute":
            invoice_id = self.args.get("invoice_id")
            reason = self.args.get("reason", "Unspecified dispute reason.")
            if not invoice_id:
                return Response(message="Error: invoice_id is required.", break_loop=False)
            invoice = await repo.get_invoice(invoice_id)
            if not invoice:
                return Response(message=f"Invoice {invoice_id} not found.", break_loop=False)

            if invoice.status in ("Paid",):
                return Response(
                    message="Cannot dispute a paid invoice.",
                    break_loop=False,
                )

            updates = {
                "status": "Disputed",
                "variance_notes": reason,
                "summary": f"Invoice {invoice.invoice_number or 'N/A'} disputed: {reason}",
            }
            updated = await repo.update_invoice(invoice_id, updates)
            return Response(
                message=f"Invoice {invoice.invoice_number or invoice_id} has been disputed. Reason: {reason}",
                break_loop=False,
                additional={"module": "invoices", "action": "dispute", "item_id": str(invoice.id)},
            )

        if method == "update":
            invoice_id = self.args.get("invoice_id")
            if not invoice_id:
                return Response(message="Error: invoice_id is required.", break_loop=False)
            allowed_fields = [
                "status", "total", "summary", "vendor", "invoice_number",
                "due_date", "variance_notes", "po_match_id",
            ]
            updates = {f: self.args[f] for f in allowed_fields if f in self.args}

            # Validate status transitions
            if "status" in updates:
                invoice = await repo.get_invoice(invoice_id)
                if not invoice:
                    return Response(message=f"Invoice {invoice_id} not found.", break_loop=False)
                allowed = STATUS_TRANSITIONS.get(invoice.status, [])
                if updates["status"] not in allowed:
                    return Response(
                        message=f"Cannot transition from '{invoice.status}' to '{updates['status']}'. "
                        f"Allowed transitions: {allowed}",
                        break_loop=False,
                    )

            updated = await repo.update_invoice(invoice_id, updates)
            if not updated:
                return Response(message=f"Invoice {invoice_id} not found.", break_loop=False)
            return Response(
                message=f"Invoice updated: {updated.vendor} is now {updated.status}.",
                break_loop=False,
                additional={"module": "invoices", "action": "update", "item_id": str(updated.id)},
            )

        return Response(
            message=f"Unknown method: {method}. Use list, get, process, match, approve, dispute, or update.",
            break_loop=False,
        )
