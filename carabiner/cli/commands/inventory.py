"""carabiner inventory — inventory tracking and counts."""

from __future__ import annotations

import sys
import uuid
from typing import Optional

import typer

from carabiner.cli.db import EXIT_DB_ERROR, EXIT_NOT_FOUND, EXIT_VALIDATION, db_call
from carabiner.cli.output import is_json_mode, print_detail, print_error, print_json, print_table

app = typer.Typer(name="inventory", help="Inventory tracking and counts.", no_args_is_help=True)


def _serialize_inventory(inv) -> dict:
    """Convert a WorkspaceInventory ORM instance to a plain dict."""
    return {
        "id": str(inv.id),
        "location_id": str(inv.location_id),
        "item_name": inv.item_name,
        "on_hand": inv.on_hand,
        "par": inv.par,
        "unit": inv.unit,
        "variance": inv.variance,
        "category": inv.category,
        "storage_area": inv.storage_area,
        "unit_cost": inv.unit_cost,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
    }


@app.command()
def list(
    location_id: Optional[str] = typer.Option(None, "--location-id", "-l", help="Filter by location UUID."),
    category: Optional[str] = typer.Option(None, "--category", "-c", help="Filter by category (e.g. produce, protein)."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """List inventory items."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id) if location_id else None
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        items = db_call(repositories.list_inventory, location_id=loc)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    rows = [_serialize_inventory(i) for i in items]

    if category:
        rows = [r for r in rows if r.get("category") and r["category"].lower() == category.lower()]

    if is_json_mode(json_output):
        print_json({"inventory": rows, "count": len(rows)})
    else:
        print_table(
            rows,
            columns=["id", "item_name", "on_hand", "par", "variance", "category"],
            title="Inventory",
        )


@app.command()
def get(
    item_id: str = typer.Argument(help="Inventory item UUID."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Get a single inventory item by ID."""
    from carabiner.db import repositories

    try:
        iid = uuid.UUID(item_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {item_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        item = db_call(repositories.get_inventory, iid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if item is None:
        print_error(EXIT_NOT_FOUND, f"Inventory item {item_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    data = _serialize_inventory(item)

    if is_json_mode(json_output):
        print_json(data)
    else:
        print_detail(data, title=f"Inventory Item {item_id[:8]}...")


@app.command()
def create(
    location_id: str = typer.Option(..., "--location-id", "-l", help="Location UUID."),
    item_name: str = typer.Option(..., "--item-name", help="Item name."),
    on_hand: str = typer.Option(..., "--on-hand", help="Current on-hand quantity (e.g. '12 lb')."),
    par: str = typer.Option(..., "--par", help="Par level (e.g. '20 lb')."),
    variance: str = typer.Option("OK", "--variance", help="Variance status (OK, Low, Critical)."),
    unit: Optional[str] = typer.Option(None, "--unit", help="Unit of measure."),
    category: Optional[str] = typer.Option(None, "--category", help="Category (produce, protein, dairy, dry)."),
    storage_area: Optional[str] = typer.Option(None, "--storage-area", help="Storage area."),
    unit_cost: Optional[str] = typer.Option(None, "--unit-cost", help="Unit cost."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be created without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Create a new inventory item."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    data: dict = {
        "location_id": loc,
        "item_name": item_name,
        "on_hand": on_hand,
        "par": par,
        "variance": variance,
    }
    if unit is not None:
        data["unit"] = unit
    if category is not None:
        data["category"] = category
    if storage_area is not None:
        data["storage_area"] = storage_area
    if unit_cost is not None:
        data["unit_cost"] = unit_cost

    if dry_run:
        payload = {k: str(v) for k, v in data.items()}
        payload["_dry_run"] = True
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Inventory Item")
        return

    try:
        item = db_call(repositories.create_inventory, data)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    result = _serialize_inventory(item)

    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Created Inventory Item")


@app.command()
def update(
    item_id: str = typer.Argument(help="Inventory item UUID."),
    item_name: Optional[str] = typer.Option(None, "--item-name", help="Item name."),
    on_hand: Optional[str] = typer.Option(None, "--on-hand", help="Current on-hand quantity."),
    par: Optional[str] = typer.Option(None, "--par", help="Par level."),
    variance: Optional[str] = typer.Option(None, "--variance", help="Variance status."),
    unit: Optional[str] = typer.Option(None, "--unit", help="Unit of measure."),
    category: Optional[str] = typer.Option(None, "--category", help="Category."),
    storage_area: Optional[str] = typer.Option(None, "--storage-area", help="Storage area."),
    unit_cost: Optional[str] = typer.Option(None, "--unit-cost", help="Unit cost."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be updated without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Update an existing inventory item."""
    from carabiner.db import repositories

    try:
        iid = uuid.UUID(item_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {item_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    data: dict = {}
    if item_name is not None:
        data["item_name"] = item_name
    if on_hand is not None:
        data["on_hand"] = on_hand
    if par is not None:
        data["par"] = par
    if variance is not None:
        data["variance"] = variance
    if unit is not None:
        data["unit"] = unit
    if category is not None:
        data["category"] = category
    if storage_area is not None:
        data["storage_area"] = storage_area
    if unit_cost is not None:
        data["unit_cost"] = unit_cost

    if not data:
        print_error(EXIT_VALIDATION, "No fields to update. Pass at least one --field flag.", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    if dry_run:
        payload = {"id": item_id, "_dry_run": True, **{k: str(v) for k, v in data.items()}}
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Update Inventory")
        return

    try:
        item = db_call(repositories.update_inventory, iid, data)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if item is None:
        print_error(EXIT_NOT_FOUND, f"Inventory item {item_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    result = _serialize_inventory(item)

    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Updated Inventory Item")


@app.command()
def delete(
    item_id: str = typer.Argument(help="Inventory item UUID."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be deleted without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Delete an inventory item by ID."""
    from carabiner.db import repositories

    try:
        iid = uuid.UUID(item_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {item_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    if dry_run:
        payload = {"id": item_id, "_dry_run": True, "action": "delete"}
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Delete Inventory Item")
        return

    try:
        deleted = db_call(repositories.delete_inventory, iid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if not deleted:
        print_error(EXIT_NOT_FOUND, f"Inventory item {item_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    result = {"id": item_id, "deleted": True}
    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Deleted Inventory Item")


@app.command()
def valuation(
    location_id: Optional[str] = typer.Option(None, "--location-id", "-l", help="Filter by location UUID."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Get total inventory valuation."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id) if location_id else None
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        result = db_call(repositories.get_inventory_valuation, location_id=loc)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    result["location_id"] = str(result["location_id"]) if result["location_id"] else None

    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Inventory Valuation")


@app.command()
def counts(
    location_id: Optional[str] = typer.Option(None, "--location-id", "-l", help="Filter by location UUID."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """List inventory counts."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id) if location_id else None
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        rows = db_call(repositories.list_inventory_counts, location_id=loc)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    # Serialize UUIDs in the dicts
    for row in rows:
        row["id"] = str(row["id"])
        row["location_id"] = str(row["location_id"]) if row.get("location_id") else None
        if row.get("created_at"):
            row["created_at"] = row["created_at"].isoformat()
        if row.get("updated_at"):
            row["updated_at"] = row["updated_at"].isoformat()

    if is_json_mode(json_output):
        print_json({"counts": rows, "count": len(rows)})
    else:
        print_table(
            rows,
            columns=["id", "count_date", "count_type", "status", "line_count", "total_value"],
            title="Inventory Counts",
        )
