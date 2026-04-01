"""carabiner orders — purchase order management."""

from __future__ import annotations

import sys
import uuid
from typing import Optional

import typer

from carabiner.cli.db import EXIT_DB_ERROR, EXIT_NOT_FOUND, EXIT_VALIDATION, db_call
from carabiner.cli.output import is_json_mode, print_detail, print_error, print_json, print_table

app = typer.Typer(name="orders", help="Purchase order management.", no_args_is_help=True)


def _serialize_order(o) -> dict:
    """Convert a WorkspaceOrder ORM instance to a plain dict."""
    return {
        "id": str(o.id),
        "location_id": str(o.location_id),
        "vendor": o.vendor,
        "channel": o.channel,
        "status": o.status,
        "total": o.total,
        "eta": o.eta,
        "line_items": o.line_items,
        "summary": o.summary,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


@app.command()
def list(
    location_id: Optional[str] = typer.Option(None, "--location-id", "-l", help="Filter by location UUID."),
    status: Optional[str] = typer.Option(None, "--status", "-s", help="Filter by status (e.g. draft, submitted)."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """List purchase orders."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id) if location_id else None
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        orders = db_call(repositories.list_orders, location_id=loc)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    rows = [_serialize_order(o) for o in orders]

    if status:
        rows = [r for r in rows if r["status"].lower() == status.lower()]

    if is_json_mode(json_output):
        print_json({"orders": rows, "count": len(rows)})
    else:
        print_table(
            rows,
            columns=["id", "vendor", "status", "total", "eta"],
            title="Orders",
        )


@app.command()
def get(
    order_id: str = typer.Argument(help="Order UUID."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Get a single order by ID."""
    from carabiner.db import repositories

    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {order_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        order = db_call(repositories.get_order, oid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if order is None:
        print_error(EXIT_NOT_FOUND, f"Order {order_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    data = _serialize_order(order)

    if is_json_mode(json_output):
        print_json(data)
    else:
        print_detail(data, title=f"Order {order_id[:8]}...")


@app.command()
def create(
    location_id: str = typer.Option(..., "--location-id", "-l", help="Location UUID."),
    vendor: str = typer.Option(..., "--vendor", help="Vendor name."),
    channel: str = typer.Option("manual", "--channel", help="Order channel."),
    total: str = typer.Option("0.00", "--total", help="Order total."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be created without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Create a new purchase order."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    data = {
        "location_id": loc,
        "vendor": vendor,
        "channel": channel,
        "total": total,
        "status": "Drafting",
    }

    if dry_run:
        payload = {k: str(v) for k, v in data.items()}
        payload["_dry_run"] = True
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Order")
        return

    try:
        order = db_call(repositories.create_order, data)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    result = _serialize_order(order)

    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Created Order")


@app.command()
def delete(
    order_id: str = typer.Argument(help="Order UUID."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be deleted without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Delete an order by ID."""
    from carabiner.db import repositories

    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {order_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    if dry_run:
        payload = {"id": order_id, "_dry_run": True, "action": "delete"}
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Delete Order")
        return

    try:
        deleted = db_call(repositories.delete_order, oid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if not deleted:
        print_error(EXIT_NOT_FOUND, f"Order {order_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    result = {"id": order_id, "deleted": True}
    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Deleted Order")
