"""Add daily_pl table and seed 30 days of reporting data.

Revision ID: 003
Revises: 002
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal
import random

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create daily_pl table
    op.create_table(
        "daily_pl",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("pl_date", sa.Date, nullable=False),
        sa.Column("beginning_inventory", sa.Numeric(12, 2), server_default="0"),
        sa.Column("purchases", sa.Numeric(12, 2), server_default="0"),
        sa.Column("ending_inventory", sa.Numeric(12, 2), server_default="0"),
        sa.Column("cogs", sa.Numeric(12, 2), server_default="0"),
        sa.Column("revenue", sa.Numeric(12, 2), server_default="0"),
        sa.Column("food_cost_pct", sa.Numeric(6, 2), nullable=True),
        sa.Column("labor_cost", sa.Numeric(12, 2), server_default="0"),
        sa.Column("labor_pct", sa.Numeric(6, 2), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("location_id", "pl_date", name="uq_daily_pl_loc_date"),
    )
    op.create_index("ix_daily_pl_location_date", "daily_pl", ["location_id", "pl_date"])

    # Seed data: 30 days for 3 locations
    # First get workspace location IDs from the DB
    conn = op.get_bind()
    locations = conn.execute(
        sa.text("SELECT id, slug FROM workspace_locations ORDER BY name")
    ).fetchall()

    if not locations:
        return

    # Also ensure matching rows exist in the 'locations' table for FK
    # The daily_pl FK references locations.id, so we need those IDs.
    # Check if locations table has rows
    loc_rows = conn.execute(sa.text("SELECT id, code FROM locations")).fetchall()

    # Map workspace location slugs to location IDs
    # If locations table is empty, create entries
    location_map = {}
    ws_loc_data = {
        "river-north": {"name": "River North", "code": "RN", "tz": "America/Chicago"},
        "west-loop": {"name": "West Loop", "code": "WL", "tz": "America/Chicago"},
        "fulton-market": {"name": "Fulton Market", "code": "FM", "tz": "America/Chicago"},
    }

    existing_codes = {row[1]: row[0] for row in loc_rows}

    for ws_loc in locations:
        ws_id = ws_loc[0]
        slug = ws_loc[1]
        loc_info = ws_loc_data.get(slug)
        if not loc_info:
            continue

        if loc_info["code"] in existing_codes:
            location_map[slug] = existing_codes[loc_info["code"]]
        else:
            new_id = uuid.uuid4()
            conn.execute(
                sa.text(
                    "INSERT INTO locations (id, name, code, timezone, created_at, updated_at) "
                    "VALUES (:id, :name, :code, :tz, now(), now())"
                ),
                {"id": new_id, "name": loc_info["name"], "code": loc_info["code"], "tz": loc_info["tz"]},
            )
            location_map[slug] = new_id

    # Seed 30 days of daily P&L data
    today = date(2026, 3, 18)
    random.seed(42)  # Deterministic seed data

    # Location-specific baselines
    baselines = {
        "river-north": {
            "base_revenue": 12000, "base_inv": 8500, "base_purchases": 4200,
            "base_labor": 3200, "revenue_var": 2000, "inv_var": 500,
        },
        "west-loop": {
            "base_revenue": 9500, "base_inv": 6800, "base_purchases": 3400,
            "base_labor": 2600, "revenue_var": 1500, "inv_var": 400,
        },
        "fulton-market": {
            "base_revenue": 14000, "base_inv": 10200, "base_purchases": 5100,
            "base_labor": 3800, "revenue_var": 2500, "inv_var": 600,
        },
    }

    for slug, loc_id in location_map.items():
        bl = baselines.get(slug)
        if not bl:
            continue

        prev_ending_inv = Decimal(str(bl["base_inv"]))

        for day_offset in range(30, 0, -1):
            pl_date = today - timedelta(days=day_offset)
            dow = pl_date.weekday()

            # Weekend bump
            weekend_mult = 1.35 if dow in (4, 5) else (1.15 if dow == 6 else 1.0)

            revenue = Decimal(str(round(
                bl["base_revenue"] * weekend_mult + random.uniform(-bl["revenue_var"], bl["revenue_var"]), 2
            )))
            beginning_inv = prev_ending_inv
            purchases = Decimal(str(round(
                bl["base_purchases"] + random.uniform(-bl["inv_var"], bl["inv_var"]), 2
            )))
            # Ending inventory is beginning + purchases - usage (usage ~ 85-95% of purchases + some inv drawdown)
            usage_rate = random.uniform(0.88, 0.96)
            ending_inv = Decimal(str(round(
                float(beginning_inv) + float(purchases) - float(purchases) * usage_rate - random.uniform(100, 400), 2
            )))
            ending_inv = max(ending_inv, Decimal("2000"))

            cogs = beginning_inv + purchases - ending_inv
            food_cost_pct = (cogs / revenue * 100).quantize(Decimal("0.01")) if revenue > 0 else Decimal("0")

            labor = Decimal(str(round(
                bl["base_labor"] * weekend_mult + random.uniform(-300, 300), 2
            )))
            labor_pct = (labor / revenue * 100).quantize(Decimal("0.01")) if revenue > 0 else Decimal("0")

            notes = None
            if food_cost_pct > Decimal("34"):
                notes = "Food cost above target"
            elif dow == 0:
                notes = "Monday — typically slower"

            conn.execute(
                sa.text(
                    "INSERT INTO daily_pl "
                    "(id, location_id, pl_date, beginning_inventory, purchases, ending_inventory, "
                    "cogs, revenue, food_cost_pct, labor_cost, labor_pct, notes, created_at, updated_at) "
                    "VALUES (:id, :loc, :dt, :bi, :pur, :ei, :cogs, :rev, :fcp, :lab, :lp, :notes, now(), now())"
                ),
                {
                    "id": uuid.uuid4(), "loc": loc_id, "dt": pl_date,
                    "bi": beginning_inv, "pur": purchases, "ei": ending_inv,
                    "cogs": cogs, "rev": revenue, "fcp": food_cost_pct,
                    "lab": labor, "lp": labor_pct, "notes": notes,
                },
            )

            prev_ending_inv = ending_inv

    # Seed budget targets for each location (current month)
    month_start = date(2026, 3, 1)
    month_end = date(2026, 3, 31)

    budget_targets = {
        "river-north": {"revenue": 360000, "food_pct": 30.0, "labor_pct": 28.0},
        "west-loop": {"revenue": 285000, "food_pct": 31.0, "labor_pct": 29.0},
        "fulton-market": {"revenue": 420000, "food_pct": 29.0, "labor_pct": 27.0},
    }

    for slug, loc_id in location_map.items():
        bt = budget_targets.get(slug)
        if not bt:
            continue

        # Check if budget already exists
        existing = conn.execute(
            sa.text(
                "SELECT id FROM budget_periods WHERE location_id = :loc AND period_start = :ps"
            ),
            {"loc": loc_id, "ps": month_start},
        ).fetchone()

        if not existing:
            conn.execute(
                sa.text(
                    "INSERT INTO budget_periods "
                    "(id, location_id, period_start, period_end, target_food_cost_pct, "
                    "target_labor_pct, target_revenue, created_at, updated_at) "
                    "VALUES (:id, :loc, :ps, :pe, :fcp, :lp, :rev, now(), now())"
                ),
                {
                    "id": uuid.uuid4(), "loc": loc_id, "ps": month_start, "pe": month_end,
                    "fcp": bt["food_pct"], "lp": bt["labor_pct"], "rev": bt["revenue"],
                },
            )


def downgrade() -> None:
    op.drop_index("ix_daily_pl_location_date", table_name="daily_pl")
    op.drop_table("daily_pl")
