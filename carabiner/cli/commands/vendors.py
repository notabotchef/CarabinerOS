"""carabiner vendors — vendor management."""

from __future__ import annotations

import uuid
from typing import Optional

import typer
from sqlalchemy import select

from carabiner.cli.db import EXIT_DB_ERROR, EXIT_NOT_FOUND, EXIT_VALIDATION, db_call, run_async, ensure_db, cleanup_db
from carabiner.cli.output import is_json_mode, print_detail, print_error, print_json, print_table

app = typer.Typer(name="vendors", help="Vendor management.", no_args_is_help=True)


def _serialize_vendor(v) -> dict:
    """Convert a Vendor ORM instance to a plain dict."""
    return {
        "id": str(v.id),
        "name": v.name,
        "contact_email": v.contact_email,
        "contact_phone": v.contact_phone,
        "payment_terms": v.payment_terms,
        "connector_id": v.connector_id,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "updated_at": v.updated_at.isoformat() if v.updated_at else None,
    }


async def _list_vendors():
    """List all vendors (no repository function exists, query directly)."""
    await ensure_db()
    try:
        from carabiner.db.engine import get_session
        from carabiner.db.models import Vendor

        async with get_session() as session:
            stmt = select(Vendor).order_by(Vendor.name)
            result = await session.execute(stmt)
            return result.scalars().all()
    finally:
        await cleanup_db()


async def _get_vendor(vendor_id: uuid.UUID):
    """Get a single vendor by ID."""
    await ensure_db()
    try:
        from carabiner.db.engine import get_session
        from carabiner.db.models import Vendor

        async with get_session() as session:
            result = await session.execute(
                select(Vendor).where(Vendor.id == vendor_id)
            )
            return result.scalar_one_or_none()
    finally:
        await cleanup_db()


@app.command()
def list(
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """List all vendors."""
    try:
        vendors = run_async(_list_vendors())
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    rows = [_serialize_vendor(v) for v in vendors]

    if is_json_mode(json_output):
        print_json({"vendors": rows, "count": len(rows)})
    else:
        print_table(
            rows,
            columns=["id", "name", "contact_email", "contact_phone", "payment_terms"],
            title="Vendors",
        )


@app.command()
def get(
    vendor_id: str = typer.Argument(help="Vendor UUID."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Get a single vendor by ID."""
    try:
        vid = uuid.UUID(vendor_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {vendor_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        vendor = run_async(_get_vendor(vid))
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if vendor is None:
        print_error(EXIT_NOT_FOUND, f"Vendor {vendor_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    data = _serialize_vendor(vendor)

    if is_json_mode(json_output):
        print_json(data)
    else:
        print_detail(data, title=f"Vendor: {data['name']}")
