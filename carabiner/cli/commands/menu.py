"""carabiner menu — menu item management and engineering."""

from __future__ import annotations

import uuid
from typing import Optional

import typer

from carabiner.cli.db import EXIT_DB_ERROR, EXIT_NOT_FOUND, EXIT_VALIDATION, db_call
from carabiner.cli.output import is_json_mode, print_detail, print_error, print_json, print_table

app = typer.Typer(name="menu", help="Menu item management.", no_args_is_help=True)


def _serialize_menu(m) -> dict:
    """Convert a WorkspaceMenu ORM instance to a plain dict."""
    return {
        "id": str(m.id),
        "location_id": str(m.location_id),
        "item_name": m.item_name,
        "category": m.category,
        "performance": m.performance,
        "margin_pct": m.margin_pct,
        "recommendation": m.recommendation,
        "price": float(m.price) if m.price else None,
        "food_cost": float(m.food_cost) if m.food_cost else None,
        "contribution_margin": float(m.contribution_margin) if m.contribution_margin else None,
        "food_cost_pct": float(m.food_cost_pct) if m.food_cost_pct else None,
        "quantity_sold": m.quantity_sold,
        "menu_mix_pct": float(m.menu_mix_pct) if m.menu_mix_pct else None,
        "is_86": m.is_86,
        "recipe_id": str(m.recipe_id) if m.recipe_id else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


@app.command()
def list(
    location_id: Optional[str] = typer.Option(None, "--location-id", "-l", help="Filter by location UUID."),
    category: Optional[str] = typer.Option(None, "--category", "-c", help="Filter by category."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """List menu items."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id) if location_id else None
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        items = db_call(repositories.list_menu, location_id=loc)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    rows = [_serialize_menu(m) for m in items]

    if category:
        rows = [r for r in rows if r["category"].lower() == category.lower()]

    if is_json_mode(json_output):
        print_json({"menu_items": rows, "count": len(rows)})
    else:
        print_table(
            rows,
            columns=["id", "item_name", "category", "price", "food_cost_pct", "performance", "is_86"],
            title="Menu Items",
        )


@app.command()
def get(
    item_id: str = typer.Argument(help="Menu item UUID."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Get a single menu item by ID."""
    from carabiner.db import repositories

    try:
        mid = uuid.UUID(item_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {item_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        item = db_call(repositories.get_menu, mid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if item is None:
        print_error(EXIT_NOT_FOUND, f"Menu item {item_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    data = _serialize_menu(item)

    if is_json_mode(json_output):
        print_json(data)
    else:
        print_detail(data, title=f"Menu Item: {data['item_name']}")


@app.command()
def create(
    location_id: str = typer.Option(..., "--location-id", "-l", help="Location UUID."),
    item_name: str = typer.Option(..., "--item-name", help="Menu item name."),
    category: str = typer.Option(..., "--category", help="Category (Starters, Mains, Desserts, etc.)."),
    performance: str = typer.Option("New", "--performance", help="Performance class (Star, Puzzle, Plowhorse, Dog, New)."),
    margin_pct: str = typer.Option("0%", "--margin-pct", help="Margin percentage."),
    recommendation: str = typer.Option("Monitor", "--recommendation", help="Recommendation."),
    price: Optional[str] = typer.Option(None, "--price", help="Menu price."),
    food_cost: Optional[str] = typer.Option(None, "--food-cost", help="Food cost."),
    recipe_id: Optional[str] = typer.Option(None, "--recipe-id", help="Linked recipe UUID."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be created without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Create a new menu item."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    data: dict = {
        "location_id": loc,
        "item_name": item_name,
        "category": category,
        "performance": performance,
        "margin_pct": margin_pct,
        "recommendation": recommendation,
    }
    if price is not None:
        data["price"] = float(price.replace("$", "").replace(",", ""))
    if food_cost is not None:
        data["food_cost"] = float(food_cost.replace("$", "").replace(",", ""))
    if recipe_id is not None:
        try:
            data["recipe_id"] = uuid.UUID(recipe_id)
        except ValueError:
            print_error(EXIT_VALIDATION, f"Invalid recipe UUID: {recipe_id}", "validation")
            raise typer.Exit(EXIT_VALIDATION)

    if dry_run:
        payload = {k: str(v) for k, v in data.items()}
        payload["_dry_run"] = True
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Menu Item")
        return

    try:
        item = db_call(repositories.create_menu, data)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    result = _serialize_menu(item)

    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Created Menu Item")


@app.command()
def update(
    item_id: str = typer.Argument(help="Menu item UUID."),
    item_name: Optional[str] = typer.Option(None, "--item-name", help="Menu item name."),
    category: Optional[str] = typer.Option(None, "--category", help="Category."),
    performance: Optional[str] = typer.Option(None, "--performance", help="Performance class."),
    margin_pct: Optional[str] = typer.Option(None, "--margin-pct", help="Margin percentage."),
    recommendation: Optional[str] = typer.Option(None, "--recommendation", help="Recommendation."),
    price: Optional[str] = typer.Option(None, "--price", help="Menu price."),
    food_cost: Optional[str] = typer.Option(None, "--food-cost", help="Food cost."),
    food_cost_pct: Optional[str] = typer.Option(None, "--food-cost-pct", help="Food cost percentage."),
    is_86: Optional[bool] = typer.Option(None, "--is-86/--no-86", help="Mark item as 86'd."),
    recipe_id: Optional[str] = typer.Option(None, "--recipe-id", help="Linked recipe UUID."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be updated without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Update an existing menu item."""
    from carabiner.db import repositories

    try:
        mid = uuid.UUID(item_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {item_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    data: dict = {}
    if item_name is not None:
        data["item_name"] = item_name
    if category is not None:
        data["category"] = category
    if performance is not None:
        data["performance"] = performance
    if margin_pct is not None:
        data["margin_pct"] = margin_pct
    if recommendation is not None:
        data["recommendation"] = recommendation
    if price is not None:
        data["price"] = float(price.replace("$", "").replace(",", ""))
    if food_cost is not None:
        data["food_cost"] = float(food_cost.replace("$", "").replace(",", ""))
    if food_cost_pct is not None:
        data["food_cost_pct"] = float(food_cost_pct.replace("%", ""))
    if is_86 is not None:
        data["is_86"] = is_86
    if recipe_id is not None:
        try:
            data["recipe_id"] = uuid.UUID(recipe_id)
        except ValueError:
            print_error(EXIT_VALIDATION, f"Invalid recipe UUID: {recipe_id}", "validation")
            raise typer.Exit(EXIT_VALIDATION)

    if not data:
        print_error(EXIT_VALIDATION, "No fields to update. Pass at least one --field flag.", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    if dry_run:
        payload = {"id": item_id, "_dry_run": True, **{k: str(v) for k, v in data.items()}}
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Update Menu Item")
        return

    try:
        item = db_call(repositories.update_menu, mid, data)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if item is None:
        print_error(EXIT_NOT_FOUND, f"Menu item {item_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    result = _serialize_menu(item)

    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Updated Menu Item")


@app.command()
def delete(
    item_id: str = typer.Argument(help="Menu item UUID."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be deleted without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Delete a menu item by ID."""
    from carabiner.db import repositories

    try:
        mid = uuid.UUID(item_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {item_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    if dry_run:
        payload = {"id": item_id, "_dry_run": True, "action": "delete"}
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Delete Menu Item")
        return

    try:
        deleted = db_call(repositories.delete_menu, mid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if not deleted:
        print_error(EXIT_NOT_FOUND, f"Menu item {item_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    result = {"id": item_id, "deleted": True}
    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Deleted Menu Item")
