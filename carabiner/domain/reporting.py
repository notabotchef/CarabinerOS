"""P&L calculation engine and reporting logic.

Provides functions to:
- Calculate COGS (beginning inventory + purchases - ending inventory)
- Compute food cost %
- Generate budget vs actual variance
- Aggregate period summaries
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Sequence


TWO_PLACES = Decimal("0.01")
PCT_PLACES = Decimal("0.01")


@dataclass(frozen=True)
class DailyPLRow:
    """Single day's P&L for a location."""
    date: date
    location_id: str
    location_name: str
    beginning_inventory: Decimal
    purchases: Decimal
    ending_inventory: Decimal
    cogs: Decimal
    revenue: Decimal
    food_cost_pct: Decimal
    labor_cost: Decimal
    labor_pct: Decimal
    notes: Optional[str] = None


@dataclass(frozen=True)
class PLSummary:
    """Aggregated P&L over a date range."""
    period_start: date
    period_end: date
    location_id: Optional[str]
    total_revenue: Decimal
    total_cogs: Decimal
    avg_food_cost_pct: Decimal
    total_labor: Decimal
    avg_labor_pct: Decimal
    total_purchases: Decimal
    days: int


@dataclass(frozen=True)
class BudgetVariance:
    """Budget vs actual comparison."""
    location_id: str
    location_name: str
    period_start: date
    period_end: date
    # Actuals
    actual_revenue: Decimal
    actual_food_cost_pct: Decimal
    actual_labor_pct: Decimal
    # Targets
    target_revenue: Decimal
    target_food_cost_pct: Decimal
    target_labor_pct: Decimal
    # Variance
    revenue_variance: Decimal
    revenue_variance_pct: Decimal
    food_cost_variance_pct: Decimal
    labor_variance_pct: Decimal


@dataclass(frozen=True)
class TrendPoint:
    """Single point in a cost trend series."""
    date: date
    food_cost_pct: Decimal
    labor_pct: Decimal
    revenue: Decimal
    cogs: Decimal


def calculate_cogs(
    beginning_inventory: Decimal,
    purchases: Decimal,
    ending_inventory: Decimal,
) -> Decimal:
    """COGS = Beginning Inventory + Purchases - Ending Inventory."""
    return (beginning_inventory + purchases - ending_inventory).quantize(TWO_PLACES)


def calculate_food_cost_pct(cogs: Decimal, revenue: Decimal) -> Decimal:
    """Food cost % = COGS / Revenue * 100. Returns 0 if no revenue."""
    if revenue == 0:
        return Decimal("0.00")
    return ((cogs / revenue) * 100).quantize(PCT_PLACES, rounding=ROUND_HALF_UP)


def calculate_labor_pct(labor_cost: Decimal, revenue: Decimal) -> Decimal:
    """Labor % = Labor Cost / Revenue * 100. Returns 0 if no revenue."""
    if revenue == 0:
        return Decimal("0.00")
    return ((labor_cost / revenue) * 100).quantize(PCT_PLACES, rounding=ROUND_HALF_UP)


def summarize_period(rows: Sequence[DailyPLRow]) -> Optional[PLSummary]:
    """Aggregate daily P&L rows into a period summary."""
    if not rows:
        return None

    total_revenue = sum((r.revenue for r in rows), Decimal("0"))
    total_cogs = sum((r.cogs for r in rows), Decimal("0"))
    total_labor = sum((r.labor_cost for r in rows), Decimal("0"))
    total_purchases = sum((r.purchases for r in rows), Decimal("0"))

    avg_food_pct = calculate_food_cost_pct(total_cogs, total_revenue)
    avg_labor_pct = calculate_labor_pct(total_labor, total_revenue)

    dates = [r.date for r in rows]

    return PLSummary(
        period_start=min(dates),
        period_end=max(dates),
        location_id=rows[0].location_id if len(set(r.location_id for r in rows)) == 1 else None,
        total_revenue=total_revenue.quantize(TWO_PLACES),
        total_cogs=total_cogs.quantize(TWO_PLACES),
        avg_food_cost_pct=avg_food_pct,
        total_labor=total_labor.quantize(TWO_PLACES),
        avg_labor_pct=avg_labor_pct,
        total_purchases=total_purchases.quantize(TWO_PLACES),
        days=len(rows),
    )


def calculate_variance(
    actual_revenue: Decimal,
    actual_food_cost_pct: Decimal,
    actual_labor_pct: Decimal,
    target_revenue: Decimal,
    target_food_cost_pct: Decimal,
    target_labor_pct: Decimal,
    location_id: str,
    location_name: str,
    period_start: date,
    period_end: date,
) -> BudgetVariance:
    """Compute budget vs actual variance."""
    rev_var = actual_revenue - target_revenue
    rev_var_pct = (
        ((rev_var / target_revenue) * 100).quantize(PCT_PLACES)
        if target_revenue != 0
        else Decimal("0.00")
    )
    food_var = actual_food_cost_pct - target_food_cost_pct
    labor_var = actual_labor_pct - target_labor_pct

    return BudgetVariance(
        location_id=location_id,
        location_name=location_name,
        period_start=period_start,
        period_end=period_end,
        actual_revenue=actual_revenue.quantize(TWO_PLACES),
        actual_food_cost_pct=actual_food_cost_pct,
        actual_labor_pct=actual_labor_pct,
        target_revenue=target_revenue.quantize(TWO_PLACES),
        target_food_cost_pct=target_food_cost_pct,
        target_labor_pct=target_labor_pct,
        revenue_variance=rev_var.quantize(TWO_PLACES),
        revenue_variance_pct=rev_var_pct,
        food_cost_variance_pct=food_var.quantize(PCT_PLACES),
        labor_variance_pct=labor_var.quantize(PCT_PLACES),
    )
