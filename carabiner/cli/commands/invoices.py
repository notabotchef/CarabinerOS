"""carabiner invoices — invoice management."""

from __future__ import annotations

import uuid
from typing import Optional

import typer

from carabiner.cli.db import EXIT_DB_ERROR, EXIT_NOT_FOUND, EXIT_VALIDATION, db_call
from carabiner.cli.output import is_json_mode, print_detail, print_error, print_json, print_table

app = typer.Typer(name="invoices", help="Invoice management.", no_args_is_help=True)


def _serialize_invoice(inv) -> dict:
    """Convert a WorkspaceInvoice ORM instance to a plain dict."""
    return {
        "id": str(inv.id),
        "location_id": str(inv.location_id),
        "vendor_name": inv.vendor_name,
        "invoice_number": inv.invoice_number,
        "invoice_date": inv.invoice_date,
        "due_date": inv.due_date,
        "status": inv.status,
        "source": inv.source,
        "subtotal": inv.subtotal,
        "tax": inv.tax,
        "total": inv.total,
        "line_items": inv.line_items,
        "match_status": inv.match_status,
        "ocr_confidence": inv.ocr_confidence,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
    }


@app.command()
def list(
    location_id: Optional[str] = typer.Option(None, "--location-id", "-l", help="Filter by location UUID."),
    status: Optional[str] = typer.Option(None, "--status", "-s", help="Filter by status."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """List invoices."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id) if location_id else None
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        invoices = db_call(repositories.list_invoices, location_id=loc)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    rows = [_serialize_invoice(i) for i in invoices]

    if status:
        rows = [r for r in rows if r["status"].lower() == status.lower()]

    if is_json_mode(json_output):
        print_json({"invoices": rows, "count": len(rows)})
    else:
        print_table(
            rows,
            columns=["id", "vendor_name", "invoice_number", "status", "total", "invoice_date"],
            title="Invoices",
        )


@app.command()
def get(
    invoice_id: str = typer.Argument(help="Invoice UUID."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Get a single invoice by ID."""
    from carabiner.db import repositories

    try:
        iid = uuid.UUID(invoice_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {invoice_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        invoice = db_call(repositories.get_invoice, iid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if invoice is None:
        print_error(EXIT_NOT_FOUND, f"Invoice {invoice_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    data = _serialize_invoice(invoice)

    if is_json_mode(json_output):
        print_json(data)
    else:
        print_detail(data, title=f"Invoice {data.get('invoice_number', invoice_id[:8])}")


@app.command()
def delete(
    invoice_id: str = typer.Argument(help="Invoice UUID."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be deleted without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Delete an invoice by ID."""
    from carabiner.db import repositories

    try:
        iid = uuid.UUID(invoice_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {invoice_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    if dry_run:
        payload = {"id": invoice_id, "_dry_run": True, "action": "delete"}
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Delete Invoice")
        return

    try:
        deleted = db_call(repositories.delete_invoice, iid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if not deleted:
        print_error(EXIT_NOT_FOUND, f"Invoice {invoice_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    result = {"id": invoice_id, "deleted": True}
    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Deleted Invoice")
