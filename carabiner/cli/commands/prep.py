"""carabiner prep — prep task management."""

from __future__ import annotations

import uuid
from typing import Optional

import typer

from carabiner.cli.db import EXIT_DB_ERROR, EXIT_NOT_FOUND, EXIT_VALIDATION, db_call
from carabiner.cli.output import is_json_mode, print_detail, print_error, print_json, print_table

app = typer.Typer(name="prep", help="Prep task management.", no_args_is_help=True)


def _serialize_prep(p) -> dict:
    """Convert a WorkspacePrep ORM instance to a plain dict."""
    return {
        "id": str(p.id),
        "location_id": str(p.location_id),
        "service_lane": p.service_lane,
        "task": p.task,
        "station": p.station,
        "readiness": p.readiness,
        "shortage": p.shortage,
        "summary": p.summary,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@app.command()
def list(
    location_id: Optional[str] = typer.Option(None, "--location-id", "-l", help="Filter by location UUID."),
    station: Optional[str] = typer.Option(None, "--station", help="Filter by station."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """List prep tasks."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id) if location_id else None
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        tasks = db_call(repositories.list_prep, location_id=loc)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    rows = [_serialize_prep(p) for p in tasks]

    if station:
        rows = [r for r in rows if r["station"].lower() == station.lower()]

    if is_json_mode(json_output):
        print_json({"prep_tasks": rows, "count": len(rows)})
    else:
        print_table(
            rows,
            columns=["id", "task", "station", "service_lane", "readiness", "shortage"],
            title="Prep Tasks",
        )


@app.command()
def get(
    task_id: str = typer.Argument(help="Prep task UUID."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Get a single prep task by ID."""
    from carabiner.db import repositories

    try:
        tid = uuid.UUID(task_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {task_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        task = db_call(repositories.get_prep, tid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if task is None:
        print_error(EXIT_NOT_FOUND, f"Prep task {task_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    data = _serialize_prep(task)

    if is_json_mode(json_output):
        print_json(data)
    else:
        print_detail(data, title=f"Prep Task: {data['task']}")


@app.command()
def create(
    location_id: str = typer.Option(..., "--location-id", "-l", help="Location UUID."),
    task: str = typer.Option(..., "--task", help="Prep task name."),
    station: str = typer.Option(..., "--station", help="Station (grill, pantry, pastry, etc.)."),
    service_lane: str = typer.Option("Dinner", "--service-lane", help="Service lane (Brunch, Dinner, Happy Hour)."),
    readiness: str = typer.Option("Not Started", "--readiness", help="Readiness status."),
    shortage: Optional[str] = typer.Option(None, "--shortage", help="Shortage description."),
    summary: Optional[str] = typer.Option(None, "--summary", help="Task summary."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be created without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Create a new prep task."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    data: dict = {
        "location_id": loc,
        "task": task,
        "station": station,
        "service_lane": service_lane,
        "readiness": readiness,
    }
    if shortage is not None:
        data["shortage"] = shortage
    if summary is not None:
        data["summary"] = summary

    if dry_run:
        payload = {k: str(v) for k, v in data.items()}
        payload["_dry_run"] = True
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Prep Task")
        return

    try:
        prep_task = db_call(repositories.create_prep, data)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    result = _serialize_prep(prep_task)

    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Created Prep Task")


@app.command()
def update(
    task_id: str = typer.Argument(help="Prep task UUID."),
    task: Optional[str] = typer.Option(None, "--task", help="Prep task name."),
    station: Optional[str] = typer.Option(None, "--station", help="Station."),
    service_lane: Optional[str] = typer.Option(None, "--service-lane", help="Service lane."),
    readiness: Optional[str] = typer.Option(None, "--readiness", help="Readiness status."),
    shortage: Optional[str] = typer.Option(None, "--shortage", help="Shortage description (use '' to clear)."),
    summary: Optional[str] = typer.Option(None, "--summary", help="Task summary."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be updated without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Update an existing prep task."""
    from carabiner.db import repositories

    try:
        tid = uuid.UUID(task_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {task_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    data: dict = {}
    if task is not None:
        data["task"] = task
    if station is not None:
        data["station"] = station
    if service_lane is not None:
        data["service_lane"] = service_lane
    if readiness is not None:
        data["readiness"] = readiness
    if shortage is not None:
        data["shortage"] = shortage if shortage != "" else None
    if summary is not None:
        data["summary"] = summary

    if not data:
        print_error(EXIT_VALIDATION, "No fields to update. Pass at least one --field flag.", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    if dry_run:
        payload = {"id": task_id, "_dry_run": True, **{k: str(v) for k, v in data.items()}}
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Update Prep Task")
        return

    try:
        prep_task = db_call(repositories.update_prep, tid, data)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if prep_task is None:
        print_error(EXIT_NOT_FOUND, f"Prep task {task_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    result = _serialize_prep(prep_task)

    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Updated Prep Task")


@app.command()
def delete(
    task_id: str = typer.Argument(help="Prep task UUID."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be deleted without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Delete a prep task by ID."""
    from carabiner.db import repositories

    try:
        tid = uuid.UUID(task_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {task_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    if dry_run:
        payload = {"id": task_id, "_dry_run": True, "action": "delete"}
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Delete Prep Task")
        return

    try:
        deleted = db_call(repositories.delete_prep, tid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if not deleted:
        print_error(EXIT_NOT_FOUND, f"Prep task {task_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    result = {"id": task_id, "deleted": True}
    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Deleted Prep Task")
