"""carabiner food-cost — food cost tracking and analysis."""

from __future__ import annotations

import uuid
from typing import Optional

import typer

from carabiner.cli.db import EXIT_DB_ERROR, EXIT_NOT_FOUND, EXIT_VALIDATION, db_call
from carabiner.cli.output import is_json_mode, print_detail, print_error, print_json, print_table

app = typer.Typer(name="food-cost", help="Food cost tracking and analysis.", no_args_is_help=True)


def _serialize_food_cost(fc) -> dict:
    """Convert a WorkspaceFoodCost ORM instance to a plain dict."""
    return {
        "id": str(fc.id),
        "location_id": str(fc.location_id),
        "menu_item_name": fc.menu_item_name,
        "pressure": fc.pressure,
        "current_cost_pct": fc.current_cost_pct,
        "action": fc.action,
        "summary": fc.summary,
        "created_at": fc.created_at.isoformat() if fc.created_at else None,
        "updated_at": fc.updated_at.isoformat() if fc.updated_at else None,
    }


@app.command()
def list(
    location_id: Optional[str] = typer.Option(None, "--location-id", "-l", help="Filter by location UUID."),
    pressure: Optional[str] = typer.Option(None, "--pressure", "-p", help="Filter by pressure level (low, medium, high)."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """List food cost items."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id) if location_id else None
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        items = db_call(repositories.list_food_cost, location_id=loc)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    rows = [_serialize_food_cost(fc) for fc in items]

    if pressure:
        rows = [r for r in rows if r["pressure"].lower() == pressure.lower()]

    if is_json_mode(json_output):
        print_json({"food_cost_items": rows, "count": len(rows)})
    else:
        print_table(
            rows,
            columns=["id", "menu_item_name", "pressure", "current_cost_pct", "action"],
            title="Food Cost",
        )


@app.command()
def get(
    item_id: str = typer.Argument(help="Food cost item UUID."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Get a single food cost item by ID."""
    from carabiner.db import repositories

    try:
        fid = uuid.UUID(item_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {item_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        item = db_call(repositories.get_food_cost, fid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if item is None:
        print_error(EXIT_NOT_FOUND, f"Food cost item {item_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    data = _serialize_food_cost(item)

    if is_json_mode(json_output):
        print_json(data)
    else:
        print_detail(data, title=f"Food Cost: {data['menu_item_name']}")


@app.command()
def summary(
    location_id: Optional[str] = typer.Option(None, "--location-id", "-l", help="Filter by location UUID."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Show food cost summary with pressure distribution."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id) if location_id else None
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        items = db_call(repositories.list_food_cost, location_id=loc)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    # Build summary
    pressure_counts: dict[str, int] = {}
    total = len(items)
    for fc in items:
        p = fc.pressure.lower()
        pressure_counts[p] = pressure_counts.get(p, 0) + 1

    result = {
        "total_items": total,
        "by_pressure": pressure_counts,
        "location_id": str(loc) if loc else None,
    }

    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Food Cost Summary")
