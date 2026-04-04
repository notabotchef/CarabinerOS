"""A0-compatible ApiHandler factory for CarabinerOS workspace endpoints.

Generates thin handler classes that A0's /api/<path> dispatch can load.
Each handler is a GET-only, no-auth, no-csrf endpoint that returns a JSON
array from the repository layer.
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Callable, Coroutine, Sequence

from helpers.api import ApiHandler

from carabiner.db import repositories as repo
from carabiner.api.schemas import (
    CampaignOut,
    FoodCostOut,
    InventoryOut,
    InvoiceOut,
    MenuOut,
    OrderOut,
    PrepOut,
    RecipeOut,
    RecipeDetailOut,
)


def _json_response(data: list[dict]) -> dict:
    """Return raw list — ApiHandler serializes dict/list to JSON Response."""
    return data


# Registry: resource name → (list fn, get fn | None, list schema, detail schema | None)
RESOURCES: dict[str, tuple[Callable, Callable | None, type, type | None]] = {
    "orders": (repo.list_orders, repo.get_order, OrderOut, None),
    "inventory": (repo.list_inventory, repo.get_inventory, InventoryOut, None),
    "prep": (repo.list_prep, repo.get_prep, PrepOut, None),
    "food-cost": (repo.list_food_cost, repo.get_food_cost, FoodCostOut, None),
    "menu": (repo.list_menu, repo.get_menu, MenuOut, None),
    "recipes": (repo.list_recipes, repo.get_recipe, RecipeOut, RecipeDetailOut),
    "invoices": (repo.list_invoices, repo.get_invoice, InvoiceOut, None),
    "campaigns": (repo.list_campaigns, repo.get_campaign, CampaignOut, None),
}


def make_handler(resource: str) -> type:
    """Create an A0 ApiHandler class for a workspace resource.

    When the ``id`` query parameter is present the handler returns a single
    item wrapped in ``{"ok": True, "data": {...}}``.  Without ``id`` it
    returns the full list as a bare JSON array (existing behaviour).
    """

    list_fn, get_fn, schema_cls, detail_schema_cls = RESOURCES[resource]

    class WorkspaceHandler(ApiHandler):
        @classmethod
        def get_methods(cls) -> list[str]:
            return ["GET"]

        @classmethod
        def requires_auth(cls) -> bool:
            return False

        @classmethod
        def requires_csrf(cls) -> bool:
            return False

        async def process(self, input: dict, request: Any) -> Any:
            from flask import Response

            location_id = None
            raw = request.args.get("location_id")
            if raw:
                try:
                    location_id = uuid.UUID(raw)
                except ValueError:
                    pass

            # Single-item lookup when ?id=<uuid> is present
            item_id_raw = request.args.get("id")
            if item_id_raw and get_fn is not None:
                try:
                    item_id = uuid.UUID(item_id_raw)
                except ValueError:
                    return Response(
                        json.dumps({"ok": False, "error": "invalid id"}, default=str),
                        status=400,
                        content_type="application/json",
                    )
                try:
                    item = await get_fn(item_id)
                except Exception as exc:
                    return Response(
                        json.dumps({"ok": False, "error": f"db error: {exc}"}, default=str),
                        status=500,
                        content_type="application/json",
                    )
                if item is None:
                    return Response(
                        json.dumps({"ok": False, "error": "not found"}, default=str),
                        status=404,
                        content_type="application/json",
                    )
                # get_fn may return a plain dict (e.g. inventory counts)
                try:
                    if isinstance(item, dict):
                        data = item
                    else:
                        s = detail_schema_cls or schema_cls
                        data = s.model_validate(item).model_dump(mode="json")
                except Exception as exc:
                    # Fallback: serialize manually if schema validation fails
                    data = {
                        c.name: getattr(item, c.name, None)
                        for c in item.__class__.__table__.columns
                    }
                return Response(
                    json.dumps({"ok": True, "data": data}, default=str),
                    content_type="application/json",
                )

            # Some list fns accept extra kwargs (recipes has status/category/search)
            try:
                items = await list_fn(location_id)
            except TypeError:
                items = await list_fn()

            # list_fn may return plain dicts (e.g. inventory counts)
            data = [
                i if isinstance(i, dict) else schema_cls.model_validate(i).model_dump(mode="json")
                for i in items
            ]
            return Response(
                json.dumps(data, default=str),
                content_type="application/json",
            )

    WorkspaceHandler.__name__ = f"{resource.replace('-', '_').title()}Handler"
    return WorkspaceHandler


def _ok(data):
    """Wrap in {ok, data} envelope."""
    from flask import Response
    return Response(
        json.dumps({"ok": True, "data": data}, default=str),
        content_type="application/json",
    )


def make_food_cost_summary_handler() -> type:
    """Handler for /api/food-cost/summary — computed KPIs."""

    class FoodCostSummaryHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["GET"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from datetime import date
            from sqlalchemy import select, and_, func
            from carabiner.db.engine import get_session
            from carabiner.db.models import DailyFoodCost, BudgetPeriod, DailyPL
            from carabiner.api.schemas import FoodCostSummaryOut

            location_id = None
            raw = request.args.get("location_id")
            if raw:
                try: location_id = uuid.UUID(raw)
                except ValueError: pass

            today = date.today()
            summary = FoodCostSummaryOut()

            async with get_session() as session:
                # Today's food cost — fall back to most recent row if today has no data
                today_stmt = select(DailyFoodCost).where(DailyFoodCost.cost_date == today)
                if location_id:
                    today_stmt = today_stmt.where(DailyFoodCost.location_id == location_id)
                today_row = (await session.execute(today_stmt)).scalars().first()
                if not today_row:
                    fallback_stmt = select(DailyFoodCost).order_by(DailyFoodCost.cost_date.desc()).limit(1)
                    if location_id:
                        fallback_stmt = fallback_stmt.where(DailyFoodCost.location_id == location_id)
                    today_row = (await session.execute(fallback_stmt)).scalars().first()
                if today_row:
                    summary.today_food_cost_pct = float(today_row.food_cost_pct) if today_row.food_cost_pct else None
                    summary.today_sales = float(today_row.sales)
                    summary.today_purchases = float(today_row.purchases)

                # Budget period — try active period first, then most recent if none covers today
                bp_stmt = select(BudgetPeriod).where(and_(
                    BudgetPeriod.period_start <= today, BudgetPeriod.period_end >= today))
                if location_id:
                    bp_stmt = bp_stmt.where(BudgetPeriod.location_id == location_id)
                budget = (await session.execute(bp_stmt)).scalars().first()
                if not budget:
                    recent_bp_stmt = select(BudgetPeriod).order_by(BudgetPeriod.period_end.desc()).limit(1)
                    if location_id:
                        recent_bp_stmt = recent_bp_stmt.where(BudgetPeriod.location_id == location_id)
                    budget = (await session.execute(recent_bp_stmt)).scalars().first()
                if budget:
                    summary.budget_target_pct = float(budget.target_food_cost_pct) if budget.target_food_cost_pct else None
                    summary.budget_amount = float(budget.target_revenue) if budget.target_revenue else None
                    summary.period_start = budget.period_start
                    summary.period_end = budget.period_end

                    # Period aggregates — cap at period_end so past periods don't look empty
                    agg_end = min(today, budget.period_end)
                    agg_stmt = select(
                        func.sum(DailyFoodCost.purchases).label("p"),
                        func.sum(DailyFoodCost.sales).label("s"),
                        func.sum(DailyFoodCost.actual_food_cost).label("fc"),
                    ).where(and_(
                        DailyFoodCost.cost_date >= budget.period_start,
                        DailyFoodCost.cost_date <= agg_end))
                    if location_id:
                        agg_stmt = agg_stmt.where(DailyFoodCost.location_id == location_id)
                    agg = (await session.execute(agg_stmt)).one()
                    tp, ts, tfc = float(agg.p or 0), float(agg.s or 0), float(agg.fc or 0)
                    summary.period_total_purchases = tp
                    summary.period_total_sales = ts
                    summary.period_food_cost_pct = round(tfc / ts * 100, 2) if ts > 0 else None
                    if budget.target_revenue:
                        summary.budget_over_under = round(tp - float(budget.target_revenue), 2)

                # Prime cost from DailyPL — fall back to most recent row if today has no data
                pl_stmt = select(DailyPL).where(DailyPL.pl_date == today)
                if location_id:
                    pl_stmt = pl_stmt.where(DailyPL.location_id == location_id)
                pl_row = (await session.execute(pl_stmt)).scalars().first()
                if not pl_row:
                    fallback_pl_stmt = select(DailyPL).order_by(DailyPL.pl_date.desc()).limit(1)
                    if location_id:
                        fallback_pl_stmt = fallback_pl_stmt.where(DailyPL.location_id == location_id)
                    pl_row = (await session.execute(fallback_pl_stmt)).scalars().first()
                if pl_row:
                    food_pct = float(pl_row.food_cost_pct) if pl_row.food_cost_pct else 0
                    labor_pct = float(pl_row.labor_pct) if pl_row.labor_pct else 0
                    summary.prime_cost_pct = round(food_pct + labor_pct, 2)

            return _ok(summary.model_dump(mode="json"))

    return FoodCostSummaryHandler


def make_food_cost_daily_handler() -> type:
    """Handler for /api/food-cost/daily — DailyFoodCost rows."""

    class FoodCostDailyHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["GET"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from datetime import date, timedelta
            from sqlalchemy import select, and_
            from carabiner.db.engine import get_session
            from carabiner.db.models import DailyFoodCost
            from carabiner.api.schemas import DailyFoodCostOut

            location_id = None
            raw = request.args.get("location_id")
            if raw:
                try: location_id = uuid.UUID(raw)
                except ValueError: pass

            end = date.today()
            start_raw = request.args.get("start")
            end_raw = request.args.get("end")
            if end_raw:
                try: end = date.fromisoformat(end_raw)
                except ValueError: pass
            start = end - timedelta(days=30)
            if start_raw:
                try: start = date.fromisoformat(start_raw)
                except ValueError: pass

            async with get_session() as session:
                stmt = select(DailyFoodCost).where(and_(
                    DailyFoodCost.cost_date >= start,
                    DailyFoodCost.cost_date <= end,
                )).order_by(DailyFoodCost.cost_date.asc())
                if location_id:
                    stmt = stmt.where(DailyFoodCost.location_id == location_id)
                rows = (await session.execute(stmt)).scalars().all()
                data = [DailyFoodCostOut.model_validate(r).model_dump(mode="json") for r in rows]

            return _ok(data)

    return FoodCostDailyHandler


def make_food_cost_budget_handler() -> type:
    """Handler for /api/food-cost/budget — current budget period + actuals."""

    class FoodCostBudgetHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["GET"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from datetime import date
            from sqlalchemy import select, and_, func
            from carabiner.db.engine import get_session
            from carabiner.db.models import DailyFoodCost, BudgetPeriod
            from carabiner.api.schemas import BudgetOut

            location_id = None
            raw = request.args.get("location_id")
            if raw:
                try: location_id = uuid.UUID(raw)
                except ValueError: pass

            today = date.today()

            async with get_session() as session:
                bp_stmt = select(BudgetPeriod).where(and_(
                    BudgetPeriod.period_start <= today,
                    BudgetPeriod.period_end >= today))
                if location_id:
                    bp_stmt = bp_stmt.where(BudgetPeriod.location_id == location_id)
                budget = (await session.execute(bp_stmt)).scalars().first()

                # No active period — fall back to most recent past period
                if not budget:
                    recent_bp_stmt = select(BudgetPeriod).order_by(BudgetPeriod.period_end.desc()).limit(1)
                    if location_id:
                        recent_bp_stmt = recent_bp_stmt.where(BudgetPeriod.location_id == location_id)
                    budget = (await session.execute(recent_bp_stmt)).scalars().first()

                if not budget:
                    return _ok(BudgetOut().model_dump(mode="json"))

                # Cap actuals at period_end so past periods show full data
                agg_end = min(today, budget.period_end)
                agg_stmt = select(
                    func.sum(DailyFoodCost.purchases).label("tp"),
                    func.sum(DailyFoodCost.sales).label("ts"),
                    func.sum(DailyFoodCost.actual_food_cost).label("tfc"),
                ).where(and_(
                    DailyFoodCost.cost_date >= budget.period_start,
                    DailyFoodCost.cost_date <= agg_end))
                if location_id:
                    agg_stmt = agg_stmt.where(DailyFoodCost.location_id == location_id)
                agg = (await session.execute(agg_stmt)).one()

                tp = float(agg.tp or 0)
                ts = float(agg.ts or 0)
                tfc = float(agg.tfc or 0)
                days_elapsed = min((today - budget.period_start).days + 1,
                                   (budget.period_end - budget.period_start).days + 1)
                days_total = (budget.period_end - budget.period_start).days + 1
                actual_pct = round(tfc / ts * 100, 2) if ts > 0 else None
                target_rev = float(budget.target_revenue) if budget.target_revenue else 0

                out = BudgetOut(
                    id=budget.id,
                    period_start=budget.period_start,
                    period_end=budget.period_end,
                    target_food_cost_pct=float(budget.target_food_cost_pct) if budget.target_food_cost_pct else None,
                    target_labor_pct=float(budget.target_labor_pct) if budget.target_labor_pct else None,
                    target_revenue=target_rev,
                    actual_purchases=tp,
                    actual_sales=ts,
                    actual_food_cost_pct=actual_pct,
                    over_under=round(tp - target_rev, 2) if target_rev else None,
                    days_elapsed=days_elapsed,
                    days_total=days_total,
                )

            return _ok(out.model_dump(mode="json"))

    return FoodCostBudgetHandler


def make_inventory_valuation_handler() -> type:
    """Handler for /api/inventory/valuation — total inventory value KPI."""

    class InventoryValuationHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["GET"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from flask import Response

            location_id = None
            raw = request.args.get("location_id")
            if raw:
                try: location_id = uuid.UUID(raw)
                except ValueError: pass

            data = await repo.get_inventory_valuation(location_id)
            return Response(
                json.dumps(data, default=str),
                content_type="application/json",
            )

    return InventoryValuationHandler


def make_inventory_counts_handler() -> type:
    """Handler for /api/inventory/counts — list counts or fetch a single count by ?id=."""

    class InventoryCountsHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["GET"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from flask import Response

            location_id = None
            raw = request.args.get("location_id")
            if raw:
                try: location_id = uuid.UUID(raw)
                except ValueError: pass

            item_id_raw = request.args.get("id")
            if item_id_raw:
                try:
                    count_id = uuid.UUID(item_id_raw)
                except ValueError:
                    return Response(
                        json.dumps({"ok": False, "error": "invalid id"}, default=str),
                        status=400,
                        content_type="application/json",
                    )
                data = await repo.get_inventory_count(count_id)
                if data is None:
                    return Response(
                        json.dumps({"ok": False, "error": "not found"}, default=str),
                        status=404,
                        content_type="application/json",
                    )
                return _ok(data)

            rows = await repo.list_inventory_counts(location_id)
            return Response(
                json.dumps(rows, default=str),
                content_type="application/json",
            )

    return InventoryCountsHandler


def make_inventory_par_levels_handler() -> type:
    """Handler for /api/inventory/par-levels — list par levels."""

    class InventoryParLevelsHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["GET"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from flask import Response

            location_id = None
            raw = request.args.get("location_id")
            if raw:
                try: location_id = uuid.UUID(raw)
                except ValueError: pass

            rows = await repo.list_par_levels(location_id)
            return Response(
                json.dumps(rows, default=str),
                content_type="application/json",
            )

    return InventoryParLevelsHandler


def make_inventory_waste_handler() -> type:
    """Handler for /api/inventory/waste — list waste logs."""

    class InventoryWasteHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["GET"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from flask import Response

            location_id = None
            raw = request.args.get("location_id")
            if raw:
                try: location_id = uuid.UUID(raw)
                except ValueError: pass

            rows = await repo.list_waste_logs(location_id)
            return Response(
                json.dumps(rows, default=str),
                content_type="application/json",
            )

    return InventoryWasteHandler


def make_chats_handler() -> type:
    """Handler for /api/chats — chat management endpoints."""
    
    class ChatsHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["GET", "POST", "DELETE"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from flask import Response
            from carabiner.chat_store import chat_store
            import json
            
            method = request.method
            
            if method == "GET":
                # List chats - use fallback chat store for now
                try:
                    contexts = [ctx.to_summary() for ctx in chat_store.all()]
                    return Response(
                        json.dumps(contexts, default=str),
                        content_type="application/json"
                    )
                except Exception as e:
                    return Response(
                        json.dumps({"error": f"Failed to list chats: {e}"}),
                        status=500,
                        content_type="application/json"
                    )
                    
            elif method == "POST":
                # Create new chat
                try:
                    ctx = chat_store.create()
                    return Response(
                        json.dumps(ctx.to_summary(), default=str),
                        status=201,
                        content_type="application/json"
                    )
                except Exception as e:
                    return Response(
                        json.dumps({"error": f"Failed to create chat: {e}"}),
                        status=500,
                        content_type="application/json"
                    )
                    
            elif method == "DELETE":
                # Delete chat - extract ID from URL path
                chat_id = request.view_args.get('id') if hasattr(request, 'view_args') else None
                if not chat_id:
                    return Response(
                        json.dumps({"error": "Chat ID required"}),
                        status=400,
                        content_type="application/json"
                    )
                try:
                    if chat_store.remove(chat_id):
                        return Response(status=204)
                    else:
                        return Response(
                            json.dumps({"error": "Chat not found"}),
                            status=404,
                            content_type="application/json"
                        )
                except Exception as e:
                    return Response(
                        json.dumps({"error": f"Failed to delete chat: {e}"}),
                        status=500,
                        content_type="application/json"
                    )
    
    return ChatsHandler


def make_message_handler() -> type:
    """Handler for /api/message — synchronous message endpoint."""
    
    class MessageHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["POST"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from flask import Response
            import json
            
            # Simple echo response for now - can be enhanced later
            return Response(
                json.dumps({
                    "response": "CarabinerOS is running! Chat functionality coming soon.", 
                    "status": "ok"
                }),
                content_type="application/json"
            )
    
    return MessageHandler


def make_message_async_handler() -> type:
    """Handler for /api/message_async — asynchronous message endpoint."""
    
    class MessageAsyncHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["POST"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from flask import Response
            import json
            
            # Simple async response for now
            return Response(
                json.dumps({
                    "status": "processing",
                    "message": "Message received"
                }),
                content_type="application/json"
            )
    
    return MessageAsyncHandler


def make_csrf_token_handler() -> type:
    """Handler for /api/csrf_token — CSRF token endpoint."""
    
    class CsrfTokenHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["GET"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from flask import Response
            import secrets
            import json
            
            # Generate CSRF token
            token = secrets.token_urlsafe(32)
            return Response(
                json.dumps({"csrf_token": token}),
                content_type="application/json"
            )
    
    return CsrfTokenHandler


def make_prep_today_handler() -> type:
    """Handler for /api/prep/today — today's PrepList with its PrepListItems."""

    class PrepTodayHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["GET"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from datetime import date
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload
            from carabiner.db.engine import get_session
            from carabiner.db.models import PrepList

            location_id = None
            raw = request.args.get("location_id")
            if raw:
                try: location_id = uuid.UUID(raw)
                except ValueError: pass

            today = date.today()

            async with get_session() as session:
                stmt = (
                    select(PrepList)
                    .where(PrepList.prep_date == today)
                    .options(selectinload(PrepList.items))
                    .order_by(PrepList.created_at.desc())
                )
                if location_id:
                    stmt = stmt.where(PrepList.location_id == location_id)
                prep_list = (await session.execute(stmt)).scalars().first()

                if prep_list is None:
                    return _ok(None)

                items = [
                    {
                        "id": str(item.id),
                        "prep_list_id": str(item.prep_list_id),
                        "recipe_id": str(item.recipe_id),
                        "name": item.name,
                        "qty_needed": float(item.qty_needed),
                        "unit": item.unit,
                        "on_hand": float(item.on_hand),
                        "to_prep": float(item.to_prep),
                        "is_complete": item.is_complete,
                        "completed_qty": float(item.completed_qty) if item.completed_qty is not None else None,
                        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
                        "station": item.station,
                        "assigned_to": item.assigned_to,
                        "est_minutes": item.est_minutes,
                        "sort_order": item.sort_order,
                        "service_lane": item.service_lane,
                        "notes": item.notes,
                    }
                    for item in sorted(prep_list.items, key=lambda x: (x.sort_order, str(x.id)))
                ]

                data = {
                    "id": str(prep_list.id),
                    "location_id": str(prep_list.location_id),
                    "prep_date": prep_list.prep_date.isoformat(),
                    "status": prep_list.status,
                    "expected_covers": prep_list.expected_covers,
                    "generated_by": prep_list.generated_by,
                    "approved_by": prep_list.approved_by,
                    "approved_at": prep_list.approved_at.isoformat() if prep_list.approved_at else None,
                    "items": items,
                }

            return _ok(data)

    return PrepTodayHandler


def make_vendors_handler() -> type:
    """Handler for /api/vendors — distinct vendor names derived from orders."""

    class VendorsHandler(ApiHandler):
        @classmethod
        def get_methods(cls): return ["GET"]
        @classmethod
        def requires_auth(cls): return False
        @classmethod
        def requires_csrf(cls): return False

        async def process(self, input: dict, request: Any) -> Any:
            from sqlalchemy import select, distinct
            from carabiner.db.engine import get_session
            from carabiner.db.workspace_models import WorkspaceOrder

            location_id = None
            raw = request.args.get("location_id")
            if raw:
                try: location_id = uuid.UUID(raw)
                except ValueError: pass

            async with get_session() as session:
                stmt = select(distinct(WorkspaceOrder.vendor)).where(
                    WorkspaceOrder.vendor != ""
                ).order_by(WorkspaceOrder.vendor)
                if location_id:
                    stmt = stmt.where(WorkspaceOrder.location_id == location_id)
                result = await session.execute(stmt)
                names = [row[0] for row in result.all()]

            data = [{"id": name, "name": name} for name in names]
            return _ok(data)

    return VendorsHandler
