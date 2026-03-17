"""Initial schema — all 24 restaurant management tables.

Revision ID: 001
Revises: None
Create Date: 2026-03-17
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Core ---
    op.create_table(
        "locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(50), unique=True, nullable=False),
        sa.Column("address", sa.String(500)),
        sa.Column("timezone", sa.String(50), server_default="America/Chicago"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "gl_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(20), unique=True, nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "vendors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("contact_email", sa.String(300)),
        sa.Column("contact_phone", sa.String(50)),
        sa.Column("payment_terms", sa.String(100)),
        sa.Column("connector_id", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "units_of_measure",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), unique=True, nullable=False),
        sa.Column("abbreviation", sa.String(10), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("default_uom_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("units_of_measure.id")),
        sa.Column("gl_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gl_accounts.id")),
        sa.Column("last_known_price", sa.Numeric(12, 4)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Invoices ---
    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("invoice_number", sa.String(100)),
        sa.Column("invoice_date", sa.Date, nullable=False),
        sa.Column("due_date", sa.Date),
        sa.Column("subtotal", sa.Numeric(12, 2), server_default="0"),
        sa.Column("tax", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total", sa.Numeric(12, 2), server_default="0"),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_invoices_location_date", "invoices", ["location_id", "invoice_date"])

    op.create_table(
        "invoice_line_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("items.id")),
        sa.Column("description", sa.String(500)),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 4), nullable=False),
        sa.Column("total", sa.Numeric(12, 2), nullable=False),
        sa.Column("gl_account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gl_accounts.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Inventory ---
    op.create_table(
        "inventory_counts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("count_date", sa.Date, nullable=False),
        sa.Column("count_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="in_progress"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_inventory_counts_location_date", "inventory_counts", ["location_id", "count_date"])

    op.create_table(
        "inventory_count_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("count_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("inventory_counts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("items.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("unit_cost", sa.Numeric(12, 4), nullable=False),
        sa.Column("storage_area", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "par_levels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("items.id"), nullable=False),
        sa.Column("min_quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("day_of_week", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("location_id", "item_id", "day_of_week", name="uq_par_level_loc_item_day"),
    )

    op.create_table(
        "waste_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("items.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column("waste_date", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_waste_logs_location_date", "waste_logs", ["location_id", "waste_date"])

    # --- Recipes ---
    op.create_table(
        "recipes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("yield_quantity", sa.Numeric(12, 4), server_default="1"),
        sa.Column("yield_unit", sa.String(50), server_default="serving"),
        sa.Column("instructions", sa.Text),
        sa.Column("is_sub_recipe", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "recipe_ingredients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("recipe_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("items.id")),
        sa.Column("sub_recipe_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipes.id")),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint(
            "(item_id IS NOT NULL AND sub_recipe_id IS NULL) OR (item_id IS NULL AND sub_recipe_id IS NOT NULL)",
            name="ck_recipe_ingredients_exactly_one_source",
        ),
    )

    op.create_table(
        "menu_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipe_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipes.id"), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("section", sa.String(100), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Prep ---
    op.create_table(
        "prep_lists",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prep_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(20), server_default="generated"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_prep_lists_location_date", "prep_lists", ["location_id", "prep_date"])

    op.create_table(
        "prep_list_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("prep_list_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("prep_lists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipe_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recipes.id"), nullable=False),
        sa.Column("qty_needed", sa.Numeric(12, 4), nullable=False),
        sa.Column("on_hand", sa.Numeric(12, 4), server_default="0"),
        sa.Column("to_prep", sa.Numeric(12, 4), nullable=False),
        sa.Column("is_complete", sa.Boolean, server_default="false"),
        sa.Column("completed_qty", sa.Numeric(12, 4)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Food Cost ---
    op.create_table(
        "daily_food_cost",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cost_date", sa.Date, nullable=False),
        sa.Column("beginning_inventory", sa.Numeric(12, 2), server_default="0"),
        sa.Column("purchases", sa.Numeric(12, 2), server_default="0"),
        sa.Column("ending_inventory", sa.Numeric(12, 2), server_default="0"),
        sa.Column("actual_food_cost", sa.Numeric(12, 2), server_default="0"),
        sa.Column("theoretical_food_cost", sa.Numeric(12, 2)),
        sa.Column("sales", sa.Numeric(12, 2), server_default="0"),
        sa.Column("food_cost_pct", sa.Numeric(6, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("location_id", "cost_date", name="uq_daily_food_cost_loc_date"),
    )
    op.create_index("ix_daily_food_cost_location_date", "daily_food_cost", ["location_id", "cost_date"])

    op.create_table(
        "price_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("items.id"), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("previous_price", sa.Numeric(12, 4), nullable=False),
        sa.Column("new_price", sa.Numeric(12, 4), nullable=False),
        sa.Column("pct_change", sa.Numeric(8, 2), nullable=False),
        sa.Column("alert_date", sa.Date, nullable=False),
        sa.Column("acknowledged", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Purchasing ---
    op.create_table(
        "order_guides",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("location_id", "vendor_id", name="uq_order_guide_loc_vendor"),
    )

    op.create_table(
        "order_guide_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("order_guide_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("order_guides.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("items.id"), nullable=False),
        sa.Column("par_level", sa.Numeric(12, 4), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "purchase_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("po_number", sa.String(100)),
        sa.Column("order_date", sa.Date, nullable=False),
        sa.Column("expected_delivery", sa.Date),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("total", sa.Numeric(12, 2), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_purchase_orders_location_date", "purchase_orders", ["location_id", "order_date"])

    op.create_table(
        "purchase_order_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("items.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("estimated_price", sa.Numeric(12, 4), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- POS ---
    op.create_table(
        "pos_sales",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sales_date", sa.Date, nullable=False),
        sa.Column("total_sales", sa.Numeric(12, 2), server_default="0"),
        sa.Column("food_sales", sa.Numeric(12, 2), server_default="0"),
        sa.Column("beverage_sales", sa.Numeric(12, 2), server_default="0"),
        sa.Column("guest_count", sa.Integer, server_default="0"),
        sa.Column("check_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("location_id", "sales_date", name="uq_pos_sales_loc_date"),
    )
    op.create_index("ix_pos_sales_location_date", "pos_sales", ["location_id", "sales_date"])

    op.create_table(
        "pos_product_mix",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("menu_item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("menu_items.id"), nullable=False),
        sa.Column("sales_date", sa.Date, nullable=False),
        sa.Column("quantity_sold", sa.Integer, nullable=False),
        sa.Column("revenue", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_pos_pmix_location_date", "pos_product_mix", ["location_id", "sales_date"])

    # --- Budgets ---
    op.create_table(
        "budget_periods",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("target_food_cost_pct", sa.Numeric(6, 2)),
        sa.Column("target_labor_pct", sa.Numeric(6, 2)),
        sa.Column("target_revenue", sa.Numeric(12, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_budget_periods_location_start", "budget_periods", ["location_id", "period_start"])


def downgrade() -> None:
    tables = [
        "budget_periods", "pos_product_mix", "pos_sales",
        "purchase_order_lines", "purchase_orders", "order_guide_items", "order_guides",
        "price_alerts", "daily_food_cost",
        "prep_list_items", "prep_lists",
        "menu_items", "recipe_ingredients", "recipes",
        "waste_logs", "par_levels", "inventory_count_lines", "inventory_counts",
        "invoice_line_items", "invoices",
        "items", "units_of_measure", "vendors", "gl_accounts", "locations",
    ]
    for t in tables:
        op.drop_table(t)
