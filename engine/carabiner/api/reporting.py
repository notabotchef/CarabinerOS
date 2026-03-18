"""Reporting API — Daily P&L, trends, budget variance."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, and_

from carabiner.db.engine import get_session
from carabiner.db.models import BudgetPeriod, DailyPL, Location
from carabiner.domain.reporting import (
    calculate_cogs,
    calculate_food_cost_pct,
    calculate_labor_pct,
    calculate_variance,
)

router = APIRouter(prefix="/api/reporting", tags=["reporting"])


# ---------------------------------------------------------------------------
# Response Schemas
# ---------------------------------------------------------------------------

class DailyPLOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    location_id: str
    location_name: str
    pl_date: date
    beginning_inventory: float
    purchases: float
    ending_inventory: float
    cogs: float
    revenue: float
    food_cost_pct: Optional[float] = None
    labor_cost: float
    labor_pct: Optional[float] = None
    notes: Optional[str] = None


class PLSummaryOut(BaseModel):
    period_start: date
    period_end: date
    location_id: Optional[str] = None
    total_revenue: float
    total_cogs: float
    avg_food_cost_pct: float
    total_labor: float
    avg_labor_pct: float
    total_purchases: float
    days: int


class TrendPointOut(BaseModel):
    date: date
    food_cost_pct: float
    labor_pct: float
    revenue: float
    cogs: float


class BudgetVarianceOut(BaseModel):
    location_id: str
    location_name: str
    period_start: date
    period_end: date
    actual_revenue: float
    actual_food_cost_pct: float
    actual_labor_pct: float
    target_revenue: float
    target_food_cost_pct: float
    target_labor_pct: float
    revenue_variance: float
    revenue_variance_pct: float
    food_cost_variance_pct: float
    labor_variance_pct: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _default_date_range() -> tuple[date, date]:
    """Default to last 30 days."""
    end = date.today()
    start = end - timedelta(days=30)
    return start, end


async def _fetch_pl_rows(
    location_id: Optional[uuid.UUID],
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Fetch daily P&L rows with location name joined."""
    async with get_session() as session:
        stmt = (
            select(DailyPL, Location.name.label("location_name"))
            .join(Location, DailyPL.location_id == Location.id)
            .where(
                and_(
                    DailyPL.pl_date >= start_date,
                    DailyPL.pl_date <= end_date,
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
                "pl_date": pl.pl_date,
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
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/pl", response_model=List[DailyPLOut])
async def get_daily_pl(
    location_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
) -> list:
    """Get daily P&L rows filtered by date range and location."""
    if not start_date or not end_date:
        start_date, end_date = _default_date_range()
    rows = await _fetch_pl_rows(location_id, start_date, end_date)
    return rows


@router.get("/pl/summary", response_model=PLSummaryOut)
async def get_pl_summary(
    location_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
) -> dict:
    """Get aggregated P&L summary for a period."""
    if not start_date or not end_date:
        start_date, end_date = _default_date_range()

    rows = await _fetch_pl_rows(location_id, start_date, end_date)
    if not rows:
        return {
            "period_start": start_date,
            "period_end": end_date,
            "location_id": str(location_id) if location_id else None,
            "total_revenue": 0,
            "total_cogs": 0,
            "avg_food_cost_pct": 0,
            "total_labor": 0,
            "avg_labor_pct": 0,
            "total_purchases": 0,
            "days": 0,
        }

    total_revenue = sum(r["revenue"] for r in rows)
    total_cogs = sum(r["cogs"] for r in rows)
    total_labor = sum(r["labor_cost"] for r in rows)
    total_purchases = sum(r["purchases"] for r in rows)
    days = len(rows)

    avg_food = (total_cogs / total_revenue * 100) if total_revenue > 0 else 0
    avg_labor = (total_labor / total_revenue * 100) if total_revenue > 0 else 0

    loc_ids = set(r["location_id"] for r in rows)

    return {
        "period_start": start_date,
        "period_end": end_date,
        "location_id": rows[0]["location_id"] if len(loc_ids) == 1 else None,
        "total_revenue": round(total_revenue, 2),
        "total_cogs": round(total_cogs, 2),
        "avg_food_cost_pct": round(avg_food, 2),
        "total_labor": round(total_labor, 2),
        "avg_labor_pct": round(avg_labor, 2),
        "total_purchases": round(total_purchases, 2),
        "days": days,
    }


@router.get("/trends", response_model=List[TrendPointOut])
async def get_trends(
    location_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
) -> list:
    """Get cost trend data points for charting."""
    if not start_date or not end_date:
        start_date, end_date = _default_date_range()

    rows = await _fetch_pl_rows(location_id, start_date, end_date)

    # If multiple locations, aggregate by date
    by_date: dict[date, dict] = {}
    for r in rows:
        d = r["pl_date"]
        if d not in by_date:
            by_date[d] = {"revenue": 0, "cogs": 0, "labor": 0}
        by_date[d]["revenue"] += r["revenue"]
        by_date[d]["cogs"] += r["cogs"]
        by_date[d]["labor"] += r["labor_cost"]

    points = []
    for d in sorted(by_date.keys()):
        agg = by_date[d]
        rev = agg["revenue"]
        fc_pct = round(agg["cogs"] / rev * 100, 2) if rev > 0 else 0
        lp = round(agg["labor"] / rev * 100, 2) if rev > 0 else 0
        points.append({
            "date": d,
            "food_cost_pct": fc_pct,
            "labor_pct": lp,
            "revenue": round(rev, 2),
            "cogs": round(agg["cogs"], 2),
        })

    return points


@router.get("/variance", response_model=List[BudgetVarianceOut])
async def get_variance(
    location_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
) -> list:
    """Get budget vs actual variance for each location."""
    if not start_date or not end_date:
        start_date, end_date = _default_date_range()

    rows = await _fetch_pl_rows(location_id, start_date, end_date)
    if not rows:
        return []

    # Group by location
    by_location: dict[str, list[dict]] = {}
    loc_names: dict[str, str] = {}
    for r in rows:
        lid = r["location_id"]
        if lid not in by_location:
            by_location[lid] = []
            loc_names[lid] = r["location_name"]
        by_location[lid].append(r)

    # Fetch budget targets
    async with get_session() as session:
        stmt = select(BudgetPeriod).where(
            and_(
                BudgetPeriod.period_start <= end_date,
                BudgetPeriod.period_end >= start_date,
            )
        )
        if location_id:
            stmt = stmt.where(BudgetPeriod.location_id == location_id)
        result = await session.execute(stmt)
        budgets = {str(b.location_id): b for b in result.scalars().all()}

    variances = []
    for lid, loc_rows in by_location.items():
        total_rev = sum(r["revenue"] for r in loc_rows)
        total_cogs = sum(r["cogs"] for r in loc_rows)
        total_labor = sum(r["labor_cost"] for r in loc_rows)

        actual_food_pct = round(total_cogs / total_rev * 100, 2) if total_rev > 0 else 0
        actual_labor_pct = round(total_labor / total_rev * 100, 2) if total_rev > 0 else 0

        budget = budgets.get(lid)
        target_rev = float(budget.target_revenue) if budget and budget.target_revenue else total_rev
        target_food = float(budget.target_food_cost_pct) if budget and budget.target_food_cost_pct else 30.0
        target_labor = float(budget.target_labor_pct) if budget and budget.target_labor_pct else 28.0

        rev_var = total_rev - target_rev
        rev_var_pct = round(rev_var / target_rev * 100, 2) if target_rev > 0 else 0

        variances.append({
            "location_id": lid,
            "location_name": loc_names[lid],
            "period_start": start_date,
            "period_end": end_date,
            "actual_revenue": round(total_rev, 2),
            "actual_food_cost_pct": actual_food_pct,
            "actual_labor_pct": actual_labor_pct,
            "target_revenue": round(target_rev, 2),
            "target_food_cost_pct": target_food,
            "target_labor_pct": target_labor,
            "revenue_variance": round(rev_var, 2),
            "revenue_variance_pct": rev_var_pct,
            "food_cost_variance_pct": round(actual_food_pct - target_food, 2),
            "labor_variance_pct": round(actual_labor_pct - target_labor, 2),
        })

    return variances
