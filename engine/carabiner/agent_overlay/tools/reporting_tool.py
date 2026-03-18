"""Reporting & P&L tool — food cost, labor %, budget variance."""

from __future__ import annotations

import json
from datetime import date, timedelta
from decimal import Decimal
from python.helpers.tool import Response, Tool


class ReportingTool(Tool):
    async def execute(self, **kwargs) -> Response:
        try:
            return await self._run()
        except Exception as e:
            return Response(message=f"Error accessing reporting data: {e}", break_loop=False)

    async def _run(self) -> Response:
        from carabiner.db.engine import get_session
        from carabiner.db.models import DailyPL, BudgetPeriod, Location
        from sqlalchemy import select, and_

        method = self.args.get("method", "summary")
        location_id = self.args.get("location_id")
        period = self.args.get("period", "week")  # week, month, custom

        # Calculate date range
        end_date = date.today()
        if period == "week":
            start_date = end_date - timedelta(days=7)
        elif period == "month":
            start_date = end_date - timedelta(days=30)
        else:
            start_date = end_date - timedelta(days=7)

        if method == "summary":
            async with get_session() as session:
                stmt = (
                    select(DailyPL, Location.name.label("loc_name"))
                    .join(Location, DailyPL.location_id == Location.id)
                    .where(and_(
                        DailyPL.pl_date >= start_date,
                        DailyPL.pl_date <= end_date,
                    ))
                    .order_by(DailyPL.pl_date)
                )
                if location_id:
                    stmt = stmt.where(DailyPL.location_id == location_id)

                result = await session.execute(stmt)
                rows = result.all()

            if not rows:
                return Response(message="No P&L data found for the requested period.", break_loop=False)

            total_rev = sum(float(r[0].revenue) for r in rows)
            total_cogs = sum(float(r[0].cogs) for r in rows)
            total_labor = sum(float(r[0].labor_cost) for r in rows)
            total_purchases = sum(float(r[0].purchases) for r in rows)

            food_pct = round(total_cogs / total_rev * 100, 1) if total_rev > 0 else 0
            labor_pct = round(total_labor / total_rev * 100, 1) if total_rev > 0 else 0

            summary = {
                "period": f"{start_date} to {end_date}",
                "days": len(set(r[0].pl_date for r in rows)),
                "total_revenue": f"${total_rev:,.2f}",
                "total_cogs": f"${total_cogs:,.2f}",
                "food_cost_pct": f"{food_pct}%",
                "total_labor": f"${total_labor:,.2f}",
                "labor_pct": f"{labor_pct}%",
                "total_purchases": f"${total_purchases:,.2f}",
                "locations": list(set(r[1] for r in rows)),
            }

            return Response(message=json.dumps(summary, indent=2), break_loop=False)

        if method == "food_cost":
            async with get_session() as session:
                stmt = (
                    select(DailyPL)
                    .where(and_(
                        DailyPL.pl_date >= start_date,
                        DailyPL.pl_date <= end_date,
                    ))
                    .order_by(DailyPL.pl_date)
                )
                if location_id:
                    stmt = stmt.where(DailyPL.location_id == location_id)

                result = await session.execute(stmt)
                rows = result.scalars().all()

            if not rows:
                return Response(message="No food cost data for the requested period.", break_loop=False)

            total_rev = sum(float(r.revenue) for r in rows)
            total_cogs = sum(float(r.cogs) for r in rows)
            food_pct = round(total_cogs / total_rev * 100, 1) if total_rev > 0 else 0

            daily = [
                {"date": str(r.pl_date), "food_cost_pct": float(r.food_cost_pct) if r.food_cost_pct else 0}
                for r in rows
            ]

            result_data = {
                "period": f"{start_date} to {end_date}",
                "overall_food_cost_pct": f"{food_pct}%",
                "total_cogs": f"${total_cogs:,.2f}",
                "total_revenue": f"${total_rev:,.2f}",
                "daily_trend": daily,
            }

            return Response(message=json.dumps(result_data, indent=2), break_loop=False)

        if method == "variance":
            async with get_session() as session:
                # Get actuals
                stmt = (
                    select(DailyPL, Location.name.label("loc_name"))
                    .join(Location, DailyPL.location_id == Location.id)
                    .where(and_(
                        DailyPL.pl_date >= start_date,
                        DailyPL.pl_date <= end_date,
                    ))
                )
                if location_id:
                    stmt = stmt.where(DailyPL.location_id == location_id)

                result = await session.execute(stmt)
                rows = result.all()

                # Get budgets
                budget_stmt = select(BudgetPeriod).where(and_(
                    BudgetPeriod.period_start <= end_date,
                    BudgetPeriod.period_end >= start_date,
                ))
                budget_result = await session.execute(budget_stmt)
                budgets = {str(b.location_id): b for b in budget_result.scalars().all()}

            if not rows:
                return Response(message="No data for variance analysis.", break_loop=False)

            # Group by location
            by_loc: dict = {}
            for pl, loc_name in rows:
                lid = str(pl.location_id)
                if lid not in by_loc:
                    by_loc[lid] = {"name": loc_name, "rows": []}
                by_loc[lid]["rows"].append(pl)

            variances = []
            for lid, data in by_loc.items():
                total_rev = sum(float(r.revenue) for r in data["rows"])
                total_cogs = sum(float(r.cogs) for r in data["rows"])
                total_labor = sum(float(r.labor_cost) for r in data["rows"])

                food_pct = round(total_cogs / total_rev * 100, 1) if total_rev > 0 else 0
                labor_pct = round(total_labor / total_rev * 100, 1) if total_rev > 0 else 0

                budget = budgets.get(lid)
                target_food = float(budget.target_food_cost_pct) if budget and budget.target_food_cost_pct else 30.0
                target_labor = float(budget.target_labor_pct) if budget and budget.target_labor_pct else 28.0

                variances.append({
                    "location": data["name"],
                    "actual_food_cost_pct": f"{food_pct}%",
                    "target_food_cost_pct": f"{target_food}%",
                    "food_cost_variance": f"{round(food_pct - target_food, 1):+}%",
                    "actual_labor_pct": f"{labor_pct}%",
                    "target_labor_pct": f"{target_labor}%",
                    "labor_variance": f"{round(labor_pct - target_labor, 1):+}%",
                })

            return Response(message=json.dumps(variances, indent=2), break_loop=False)

        return Response(
            message=f"Unknown method: {method}. Use summary, food_cost, or variance.",
            break_loop=False,
        )
