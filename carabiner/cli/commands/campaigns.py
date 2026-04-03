"""carabiner campaigns — marketing campaign management."""

from __future__ import annotations

import uuid
from typing import Optional

import typer

from carabiner.cli.db import EXIT_DB_ERROR, EXIT_NOT_FOUND, EXIT_VALIDATION, db_call
from carabiner.cli.output import is_json_mode, print_detail, print_error, print_json, print_table

app = typer.Typer(name="campaigns", help="Marketing campaign management.", no_args_is_help=True)


def _serialize_campaign(c) -> dict:
    """Convert a WorkspaceCampaign ORM instance to a plain dict."""
    return {
        "id": str(c.id),
        "location_id": str(c.location_id),
        "campaign_name": c.campaign_name,
        "channel": c.channel,
        "stage": c.stage,
        "deliverable": c.deliverable,
        "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
        "end_date": c.end_date.isoformat() if c.end_date else None,
        "budget_cents": c.budget_cents,
        "summary": c.summary,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@app.command()
def list(
    location_id: Optional[str] = typer.Option(None, "--location-id", "-l", help="Filter by location UUID."),
    stage: Optional[str] = typer.Option(None, "--stage", help="Filter by stage (Drafting, Scheduled, Live, Done)."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """List marketing campaigns."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id) if location_id else None
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        campaigns = db_call(repositories.list_campaigns, location_id=loc)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    rows = [_serialize_campaign(c) for c in campaigns]

    if stage:
        rows = [r for r in rows if r["stage"].lower() == stage.lower()]

    if is_json_mode(json_output):
        print_json({"campaigns": rows, "count": len(rows)})
    else:
        print_table(
            rows,
            columns=["id", "campaign_name", "channel", "stage", "deliverable"],
            title="Campaigns",
        )


@app.command()
def get(
    campaign_id: str = typer.Argument(help="Campaign UUID."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Get a single campaign by ID."""
    from carabiner.db import repositories

    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {campaign_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    try:
        campaign = db_call(repositories.get_campaign, cid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if campaign is None:
        print_error(EXIT_NOT_FOUND, f"Campaign {campaign_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    data = _serialize_campaign(campaign)

    if is_json_mode(json_output):
        print_json(data)
    else:
        print_detail(data, title=f"Campaign: {data['campaign_name']}")


@app.command()
def create(
    location_id: str = typer.Option(..., "--location-id", "-l", help="Location UUID."),
    campaign_name: str = typer.Option(..., "--campaign-name", help="Campaign name."),
    channel: str = typer.Option(..., "--channel", help="Channel (Instagram, Email, TikTok, etc.)."),
    deliverable: str = typer.Option(..., "--deliverable", help="Deliverable description."),
    stage: str = typer.Option("Drafting", "--stage", help="Stage (Drafting, Scheduled, Live, Done)."),
    summary: Optional[str] = typer.Option(None, "--summary", help="Campaign summary."),
    budget_cents: Optional[int] = typer.Option(None, "--budget-cents", help="Budget in cents."),
    chat_context: Optional[str] = typer.Option(None, "--chat-context", help="A0 chat context ID."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be created without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Create a new marketing campaign."""
    from carabiner.db import repositories

    try:
        loc = uuid.UUID(location_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {location_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    data: dict = {
        "location_id": loc,
        "campaign_name": campaign_name,
        "channel": channel,
        "deliverable": deliverable,
        "stage": stage,
    }
    if summary is not None:
        data["summary"] = summary
    if budget_cents is not None:
        data["budget_cents"] = budget_cents
    if chat_context is not None:
        data["chat_context_id"] = chat_context

    if dry_run:
        payload = {k: str(v) for k, v in data.items()}
        payload["_dry_run"] = True
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Campaign")
        return

    try:
        campaign = db_call(repositories.create_campaign, data)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    result = _serialize_campaign(campaign)

    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Created Campaign")


@app.command()
def update(
    campaign_id: str = typer.Argument(help="Campaign UUID."),
    campaign_name: Optional[str] = typer.Option(None, "--campaign-name", help="Campaign name."),
    channel: Optional[str] = typer.Option(None, "--channel", help="Channel."),
    stage: Optional[str] = typer.Option(None, "--stage", help="Stage."),
    deliverable: Optional[str] = typer.Option(None, "--deliverable", help="Deliverable description."),
    summary: Optional[str] = typer.Option(None, "--summary", help="Campaign summary."),
    budget_cents: Optional[int] = typer.Option(None, "--budget-cents", help="Budget in cents."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be updated without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Update an existing campaign."""
    from carabiner.db import repositories

    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {campaign_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    data: dict = {}
    if campaign_name is not None:
        data["campaign_name"] = campaign_name
    if channel is not None:
        data["channel"] = channel
    if stage is not None:
        data["stage"] = stage
    if deliverable is not None:
        data["deliverable"] = deliverable
    if summary is not None:
        data["summary"] = summary
    if budget_cents is not None:
        data["budget_cents"] = budget_cents

    if not data:
        print_error(EXIT_VALIDATION, "No fields to update. Pass at least one --field flag.", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    if dry_run:
        payload = {"id": campaign_id, "_dry_run": True, **{k: str(v) for k, v in data.items()}}
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Update Campaign")
        return

    try:
        campaign = db_call(repositories.update_campaign, cid, data)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if campaign is None:
        print_error(EXIT_NOT_FOUND, f"Campaign {campaign_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    result = _serialize_campaign(campaign)

    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Updated Campaign")


@app.command()
def delete(
    campaign_id: str = typer.Argument(help="Campaign UUID."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be deleted without writing."),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON."),
) -> None:
    """Delete a campaign by ID."""
    from carabiner.db import repositories

    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        print_error(EXIT_VALIDATION, f"Invalid UUID: {campaign_id}", "validation")
        raise typer.Exit(EXIT_VALIDATION)

    if dry_run:
        payload = {"id": campaign_id, "_dry_run": True, "action": "delete"}
        if is_json_mode(json_output):
            print_json(payload)
        else:
            print_detail(payload, title="Dry Run — Delete Campaign")
        return

    try:
        deleted = db_call(repositories.delete_campaign, cid)
    except Exception as exc:
        print_error(EXIT_DB_ERROR, str(exc), "db_error")
        raise typer.Exit(EXIT_DB_ERROR)

    if not deleted:
        print_error(EXIT_NOT_FOUND, f"Campaign {campaign_id} not found", "not_found")
        raise typer.Exit(EXIT_NOT_FOUND)

    result = {"id": campaign_id, "deleted": True}
    if is_json_mode(json_output):
        print_json(result)
    else:
        print_detail(result, title="Deleted Campaign")
