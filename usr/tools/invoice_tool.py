"""Invoice processing tool — upload, extract via vision/OCR, match, approve.

Uses Agent Zero's built-in vision stack:
- python.helpers.images — image compression (PIL-based)
- python.helpers.document_query — PDF text/table extraction via PyMuPDF + Tesseract
- Agent's LLM communication — multimodal messages for structured data extraction
"""

from __future__ import annotations

import base64
import json
import os
from pathlib import Path

from helpers.tool import Response, Tool

# Structured extraction prompt sent alongside invoice images/text
EXTRACTION_PROMPT = """\
Extract the following from this invoice. Return ONLY valid JSON, no other text.

{
  "vendor_name": "string",
  "invoice_number": "string",
  "invoice_date": "string (YYYY-MM-DD if possible)",
  "due_date": "string (YYYY-MM-DD if possible, or null)",
  "line_items": [
    {"description": "string", "quantity": number, "unit_price": number, "total": number}
  ],
  "subtotal": number,
  "tax": number,
  "total": number
}

If a field is not visible or not present, use null. For line_items, extract every
row you can identify. Amounts should be numbers (not strings).
"""


class InvoiceTool(Tool):
    async def execute(self, **kwargs) -> Response:
        try:
            return await self._run()
        except Exception as e:
            return Response(message=f"Error in invoice tool: {e}", break_loop=False)

    async def _run(self) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        # ----- list -----
        if method == "list":
            invoices = await repo.list_invoices(location_id)
            if not invoices:
                return Response(message="No invoices found.", break_loop=False)
            result = [
                {
                    "id": str(inv.id),
                    "vendor_name": inv.vendor_name,
                    "invoice_number": inv.invoice_number,
                    "status": inv.status,
                    "total": inv.total,
                    "source": inv.source,
                    "summary": inv.summary,
                }
                for inv in invoices
            ]
            return Response(
                message=json.dumps(result, indent=2),
                break_loop=False,
                additional={"module": "invoices", "action": "list"},
            )

        # ----- get -----
        if method == "get":
            invoice_id = self.args.get("invoice_id")
            if not invoice_id:
                return Response(message="Error: invoice_id is required.", break_loop=False)
            inv = await repo.get_invoice(invoice_id)
            if not inv:
                return Response(message=f"Invoice {invoice_id} not found.", break_loop=False)
            return Response(
                message=json.dumps(
                    {
                        "id": str(inv.id),
                        "vendor_name": inv.vendor_name,
                        "invoice_number": inv.invoice_number,
                        "invoice_date": inv.invoice_date,
                        "due_date": inv.due_date,
                        "status": inv.status,
                        "total": inv.total,
                        "subtotal": inv.subtotal,
                        "tax": inv.tax,
                        "line_items": inv.line_items,
                        "gl_codes": inv.gl_codes,
                        "extracted_data": inv.extracted_data,
                        "source": inv.source,
                        "summary": inv.summary,
                        "detail_points": inv.detail_points,
                    },
                    indent=2,
                ),
                break_loop=False,
            )

        # ----- process (vision / OCR pipeline) -----
        if method == "process":
            return await self._process_invoice()

        # ----- match (compare to PO / expected order) -----
        if method == "match":
            return await self._match_invoice()

        # ----- approve -----
        if method == "approve":
            invoice_id = self.args.get("invoice_id")
            if not invoice_id:
                return Response(message="Error: invoice_id is required.", break_loop=False)
            inv = await repo.update_invoice(invoice_id, {"status": "approved"})
            if not inv:
                return Response(message=f"Invoice {invoice_id} not found.", break_loop=False)
            return Response(
                message=f"Invoice {inv.invoice_number or invoice_id} approved.",
                break_loop=False,
                additional={"module": "invoices", "action": "approve", "item_id": str(inv.id)},
            )

        # ----- dispute -----
        if method == "dispute":
            invoice_id = self.args.get("invoice_id")
            reason = self.args.get("reason", "")
            if not invoice_id:
                return Response(message="Error: invoice_id is required.", break_loop=False)
            inv = await repo.update_invoice(
                invoice_id,
                {
                    "status": "disputed",
                    "summary": f"Disputed: {reason}" if reason else "Disputed by agent.",
                },
            )
            if not inv:
                return Response(message=f"Invoice {invoice_id} not found.", break_loop=False)
            return Response(
                message=f"Invoice {inv.invoice_number or invoice_id} marked as disputed.",
                break_loop=False,
                additional={"module": "invoices", "action": "dispute", "item_id": str(inv.id)},
            )

        return Response(
            message=f"Unknown method: {method}. Use list, get, process, match, approve, or dispute.",
            break_loop=False,
        )

    # ------------------------------------------------------------------
    # Process: vision / OCR extraction pipeline
    # ------------------------------------------------------------------

    async def _process_invoice(self) -> Response:
        from carabiner.db import repositories as repo

        invoice_id = self.args.get("invoice_id")
        if not invoice_id:
            return Response(message="Error: invoice_id is required for process.", break_loop=False)

        inv = await repo.get_invoice(invoice_id)
        if not inv:
            return Response(message=f"Invoice {invoice_id} not found.", break_loop=False)

        file_path = inv.file_path
        if not file_path or not os.path.isfile(file_path):
            return Response(
                message=f"No file found for invoice {invoice_id}. Upload a file first.",
                break_loop=False,
            )

        # Transition to processing
        await repo.update_invoice(invoice_id, {"status": "processing"})

        mime = inv.file_mime or ""
        try:
            if mime.startswith("image/"):
                extracted = await self._extract_from_image(file_path)
            elif mime == "application/pdf":
                extracted = await self._extract_from_pdf(file_path)
            else:
                return Response(
                    message=f"Unsupported file type for processing: {mime}",
                    break_loop=False,
                )
        except Exception as e:
            await repo.update_invoice(invoice_id, {"status": "error", "summary": f"Extraction failed: {e}"})
            return Response(message=f"Invoice extraction failed: {e}", break_loop=False)

        # Parse the LLM JSON response
        structured = self._parse_extraction(extracted)

        # Build update payload
        update: dict = {
            "status": "matched" if structured.get("line_items") else "review",
            "extracted_data": structured,
            "line_items": structured.get("line_items", []),
            "vendor_name": structured.get("vendor_name") or inv.vendor_name,
            "invoice_number": structured.get("invoice_number") or inv.invoice_number,
            "invoice_date": structured.get("invoice_date"),
            "due_date": structured.get("due_date"),
            "subtotal": str(structured["subtotal"]) if structured.get("subtotal") is not None else None,
            "tax": str(structured["tax"]) if structured.get("tax") is not None else None,
            "total": str(structured["total"]) if structured.get("total") is not None else None,
            "summary": self._build_summary(structured),
            "detail_points": self._build_detail_points(structured),
        }

        updated = await repo.update_invoice(invoice_id, update)
        return Response(
            message=json.dumps(
                {
                    "status": "processed",
                    "invoice_id": str(invoice_id),
                    "vendor": update.get("vendor_name"),
                    "total": update.get("total"),
                    "line_items_count": len(structured.get("line_items", [])),
                    "new_status": update["status"],
                },
                indent=2,
            ),
            break_loop=False,
            additional={"module": "invoices", "action": "process", "item_id": str(invoice_id)},
        )

    async def _extract_from_image(self, file_path: str) -> str:
        """Use Agent Zero's vision system to extract data from an invoice image."""
        from helpers.images import compress_image

        # Read and compress image
        with open(file_path, "rb") as f:
            raw_bytes = f.read()

        compressed = compress_image(raw_bytes, max_pixels=768_000, quality=75)
        b64 = base64.b64encode(compressed).decode("utf-8")

        # Build multimodal message and send through agent's utility model
        from langchain.schema import HumanMessage, SystemMessage

        messages = [
            SystemMessage(content="You are an invoice data extraction assistant. Extract structured data from invoice images."),
            HumanMessage(content=[
                {"type": "text", "text": EXTRACTION_PROMPT},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                },
            ]),
        ]

        response, _reasoning = await self.agent.call_chat_model(
            messages=messages,
            explicit_caching=False,
        )

        return str(response)

    async def _extract_from_pdf(self, file_path: str) -> str:
        """Use PyMuPDF + Tesseract OCR to extract text, then ask LLM to structure it."""
        import tempfile

        # Extract text using PyMuPDF (same approach as Agent Zero's document_query)
        text_content = ""
        try:
            from langchain_community.document_loaders.pdf import PyMuPDFLoader
            from langchain_community.document_loaders.parsers.images import TesseractBlobParser

            loader = PyMuPDFLoader(
                file_path,
                mode="single",
                extract_tables="markdown",
                extract_images=True,
                images_inner_format="text",
                images_parser=TesseractBlobParser(),
                pages_delimiter="\n",
            )
            elements = loader.load()
            text_content = "\n".join([el.page_content for el in elements])
        except Exception:
            text_content = ""

        # Fallback to pdf2image + pytesseract if PyMuPDF extraction is empty
        if not text_content.strip():
            try:
                import pdf2image
                import pytesseract

                pages = pdf2image.convert_from_path(file_path)
                for page in pages:
                    text_content += pytesseract.image_to_string(page) + "\n\n"
            except Exception as e:
                raise RuntimeError(f"PDF OCR fallback failed: {e}") from e

        if not text_content.strip():
            raise RuntimeError("Could not extract any text from PDF.")

        # Send extracted text to LLM for structured parsing
        from langchain.schema import HumanMessage, SystemMessage

        messages = [
            SystemMessage(content="You are an invoice data extraction assistant. Parse the extracted invoice text into structured data."),
            HumanMessage(content=f"{EXTRACTION_PROMPT}\n\n--- Extracted Invoice Text ---\n{text_content[:8000]}"),
        ]

        response, _reasoning = await self.agent.call_chat_model(
            messages=messages,
            explicit_caching=False,
        )

        return str(response)

    def _parse_extraction(self, raw: str) -> dict:
        """Parse LLM extraction response into a dict, tolerating markdown fences."""
        text = raw.strip()
        # Strip markdown code fences
        if text.startswith("```"):
            lines = text.split("\n")
            lines = lines[1:]  # drop opening fence
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON object in the text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass
            return {"raw_text": raw, "parse_error": True}

    def _build_summary(self, data: dict) -> str:
        vendor = data.get("vendor_name") or "Unknown vendor"
        total = data.get("total")
        num = data.get("invoice_number") or ""
        total_str = f"${total}" if total is not None else "unknown total"
        parts = [f"Invoice from {vendor}"]
        if num:
            parts[0] += f" (#{num})"
        parts.append(f"Total: {total_str}")
        items = data.get("line_items", [])
        if items:
            parts.append(f"{len(items)} line item(s)")
        return " — ".join(parts)

    def _build_detail_points(self, data: dict) -> list:
        points = []
        if data.get("vendor_name"):
            points.append(f"Vendor: {data['vendor_name']}")
        if data.get("invoice_number"):
            points.append(f"Invoice #: {data['invoice_number']}")
        if data.get("invoice_date"):
            points.append(f"Date: {data['invoice_date']}")
        if data.get("due_date"):
            points.append(f"Due: {data['due_date']}")
        items = data.get("line_items", [])
        for item in items[:5]:
            desc = item.get("description", "?")
            qty = item.get("quantity", "?")
            total = item.get("total", "?")
            points.append(f"{desc}: {qty} x ${total}")
        if len(items) > 5:
            points.append(f"...and {len(items) - 5} more item(s)")
        if data.get("subtotal") is not None:
            points.append(f"Subtotal: ${data['subtotal']}")
        if data.get("tax") is not None:
            points.append(f"Tax: ${data['tax']}")
        if data.get("total") is not None:
            points.append(f"Total: ${data['total']}")
        return points

    # ------------------------------------------------------------------
    # Match: compare extracted data against existing orders
    # ------------------------------------------------------------------

    async def _match_invoice(self) -> Response:
        from carabiner.db import repositories as repo

        invoice_id = self.args.get("invoice_id")
        if not invoice_id:
            return Response(message="Error: invoice_id is required for match.", break_loop=False)

        inv = await repo.get_invoice(invoice_id)
        if not inv:
            return Response(message=f"Invoice {invoice_id} not found.", break_loop=False)

        if not inv.line_items:
            return Response(
                message="Invoice has no extracted line items. Run process first.",
                break_loop=False,
            )

        # Attempt to find matching orders by vendor name
        location_id = str(inv.location_id) if inv.location_id else None
        orders = await repo.list_orders(location_id)

        matched_orders = []
        vendor = (inv.vendor_name or "").lower()
        for order in orders:
            if vendor and vendor in (order.vendor or "").lower():
                matched_orders.append({
                    "order_id": str(order.id),
                    "vendor": order.vendor,
                    "total": order.total,
                    "status": order.status,
                })

        if matched_orders:
            await repo.update_invoice(invoice_id, {"status": "matched"})
            return Response(
                message=json.dumps({
                    "invoice_id": str(invoice_id),
                    "status": "matched",
                    "matching_orders": matched_orders,
                }, indent=2),
                break_loop=False,
                additional={"module": "invoices", "action": "match", "item_id": str(invoice_id)},
            )
        else:
            await repo.update_invoice(invoice_id, {"status": "review"})
            return Response(
                message=json.dumps({
                    "invoice_id": str(invoice_id),
                    "status": "review",
                    "matching_orders": [],
                    "note": "No matching orders found. Manual review needed.",
                }, indent=2),
                break_loop=False,
                additional={"module": "invoices", "action": "match", "item_id": str(invoice_id)},
            )
