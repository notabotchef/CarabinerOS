"""Flask blueprint providing read-only workspace API routes.

Registered on the Agent Zero Flask app via the carabiner_workspace ApiHandler
so we don't modify any core Agent Zero files.

All routes are GET-only and return JSON arrays.
Optional ``?location_id=UUID`` query parameter for filtering.
"""

from __future__ import annotations

import json
import uuid
from datetime import date, timedelta
from typing import Optional

from flask import Blueprint, Response, request

from carabiner.db.engine import get_session
from carabiner.db.workspace_models import (
    WorkspaceCampaign,
    WorkspaceFoodCost,
    WorkspaceInventory,
    WorkspaceInvoice,
    WorkspaceMenu,
    WorkspaceOrder,
    WorkspacePrep,
    WorkspaceRecipe,
)
from carabiner.db.models import DailyPL, Location

from sqlalchemy import select, and_

# Pydantic schemas for serialization
from carabiner.api.schemas import (
    CampaignOut,
    FoodCostOut,
    InventoryOut,
    InvoiceOut,
    MenuOut,
    OrderOut,
    PrepOut,
    RecipeOut,
)

blueprint = Blueprint("carabiner_workspace_api", __name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_location_id() -> Optional[uuid.UUID]:
    """Extract optional location_id query parameter."""
    raw = request.args.get("location_id")
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except (ValueError, AttributeError):
        return None


def _json_response(data: list) -> Response:
    """Return a JSON response from a list of Pydantic-serialised dicts."""
    body = json.dumps(data, default=str)
    return Response(response=body, status=200, mimetype="application/json")


def _empty_response() -> Response:
    return Response(response="[]", status=200, mimetype="application/json")


async def _list_workspace_model(
    model,
    schema,
    location_id: Optional[uuid.UUID] = None,
) -> list[dict]:
    """Generic list query for workspace models."""
    async with get_session() as session:
        stmt = select(model)
        if location_id and hasattr(model, "location_id"):
            stmt = stmt.where(model.location_id == location_id)
        if hasattr(model, "created_at"):
            stmt = stmt.order_by(model.created_at)
        result = await session.execute(stmt)
        rows = result.scalars().all()
        return [schema.model_validate(r).model_dump(mode="json") for r in rows]


async def _list_daily_pl(location_id: Optional[uuid.UUID] = None) -> list[dict]:
    """Fetch daily P&L rows with location name."""
    end = date.today()
    start = end - timedelta(days=90)

    async with get_session() as session:
        stmt = (
            select(DailyPL, Location.name.label("location_name"))
            .join(Location, DailyPL.location_id == Location.id)
            .where(
                and_(
                    DailyPL.pl_date >= start,
                    DailyPL.pl_date <= end,
                )
            )
            .order_by(DailyPL.pl_date.desc())
        )
        if location_id:
            stmt = stmt.where(DailyPL.location_id == location_id)

        result = await session.execute(stmt)
        rows = []
        for pl, loc_name in result.all():
            rows.append({
                "id": str(pl.id),
                "location_id": str(pl.location_id),
                "location_name": loc_name,
                "pl_date": str(pl.pl_date),
                "beginning_inventory": float(pl.beginning_inventory),
                "purchases": float(pl.purchases),
                "ending_inventory": float(pl.ending_inventory),
                "cogs": float(pl.cogs),
                "revenue": float(pl.revenue),
                "food_cost_pct": float(pl.food_cost_pct) if pl.food_cost_pct else None,
                "labor_cost": float(pl.labor_cost),
                "labor_pct": float(pl.labor_pct) if pl.labor_pct else None,
                "notes": pl.notes,
            })
        return rows


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@blueprint.route("/api/orders", methods=["GET"])
async def list_orders():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspaceOrder, OrderOut, location_id)
        return _json_response(data)
    except Exception:
        return _empty_response()


@blueprint.route("/api/inventory", methods=["GET"])
async def list_inventory():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspaceInventory, InventoryOut, location_id)
        return _json_response(data)
    except Exception:
        return _empty_response()


@blueprint.route("/api/prep", methods=["GET"])
async def list_prep():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspacePrep, PrepOut, location_id)
        return _json_response(data)
    except Exception:
        return _empty_response()


@blueprint.route("/api/food-cost", methods=["GET"])
async def list_food_cost():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspaceFoodCost, FoodCostOut, location_id)
        return _json_response(data)
    except Exception:
        return _empty_response()


@blueprint.route("/api/menu", methods=["GET"])
async def list_menu():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspaceMenu, MenuOut, location_id)
        return _json_response(data)
    except Exception:
        return _empty_response()


@blueprint.route("/api/campaigns", methods=["GET"])
async def list_campaigns():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspaceCampaign, CampaignOut, location_id)
        return _json_response(data)
    except Exception:
        return _empty_response()


@blueprint.route("/api/recipes", methods=["GET"])
async def list_recipes():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspaceRecipe, RecipeOut, location_id)
        return _json_response(data)
    except Exception:
        return _empty_response()


@blueprint.route("/api/invoices", methods=["GET"])
async def list_invoices():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspaceInvoice, InvoiceOut, location_id)
        return _json_response(data)
    except Exception:
        return _empty_response()


@blueprint.route("/api/reporting/daily-pl", methods=["GET"])
async def list_daily_pl():
    try:
        location_id = _parse_location_id()
        data = await _list_daily_pl(location_id)
        return _json_response(data)
    except Exception:
        return _empty_response()
