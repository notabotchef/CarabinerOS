"""Flask blueprint providing workspace API routes.

Registered on the Agent Zero Flask app via the carabiner_workspace ApiHandler
so we don't modify any core Agent Zero files.

GET routes return JSON arrays. Optional ``?location_id=UUID`` for filtering.
POST routes for invoice upload, approve, and mark-paid.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from flask import Blueprint, Response, request

from carabiner.db.engine import get_session
from carabiner.db.workspace_models import (
    EightySixLog,
    MenuItemHistory,
    InvoiceEvent,
    WorkspaceCampaign,
    WorkspaceFoodCost,
    WorkspaceInventory,
    WorkspaceInvoice,
    WorkspaceMenu,
    WorkspaceOrder,
    WorkspacePrep,
    WorkspaceRecipe,
)
from carabiner.db.models import BudgetPeriod, DailyFoodCost, DailyPL, Location, Vendor
from carabiner.db.models import BudgetPeriod, DailyFoodCost, DailyPL, Location

from sqlalchemy import select, and_, func
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

# Pydantic schemas for serialization
from carabiner.api.schemas import (
    BudgetOut,
    CampaignOut,
    DailyFoodCostOut,
    EightySixLogOut,
    FoodCostOut,
    FoodCostSummaryOut,
    InvoiceDetailOut,
    InvoiceEventOut,
    InventoryOut,
    InvoiceOut,
    MenuItemHistoryOut,
    MenuOut,
    OrderOut,
    PrepOut,
    RecipeCreate,
    RecipeDetailOut,
    RecipeOut,
    VendorOut,
    RecipeUpdate,
)
from carabiner.db import repositories as repo
from carabiner.services.demo_payload_factory import (
    authenticate_demo_account,
    build_demo_landing_payload,
    build_demo_tutorial_payload,
    build_demo_user,
    create_demo_account,
    update_demo_tutorial_progress,
)
from carabiner.api.demo_routes import demo_blueprint

logger = logging.getLogger(__name__)

blueprint = Blueprint("carabiner_workspace_api", __name__)
blueprint.register_blueprint(demo_blueprint)


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


def _parse_date(name: str, default: Optional[date] = None) -> Optional[date]:
    """Parse a date query parameter (YYYY-MM-DD)."""
    raw = request.args.get(name)
    if not raw:
        return default
    try:
        return date.fromisoformat(raw)
    except (ValueError, TypeError):
        return default


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
        logger.exception("Failed to fetch orders")
        return _empty_response()


@blueprint.route("/api/inventory", methods=["GET"])
async def list_inventory():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspaceInventory, InventoryOut, location_id)
        return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch inventory")
        return _empty_response()


@blueprint.route("/api/inventory/counts", methods=["GET"])
async def list_inventory_counts():
    try:
        from carabiner.db.repositories import list_inventory_counts as _list_counts
        location_id = _parse_location_id()
        data = await _list_counts(location_id)
        return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch inventory counts")
        return _empty_response()


@blueprint.route("/api/inventory/counts/<count_id>", methods=["GET"])
async def get_inventory_count_detail(count_id):
    try:
        from carabiner.db.repositories import get_inventory_count as _get_count
        cid = uuid.UUID(count_id)
        data = await _get_count(cid)
        if data is None:
            return Response(
                response=json.dumps({"ok": False, "error": "Count not found"}),
                status=404,
                mimetype="application/json",
            )
        body = json.dumps(data, default=str)
        return Response(response=body, status=200, mimetype="application/json")
    except (ValueError, AttributeError):
        return Response(
            response=json.dumps({"ok": False, "error": "Invalid count ID"}),
            status=400,
            mimetype="application/json",
        )
    except Exception:
        logger.exception("Failed to fetch inventory count detail")
        return Response(
            response=json.dumps({"ok": False, "error": "Internal server error"}),
            status=500,
            mimetype="application/json",
        )


@blueprint.route("/api/inventory/par-levels", methods=["GET"])
async def list_par_levels():
    try:
        from carabiner.db.repositories import list_par_levels as _list_pars
        location_id = _parse_location_id()
        data = await _list_pars(location_id)
        return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch par levels")
        return _empty_response()


@blueprint.route("/api/inventory/waste", methods=["GET"])
async def list_waste_logs():
    try:
        from carabiner.db.repositories import list_waste_logs as _list_waste
        from datetime import date, timedelta
        location_id = _parse_location_id()
        # Parse optional date range
        date_from_str = request.args.get("date_from")
        date_to_str = request.args.get("date_to")
        date_from = date.fromisoformat(date_from_str) if date_from_str else None
        date_to = date.fromisoformat(date_to_str) if date_to_str else None
        data = await _list_waste(location_id, date_from=date_from, date_to=date_to)
        return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch waste logs")
        return _empty_response()


@blueprint.route("/api/inventory/valuation", methods=["GET"])
async def get_valuation():
    try:
        from carabiner.db.repositories import get_inventory_valuation
        location_id = _parse_location_id()
        data = await get_inventory_valuation(location_id)
        body = json.dumps(data, default=str)
        return Response(response=body, status=200, mimetype="application/json")
    except Exception:
        logger.exception("Failed to fetch inventory valuation")
        return Response(
            response=json.dumps({"total_value": 0, "item_count": 0}),
            status=200,
            mimetype="application/json",
        )


@blueprint.route("/api/items", methods=["GET"])
async def list_items():
    try:
        from carabiner.db.repositories import list_items as _list_items
        from carabiner.api.schemas import ItemOut
        rows = await _list_items()
        data = [ItemOut.model_validate(r).model_dump(mode="json") for r in rows]
        return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch items")
        return _empty_response()


@blueprint.route("/api/prep", methods=["GET"])
async def list_prep():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspacePrep, PrepOut, location_id)
        return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch prep tasks")
        return _empty_response()


@blueprint.route("/api/food-cost", methods=["GET"])
async def list_food_cost():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspaceFoodCost, FoodCostOut, location_id)
        return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch food cost data")
        return _empty_response()


@blueprint.route("/api/menu", methods=["GET"])
async def list_menu():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspaceMenu, MenuOut, location_id)
        return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch menu items")
        return _empty_response()


@blueprint.route("/api/menu/86-board", methods=["GET"])
async def menu_86_board():
    """All currently-86'd items across locations."""
    try:
        location_id = _parse_location_id()
        async with get_session() as session:
            stmt = select(WorkspaceMenu).where(WorkspaceMenu.is_86 == True)  # noqa: E712
            if location_id:
                stmt = stmt.where(WorkspaceMenu.location_id == location_id)
            stmt = stmt.order_by(WorkspaceMenu.eighty_six_at.desc().nullslast())
            result = await session.execute(stmt)
            rows = result.scalars().all()

            items = []
            for row in rows:
                item = MenuOut.model_validate(row).model_dump(mode="json")
                # Attach 86-count from eighty_six_log
                count_stmt = (
                    select(func.count())
                    .select_from(EightySixLog)
                    .where(
                        and_(
                            EightySixLog.menu_item_id == row.id,
                            EightySixLog.action == "86",
                        )
                    )
                )
                count_result = await session.execute(count_stmt)
                item["eighty_six_count"] = count_result.scalar() or 0
                items.append(item)

            return _json_response(items)
    except Exception:
        logger.exception("Failed to fetch 86 board")
        return _empty_response()


@blueprint.route("/api/menu/<item_id>", methods=["GET"])
async def get_menu_item(item_id: str):
    """Single menu item detail with history."""
    try:
        parsed_id = uuid.UUID(item_id)
    except (ValueError, AttributeError):
        return Response(
            response=json.dumps({"error": "invalid_id"}),
            status=400,
            mimetype="application/json",
        )

    try:
        async with get_session() as session:
            result = await session.execute(
                select(WorkspaceMenu).where(WorkspaceMenu.id == parsed_id)
            )
            row = result.scalar_one_or_none()
            if row is None:
                return Response(
                    response=json.dumps({"error": "not_found"}),
                    status=404,
                    mimetype="application/json",
                )

            item = MenuOut.model_validate(row).model_dump(mode="json")

            # Attach recent history
            history_stmt = (
                select(MenuItemHistory)
                .where(MenuItemHistory.menu_item_id == parsed_id)
                .order_by(MenuItemHistory.changed_at.desc())
                .limit(20)
            )
            history_result = await session.execute(history_stmt)
            item["history"] = [
                MenuItemHistoryOut.model_validate(h).model_dump(mode="json")
                for h in history_result.scalars().all()
            ]

            # Attach 86 log
            log_stmt = (
                select(EightySixLog)
                .where(EightySixLog.menu_item_id == parsed_id)
                .order_by(EightySixLog.logged_at.desc())
                .limit(10)
            )
            log_result = await session.execute(log_stmt)
            item["eighty_six_log"] = [
                EightySixLogOut.model_validate(l).model_dump(mode="json")
                for l in log_result.scalars().all()
            ]

            body = json.dumps(item, default=str)
            return Response(response=body, status=200, mimetype="application/json")
    except Exception:
        logger.exception("Failed to fetch menu item %s", item_id)
        return Response(
            response=json.dumps({"error": "server_error"}),
            status=500,
            mimetype="application/json",
        )


@blueprint.route("/api/campaigns", methods=["GET"])
async def list_campaigns():
    try:
        location_id = _parse_location_id()
        stage_filter = request.args.get("stage")
        channel_filter = request.args.get("channel")

        async with get_session() as session:
            stmt = select(WorkspaceCampaign)
            if location_id:
                stmt = stmt.where(WorkspaceCampaign.location_id == location_id)
            if stage_filter:
                stmt = stmt.where(WorkspaceCampaign.stage == stage_filter)
            if channel_filter:
                stmt = stmt.where(WorkspaceCampaign.channel.ilike(f"%{channel_filter}%"))
            stmt = stmt.order_by(WorkspaceCampaign.created_at)
            result = await session.execute(stmt)
            rows = result.scalars().all()
            data = [CampaignOut.model_validate(r).model_dump(mode="json") for r in rows]
        return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch campaigns")
        return _empty_response()


@blueprint.route("/api/campaigns/<campaign_id>", methods=["GET"])
async def get_campaign(campaign_id: str):
    try:
        cid = uuid.UUID(campaign_id)
    except (ValueError, AttributeError):
        return Response(
            response=json.dumps({"error": "invalid_id"}),
            status=400,
            mimetype="application/json",
        )
    try:
        async with get_session() as session:
            result = await session.execute(
                select(WorkspaceCampaign).where(WorkspaceCampaign.id == cid)
            )
            row = result.scalar_one_or_none()
            if row is None:
                return Response(
                    response=json.dumps({"error": "not_found"}),
                    status=404,
                    mimetype="application/json",
                )
            data = CampaignOut.model_validate(row).model_dump(mode="json")
        body = json.dumps(data, default=str)
        return Response(response=body, status=200, mimetype="application/json")
    except Exception:
        logger.exception("Failed to fetch campaign %s", campaign_id)
        return Response(
            response=json.dumps({"error": "internal"}),
            status=500,
            mimetype="application/json",
        )


@blueprint.route("/api/recipes", methods=["GET"])
async def list_recipes():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspaceRecipe, RecipeOut, location_id)
        return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch recipes")
        return _empty_response()


@blueprint.route("/api/recipes/<recipe_id>", methods=["GET"])
async def get_recipe(recipe_id: str):
    try:
        uid = uuid.UUID(recipe_id)
        recipe = await repo.get_recipe(uid)
        if recipe is None:
            return Response(
                response=json.dumps({"ok": False, "error": "Recipe not found"}),
                status=404,
                mimetype="application/json",
            )
        data = RecipeDetailOut.model_validate(recipe).model_dump(mode="json")
        return Response(
            response=json.dumps({"ok": True, "data": data}, default=str),
            status=200,
            mimetype="application/json",
        )
    except (ValueError, AttributeError):
        return Response(
            response=json.dumps({"ok": False, "error": "Invalid recipe ID"}),
            status=400,
            mimetype="application/json",
        )
    except Exception:
        logger.exception("Failed to fetch recipe %s", recipe_id)
        return Response(
            response=json.dumps({"ok": False, "error": "Internal server error"}),
            status=500,
            mimetype="application/json",
        )


@blueprint.route("/api/recipes", methods=["POST"])
async def create_recipe():
    try:
        body = request.get_json(force=True)
        schema = RecipeCreate.model_validate(body)
        recipe = await repo.create_recipe(schema.model_dump())
        data = RecipeDetailOut.model_validate(recipe).model_dump(mode="json")
        return Response(
            response=json.dumps({"ok": True, "data": data}, default=str),
            status=201,
            mimetype="application/json",
        )
    except Exception:
        logger.exception("Failed to create recipe")
        return Response(
            response=json.dumps({"ok": False, "error": "Failed to create recipe"}),
            status=500,
            mimetype="application/json",
        )


@blueprint.route("/api/recipes/<recipe_id>", methods=["PUT"])
async def update_recipe(recipe_id: str):
    try:
        uid = uuid.UUID(recipe_id)
        body = request.get_json(force=True)
        schema = RecipeUpdate.model_validate(body)
        recipe = await repo.update_recipe(uid, schema.model_dump(exclude_unset=True))
        if recipe is None:
            return Response(
                response=json.dumps({"ok": False, "error": "Recipe not found"}),
                status=404,
                mimetype="application/json",
            )
        data = RecipeDetailOut.model_validate(recipe).model_dump(mode="json")
        return Response(
            response=json.dumps({"ok": True, "data": data}, default=str),
            status=200,
            mimetype="application/json",
        )
    except (ValueError, AttributeError):
        return Response(
            response=json.dumps({"ok": False, "error": "Invalid recipe ID"}),
            status=400,
            mimetype="application/json",
        )
    except Exception:
        logger.exception("Failed to update recipe %s", recipe_id)
        return Response(
            response=json.dumps({"ok": False, "error": "Failed to update recipe"}),
            status=500,
            mimetype="application/json",
        )


@blueprint.route("/api/recipes/<recipe_id>", methods=["DELETE"])
async def delete_recipe(recipe_id: str):
    try:
        uid = uuid.UUID(recipe_id)
        deleted = await repo.delete_recipe(uid)
        if not deleted:
            return Response(
                response=json.dumps({"ok": False, "error": "Recipe not found"}),
                status=404,
                mimetype="application/json",
            )
        return Response(
            response=json.dumps({"ok": True}),
            status=200,
            mimetype="application/json",
        )
    except (ValueError, AttributeError):
        return Response(
            response=json.dumps({"ok": False, "error": "Invalid recipe ID"}),
            status=400,
            mimetype="application/json",
        )
    except Exception:
        logger.exception("Failed to delete recipe %s", recipe_id)
        return Response(
            response=json.dumps({"ok": False, "error": "Failed to delete recipe"}),
            status=500,
            mimetype="application/json",
        )


@blueprint.route("/api/invoices", methods=["GET"])
async def list_invoices():
    try:
        location_id = _parse_location_id()
        data = await _list_workspace_model(WorkspaceInvoice, InvoiceOut, location_id)
        return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch invoices")
        return _empty_response()


@blueprint.route("/api/reporting/daily-pl", methods=["GET"])
async def list_daily_pl():
    try:
        location_id = _parse_location_id()
        data = await _list_daily_pl(location_id)
        return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch daily P&L report")
        return _empty_response()


# ---------------------------------------------------------------------------
# Food Cost -- Operational Endpoints (Phase 1)
# ---------------------------------------------------------------------------

def _ok_response(data: dict | list) -> Response:
    """Return a JSON response with the {ok, data} envelope."""
    body = json.dumps({"ok": True, "data": data}, default=str)
    return Response(response=body, status=200, mimetype="application/json")


def _error_response(msg: str, status: int = 400) -> Response:
    body = json.dumps({"ok": False, "error": msg})
    return Response(response=body, status=status, mimetype="application/json")


@blueprint.route("/api/food-cost/daily", methods=["GET"])
async def food_cost_daily():
    """DailyFoodCost rows for a date range.

    Params: start (YYYY-MM-DD), end (YYYY-MM-DD), location_id (UUID)
    Defaults to last 30 days.
    """
    try:
        location_id = _parse_location_id()
        end = _parse_date("end", default=date.today())
        start = _parse_date("start", default=end - timedelta(days=30))

        async with get_session() as session:
            stmt = (
                select(DailyFoodCost)
                .where(
                    and_(
                        DailyFoodCost.cost_date >= start,
                        DailyFoodCost.cost_date <= end,
                    )
                )
                .order_by(DailyFoodCost.cost_date.asc())
            )
            if location_id:
                stmt = stmt.where(DailyFoodCost.location_id == location_id)

            result = await session.execute(stmt)
            rows = result.scalars().all()
            data = [DailyFoodCostOut.model_validate(r).model_dump(mode="json") for r in rows]

        return _ok_response(data)
    except Exception:
        logger.exception("Failed to fetch daily food cost")
        return _error_response("Failed to fetch daily food cost", 500)


@blueprint.route("/api/food-cost/summary", methods=["GET"])
async def food_cost_summary():
    """Computed KPIs: today's %, period %, budget vs actual, prime cost.

    Params: location_id (UUID)
    """
    try:
        location_id = _parse_location_id()
        today = date.today()
        summary = FoodCostSummaryOut()

        async with get_session() as session:
            # --- Today's food cost ---
            today_stmt = select(DailyFoodCost).where(DailyFoodCost.cost_date == today)
            if location_id:
                today_stmt = today_stmt.where(DailyFoodCost.location_id == location_id)
            today_result = await session.execute(today_stmt)
            today_row = today_result.scalars().first()

            if today_row:
                summary.today_food_cost_pct = float(today_row.food_cost_pct) if today_row.food_cost_pct else None
                summary.today_sales = float(today_row.sales)
                summary.today_purchases = float(today_row.purchases)

            # --- Current budget period ---
            bp_stmt = (
                select(BudgetPeriod)
                .where(
                    and_(
                        BudgetPeriod.period_start <= today,
                        BudgetPeriod.period_end >= today,
                    )
                )
            )
            if location_id:
                bp_stmt = bp_stmt.where(BudgetPeriod.location_id == location_id)
            bp_result = await session.execute(bp_stmt)
            budget = bp_result.scalars().first()

            if budget:
                summary.budget_target_pct = float(budget.target_food_cost_pct) if budget.target_food_cost_pct else None
                summary.budget_amount = float(budget.target_revenue) if budget.target_revenue else None
                summary.period_start = budget.period_start
                summary.period_end = budget.period_end

                # --- Period-to-date aggregates ---
                period_stmt = select(
                    func.sum(DailyFoodCost.purchases).label("total_purchases"),
                    func.sum(DailyFoodCost.sales).label("total_sales"),
                    func.sum(DailyFoodCost.actual_food_cost).label("total_food_cost"),
                ).where(
                    and_(
                        DailyFoodCost.cost_date >= budget.period_start,
                        DailyFoodCost.cost_date <= today,
                    )
                )
                if location_id:
                    period_stmt = period_stmt.where(DailyFoodCost.location_id == location_id)
                period_result = await session.execute(period_stmt)
                agg = period_result.one()

                total_purchases = float(agg.total_purchases or 0)
                total_sales = float(agg.total_sales or 0)
                summary.period_total_purchases = total_purchases
                summary.period_total_sales = total_sales

                if total_sales > 0:
                    total_food_cost = float(agg.total_food_cost or 0)
                    summary.period_food_cost_pct = round(total_food_cost / total_sales * 100, 2)

                # Budget over/under: actual food cost vs expected
                if summary.budget_target_pct and total_sales > 0:
                    expected_cost = total_sales * (summary.budget_target_pct / 100)
                    summary.budget_over_under = round(float(agg.total_food_cost or 0) - expected_cost, 2)
            else:
                # No budget period -- use last 30 days as fallback
                summary.period_start = today - timedelta(days=30)
                summary.period_end = today

                period_stmt = select(
                    func.sum(DailyFoodCost.purchases).label("total_purchases"),
                    func.sum(DailyFoodCost.sales).label("total_sales"),
                    func.sum(DailyFoodCost.actual_food_cost).label("total_food_cost"),
                ).where(
                    and_(
                        DailyFoodCost.cost_date >= summary.period_start,
                        DailyFoodCost.cost_date <= today,
                    )
                )
                if location_id:
                    period_stmt = period_stmt.where(DailyFoodCost.location_id == location_id)
                period_result = await session.execute(period_stmt)
                agg = period_result.one()

                total_purchases = float(agg.total_purchases or 0)
                total_sales = float(agg.total_sales or 0)
                summary.period_total_purchases = total_purchases
                summary.period_total_sales = total_sales

                if total_sales > 0:
                    total_food_cost = float(agg.total_food_cost or 0)
                    summary.period_food_cost_pct = round(total_food_cost / total_sales * 100, 2)

            # --- Prime cost (food + labor from DailyPL) ---
            pl_stmt = select(DailyPL).where(DailyPL.pl_date == today)
            if location_id:
                pl_stmt = pl_stmt.where(DailyPL.location_id == location_id)
            pl_result = await session.execute(pl_stmt)
            pl_row = pl_result.scalars().first()

            if pl_row:
                food_pct = float(pl_row.food_cost_pct) if pl_row.food_cost_pct else 0
                labor_pct = float(pl_row.labor_pct) if pl_row.labor_pct else 0
                summary.prime_cost_pct = round(food_pct + labor_pct, 2)

        return _ok_response(summary.model_dump(mode="json"))
    except Exception:
        logger.exception("Failed to compute food cost summary")
        return _error_response("Failed to compute food cost summary", 500)


@blueprint.route("/api/food-cost/budget", methods=["GET"])
async def food_cost_budget():
    """Current BudgetPeriod + actual to-date.

    Params: location_id (UUID)
    """
    try:
        location_id = _parse_location_id()
        today = date.today()

        async with get_session() as session:
            bp_stmt = (
                select(BudgetPeriod)
                .where(
                    and_(
                        BudgetPeriod.period_start <= today,
                        BudgetPeriod.period_end >= today,
                    )
                )
            )
            if location_id:
                bp_stmt = bp_stmt.where(BudgetPeriod.location_id == location_id)
            bp_result = await session.execute(bp_stmt)
            budget = bp_result.scalars().first()

            if not budget:
                return _ok_response(BudgetOut().model_dump(mode="json"))

            # Aggregate actuals for the period
            agg_stmt = select(
                func.sum(DailyFoodCost.purchases).label("total_purchases"),
                func.sum(DailyFoodCost.sales).label("total_sales"),
                func.sum(DailyFoodCost.actual_food_cost).label("total_food_cost"),
            ).where(
                and_(
                    DailyFoodCost.cost_date >= budget.period_start,
                    DailyFoodCost.cost_date <= today,
                )
            )
            if location_id:
                agg_stmt = agg_stmt.where(DailyFoodCost.location_id == location_id)
            agg_result = await session.execute(agg_stmt)
            agg = agg_result.one()

            total_purchases = float(agg.total_purchases or 0)
            total_sales = float(agg.total_sales or 0)
            total_food_cost = float(agg.total_food_cost or 0)
            days_elapsed = (today - budget.period_start).days + 1
            days_total = (budget.period_end - budget.period_start).days + 1

            actual_pct = round(total_food_cost / total_sales * 100, 2) if total_sales > 0 else None
            target_pct = float(budget.target_food_cost_pct) if budget.target_food_cost_pct else None
            target_rev = float(budget.target_revenue) if budget.target_revenue else None

            over_under = None
            if target_pct and total_sales > 0:
                expected_cost = total_sales * (target_pct / 100)
                over_under = round(total_food_cost - expected_cost, 2)

            out = BudgetOut(
                id=budget.id,
                period_start=budget.period_start,
                period_end=budget.period_end,
                target_food_cost_pct=target_pct,
                target_labor_pct=float(budget.target_labor_pct) if budget.target_labor_pct else None,
                target_revenue=target_rev,
                actual_purchases=total_purchases,
                actual_sales=total_sales,
                actual_food_cost_pct=actual_pct,
                over_under=over_under,
                days_elapsed=days_elapsed,
                days_total=days_total,
            )

        return _ok_response(out.model_dump(mode="json"))
    except Exception:
        logger.exception("Failed to fetch food cost budget")
        return _error_response("Failed to fetch food cost budget", 500)


# ---------------------------------------------------------------------------
# Orders — single order detail
# ---------------------------------------------------------------------------

@blueprint.route("/api/orders/<order_id>", methods=["GET"])
async def get_order(order_id: str):
    """Return a single workspace order by ID with its line items."""
    try:
        uid = uuid.UUID(order_id)
    except (ValueError, AttributeError):
        return Response(
            response=json.dumps({"ok": False, "error": "Invalid order ID"}),
            status=400, mimetype="application/json",
        )

    try:
        async with get_session() as session:
            stmt = select(WorkspaceOrder).where(WorkspaceOrder.id == uid)
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            if row is None:
                return Response(
                    response=json.dumps({"ok": False, "error": "Order not found"}),
                    status=404, mimetype="application/json",
                )
            data = OrderOut.model_validate(row).model_dump(mode="json")
            return Response(
                response=json.dumps({"ok": True, "data": data}, default=str),
                status=200, mimetype="application/json",
            )
    except Exception:
        logger.exception("Failed to fetch order %s", order_id)
        return Response(
            response=json.dumps({"ok": False, "error": "Internal server error"}),
            status=500, mimetype="application/json",
        )


# ---------------------------------------------------------------------------
# Invoice Detail, Upload, Approve, Mark Paid
# ---------------------------------------------------------------------------

@blueprint.route("/api/invoices/<invoice_id>", methods=["GET"])
async def get_invoice_detail(invoice_id: str):
    """Full invoice detail with line items and audit events."""
    try:
        uid = uuid.UUID(invoice_id)
    except (ValueError, AttributeError):
        return Response(
            json.dumps({"ok": False, "error": "Invalid invoice ID"}),
            status=400, mimetype="application/json",
        )
    try:
        async with get_session() as session:
            stmt = (
                select(WorkspaceInvoice)
                .where(WorkspaceInvoice.id == uid)
                .options(selectinload(WorkspaceInvoice.events))
            )
            result = await session.execute(stmt)
            invoice = result.scalar_one_or_none()
            if invoice is None:
                return Response(
                    json.dumps({"ok": False, "error": "Not found"}),
                    status=404, mimetype="application/json",
                )
            data = InvoiceDetailOut.model_validate(invoice).model_dump(mode="json")
            return Response(
                json.dumps({"ok": True, "data": data}, default=str),
                status=200, mimetype="application/json",
            )
    except Exception:
        logger.exception("Failed to fetch invoice detail")
        return Response(
            json.dumps({"ok": False, "error": "Internal error"}),
            status=500, mimetype="application/json",
        )


# ---------------------------------------------------------------------------
# Orders — status transitions
# ---------------------------------------------------------------------------

@blueprint.route("/api/orders/<order_id>/submit", methods=["POST"])
async def submit_order(order_id: str):
    """Advance an order's status to 'Submitted'."""
    try:
        uid = uuid.UUID(order_id)
    except (ValueError, AttributeError):
        return Response(
            response=json.dumps({"ok": False, "error": "Invalid order ID"}),
            status=400, mimetype="application/json",
        )

    try:
        async with get_session() as session:
            stmt = select(WorkspaceOrder).where(WorkspaceOrder.id == uid)
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            if row is None:
                return Response(
                    response=json.dumps({"ok": False, "error": "Order not found"}),
                    status=404, mimetype="application/json",
                )
            row.status = "Submitted"
            await session.commit()
            data = OrderOut.model_validate(row).model_dump(mode="json")
            return Response(
                response=json.dumps({"ok": True, "data": data}, default=str),
                status=200, mimetype="application/json",
            )
    except Exception:
        logger.exception("Failed to submit order %s", order_id)
        return Response(
            response=json.dumps({"ok": False, "error": "Internal server error"}),
            status=500, mimetype="application/json",
        )


@blueprint.route("/api/invoices/upload", methods=["POST"])
async def upload_invoice():
    """Accept multipart file upload, store to /uploads/invoices/, create invoice record."""
    try:
        file = request.files.get("file")
        if not file or not file.filename:
            return Response(
                json.dumps({"ok": False, "error": "No file provided"}),
                status=400, mimetype="application/json",
            )

        # Determine upload directory
        upload_dir = os.path.join(os.getcwd(), "uploads", "invoices")
        os.makedirs(upload_dir, exist_ok=True)

        # UUID filename preserving extension
        ext = os.path.splitext(file.filename)[1].lower()
        file_id = uuid.uuid4()
        filename = f"{file_id}{ext}"
        filepath = os.path.join(upload_dir, filename)
        file.save(filepath)

        # Detect MIME type
        mime = file.content_type or "application/octet-stream"

        # Resolve location_id
        location_id_str = request.form.get("location_id")
        if location_id_str:
            loc_id = uuid.UUID(location_id_str)
        else:
            # Default to first location
            async with get_session() as session:
                from carabiner.db.workspace_models import WorkspaceLocation
                result = await session.execute(select(WorkspaceLocation).limit(1))
                loc = result.scalar_one_or_none()
                if loc is None:
                    return Response(
                        json.dumps({"ok": False, "error": "No locations configured"}),
                        status=400, mimetype="application/json",
                    )
                loc_id = loc.id

        # Create invoice record
        async with get_session() as session:
            invoice = WorkspaceInvoice(
                location_id=loc_id,
                status="Uploaded",
                source="upload",
                file_path=f"/uploads/invoices/{filename}",
                file_mime=mime,
            )
            session.add(invoice)
            await session.flush()

            # Audit event
            event = InvoiceEvent(
                invoice_id=invoice.id,
                event_type="uploaded",
                actor="user",
                detail={"filename": file.filename, "mime": mime},
            )
            session.add(event)
            await session.commit()
            await session.refresh(invoice)

            data = InvoiceOut.model_validate(invoice).model_dump(mode="json")
            return Response(
                json.dumps({"ok": True, "data": data}, default=str),
                status=201, mimetype="application/json",
            )
    except Exception:
        logger.exception("Failed to upload invoice")
        return Response(
            json.dumps({"ok": False, "error": "Upload failed"}),
            status=500, mimetype="application/json",
        )


@blueprint.route("/api/orders/<order_id>/draft", methods=["POST"])
async def draft_order(order_id: str):
    """Save an order as 'Drafting' status."""
    try:
        uid = uuid.UUID(order_id)
    except (ValueError, AttributeError):
        return Response(
            response=json.dumps({"ok": False, "error": "Invalid order ID"}),
            status=400, mimetype="application/json",
        )

    try:
        async with get_session() as session:
            stmt = select(WorkspaceOrder).where(WorkspaceOrder.id == uid)
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            if row is None:
                return Response(
                    response=json.dumps({"ok": False, "error": "Order not found"}),
                    status=404, mimetype="application/json",
                )
            row.status = "Drafting"
            await session.commit()
            data = OrderOut.model_validate(row).model_dump(mode="json")
            return Response(
                response=json.dumps({"ok": True, "data": data}, default=str),
                status=200, mimetype="application/json",
            )
    except Exception:
        logger.exception("Failed to draft order %s", order_id)
        return Response(
            response=json.dumps({"ok": False, "error": "Internal server error"}),
            status=500, mimetype="application/json",
        )


@blueprint.route("/api/invoices/<invoice_id>/approve", methods=["POST"])
async def approve_invoice(invoice_id: str):
    """Advance invoice status to Approved."""
    try:
        uid = uuid.UUID(invoice_id)
    except (ValueError, AttributeError):
        return Response(
            json.dumps({"ok": False, "error": "Invalid invoice ID"}),
            status=400, mimetype="application/json",
        )
    try:
        body = request.get_json(silent=True) or {}
        approved_by = body.get("approved_by", "user")

        async with get_session() as session:
            result = await session.execute(
                select(WorkspaceInvoice).where(WorkspaceInvoice.id == uid)
            )
            invoice = result.scalar_one_or_none()
            if invoice is None:
                return Response(
                    json.dumps({"ok": False, "error": "Not found"}),
                    status=404, mimetype="application/json",
                )

            now = datetime.now(timezone.utc)
            invoice.status = "Approved"
            invoice.approved_by = approved_by
            invoice.approved_at = now

            event = InvoiceEvent(
                invoice_id=invoice.id,
                event_type="approved",
                actor=approved_by,
                detail={"previous_status": invoice.status},
            )
            session.add(event)
            await session.commit()
            await session.refresh(invoice)

            data = InvoiceOut.model_validate(invoice).model_dump(mode="json")
            return Response(
                json.dumps({"ok": True, "data": data}, default=str),
                status=200, mimetype="application/json",
            )
    except Exception:
        logger.exception("Failed to approve invoice")
        return Response(
            json.dumps({"ok": False, "error": "Approval failed"}),
            status=500, mimetype="application/json",
        )


# ---------------------------------------------------------------------------
# Vendors — list for dropdown
# ---------------------------------------------------------------------------

@blueprint.route("/api/vendors", methods=["GET"])
async def list_vendors():
    """Return all vendors for the vendor select dropdown."""
    try:
        async with get_session() as session:
            stmt = select(Vendor).order_by(Vendor.name)
            result = await session.execute(stmt)
            rows = result.scalars().all()
            data = [VendorOut.model_validate(r).model_dump(mode="json") for r in rows]
            return _json_response(data)
    except Exception:
        logger.exception("Failed to fetch vendors")
        return _empty_response()
@blueprint.route("/api/invoices/<invoice_id>/mark-paid", methods=["POST"])
async def mark_invoice_paid(invoice_id: str):
    """Record payment on an invoice."""
    try:
        uid = uuid.UUID(invoice_id)
    except (ValueError, AttributeError):
        return Response(
            json.dumps({"ok": False, "error": "Invalid invoice ID"}),
            status=400, mimetype="application/json",
        )
    try:
        body = request.get_json(silent=True) or {}

        async with get_session() as session:
            result = await session.execute(
                select(WorkspaceInvoice).where(WorkspaceInvoice.id == uid)
            )
            invoice = result.scalar_one_or_none()
            if invoice is None:
                return Response(
                    json.dumps({"ok": False, "error": "Not found"}),
                    status=404, mimetype="application/json",
                )

            invoice.status = "Paid"

            event = InvoiceEvent(
                invoice_id=invoice.id,
                event_type="paid",
                actor=body.get("actor", "user"),
                detail={
                    "payment_method": body.get("payment_method"),
                    "payment_reference": body.get("payment_reference"),
                },
            )
            session.add(event)
            await session.commit()
            await session.refresh(invoice)

            data = InvoiceOut.model_validate(invoice).model_dump(mode="json")
            return Response(
                json.dumps({"ok": True, "data": data}, default=str),
                status=200, mimetype="application/json",
            )
    except Exception:
        logger.exception("Failed to mark invoice as paid")
        return Response(
            json.dumps({"ok": False, "error": "Payment recording failed"}),
            status=500, mimetype="application/json",
        )
