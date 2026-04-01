"""carabiner recipes — recipe management (modernist cuisine format)."""

from __future__ import annotations

import uuid
from typing import Optional

import typer

from carabiner.cli.db import EXIT_DB_ERROR, EXIT_NOT_FOUND, EXIT_VALIDATION, db_call
from carabiner.cli.output import is_json_mode, print_detail, print_error, print_json, print_table

app = typer.Typer(name="recipes", help="Recipe management.", no_args_is_help=True)


def _serialize_recipe_summary(r) -> dict:
    """Convert a WorkspaceRecipe to a summary dict (no nested components)."""
    return {
        "id": str(r.id),
        "location_id": str(r.location_id),
        "name": r.name,
        "category": r.category,
        "status": r.status,
        "yield_quantity": float(r.yield_quantity) if r.yield_quantity else None,
        "yield_unit": r.yield_unit,
        "total_cost": float(r.total_cost) if r.total_cost else None,
        "cost_per_serving": float(r.cost_per_serving) if r.cost_per_serving else None,
        "source": r.source,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _serialize_recipe_full(r) -> dict:
    """Convert a WorkspaceRecipe with loaded components to a full dict."""
    data = _serialize_recipe_summary(r)
    data["description"] = r.description
    data["equipment"] = r.equipment
    data["notes"] = r.notes
    data["tags"] = r.tags
    data["image_url"] = r.image_url

    components = []
    for comp in getattr(r, "components", []):
        c = {
            "id": str(comp.id),
            "name": comp.name,
            "sort_order": comp.sort_order,
            "yield_quantity": float(comp.yield_quantity) if comp.yield_quantity else None,
            "yield_unit": comp.yield_unit,
            "ingredients": [],
            "steps": [],
        }
        for ing in getattr(comp, "ingredients", []):
            c["ingredients"].append({
                "id": str(ing.id),
                "name": ing.name,
                "weight_g": float(ing.weight_g),
                "percentage": float(ing.percentage) if ing.percentage else None,
                "unit_display": ing.unit_display,
                "sort_order": ing.sort_order,
                "notes": ing.notes,
            })
        for step in getattr(comp, "steps", []):
            c["steps"].append({
                "id": str(step.id),
                "step_number": step.step_number,
                "instruction": step.instruction,
                "temperature": step.temperature,
                "duration": step.duration,
                "technique": step.technique,
            })
        components.append(c)

    data["components"] = components
    return data


@app.command()
def list(
    location_id: Optional[str] = typer.Option(None, "--location-id", "-l", help="Filter by location UUID."),
    status: Optional[str] = typer.Option(None, "--status", "-s", help="Filter by status (draft, active, archived)."),
    category: Optional[str] = typer.Option(None, "--category", "-c", help="Filter by category."),
    search: Optional[str] = typer.Option(None, "--search", "-q", help="Search by name."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """List recipes."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id) if location_id else None
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        recipes = db_call(
            repositories.list_recipes,
            location_id=loc,
            status=status,
            category=category,
            search=search,
        )
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    rows = [_serialize_recipe_summary(r) for r in recipes]

    if is_json_mode(json_output):
        print_json({"recipes": rows, "count": len(rows)})
    else:
        print_table(
            rows,
            columns=["id", "name", "category", "status", "total_cost", "cost_per_serving"],
            title="Recipes",
        )


@app.command()
def get(
    recipe_id: str = typer.Argument(help="Recipe UUID."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Get a single recipe with full components, ingredients, and steps."""
    from carabiner.db import repositories

    try:
        rid = uuid.UUID(recipe_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {recipe_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        recipe = db_call(repositories.get_recipe, rid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if recipe is None:
        print_error(EXIT_NOT_FOUND, f"Recipe {recipe_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    data = _serialize_recipe_full(recipe)

    if is_json_mode(json_output):
        print_json(data)
    else:
        print_detail(
            {k: v for k, v in data.items() if k != "components"},
            title=f"Recipe: {data['name']}",
        )
        # Print components as nested tables
        for comp in data.get("components", []):
            print(f"\n  Component: {comp['name']}")
            if comp["ingredients"]:
                print_table(
                    comp["ingredients"],
                    columns=["name", "weight_g", "percentage", "unit_display"],
                    title=None,
                )
            if comp["steps"]:
                print_table(
                    comp["steps"],
                    columns=["step_number", "instruction", "temperature", "duration"],
                    title=None,
                )


@app.command()
def delete(
    recipe_id: str = typer.Argument(help="Recipe UUID."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be deleted without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Delete a recipe by ID."""
    from carabiner.db import repositories

    try:
        rid = uuid.UUID(recipe_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {recipe_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    if dry_run:
        payload = {"id": recipe_id, "_dry_run": True, "action": "delete"}
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Delete Recipe")
        return

    try:
        deleted = db_call(repositories.delete_recipe, rid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if not deleted:
        print_error(EXIT_NOT_FOUND, f"Recipe {recipe_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    result = {"id": recipe_id, "deleted": True}
    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Deleted Recipe")
