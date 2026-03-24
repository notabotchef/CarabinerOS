"""Menu Engineering Phase 1 — add pricing, 86 status, and history tables.

Adds columns to workspace_menu and menu_items for menu engineering matrix:
  - price, food_cost, contribution_margin, food_cost_pct
  - quantity_sold, menu_mix_pct
  - is_86, eighty_six_reason, eighty_six_at

Creates new tables:
  - menu_item_history  (audit trail for price/cost/performance changes)
  - eighty_six_log     (86/68 event log for pattern analysis)

Revision ID: 010
Revises: 009
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # workspace_menu — add menu engineering columns
    # -----------------------------------------------------------------------
    op.add_column("workspace_menu", sa.Column("price", sa.Numeric(10, 2), nullable=True))
    op.add_column("workspace_menu", sa.Column("food_cost", sa.Numeric(10, 2), nullable=True))
    op.add_column("workspace_menu", sa.Column("contribution_margin", sa.Numeric(10, 2), nullable=True))
    op.add_column("workspace_menu", sa.Column("food_cost_pct", sa.Numeric(6, 2), nullable=True))
    op.add_column("workspace_menu", sa.Column("quantity_sold", sa.Integer, nullable=True))
    op.add_column("workspace_menu", sa.Column("menu_mix_pct", sa.Numeric(6, 2), nullable=True))
    op.add_column("workspace_menu", sa.Column("is_86", sa.Boolean, server_default="false", nullable=False))
    op.add_column("workspace_menu", sa.Column("eighty_six_reason", sa.String(200), nullable=True))
    op.add_column("workspace_menu", sa.Column("eighty_six_at", sa.DateTime(timezone=True), nullable=True))

    # -----------------------------------------------------------------------
    # menu_items (operational) — add cost/86 columns
    # -----------------------------------------------------------------------
    op.add_column("menu_items", sa.Column("food_cost_per_serving", sa.Numeric(10, 2), nullable=True))
    op.add_column("menu_items", sa.Column("contribution_margin", sa.Numeric(10, 2), nullable=True))
    op.add_column("menu_items", sa.Column("is_86", sa.Boolean, server_default="false", nullable=False))
    op.add_column("menu_items", sa.Column("eighty_six_reason", sa.String(200), nullable=True))
    op.add_column("menu_items", sa.Column("eighty_six_at", sa.DateTime(timezone=True), nullable=True))

    # -----------------------------------------------------------------------
    # menu_item_history — audit trail
    # -----------------------------------------------------------------------
    op.create_table(
        "menu_item_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("menu_item_id", UUID(as_uuid=True), sa.ForeignKey("workspace_menu.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("field_changed", sa.String(50), nullable=False),
        sa.Column("old_value", sa.String(100), nullable=True),
        sa.Column("new_value", sa.String(100), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("changed_by", sa.String(100), nullable=False, server_default="system"),
    )

    # -----------------------------------------------------------------------
    # eighty_six_log — 86/68 event tracking
    # -----------------------------------------------------------------------
    op.create_table(
        "eighty_six_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("menu_item_id", UUID(as_uuid=True), sa.ForeignKey("workspace_menu.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("workspace_locations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("action", sa.String(10), nullable=False),
        sa.Column("reason", sa.String(200), nullable=True),
        sa.Column("logged_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("eighty_six_log")
    op.drop_table("menu_item_history")

    # menu_items
    op.drop_column("menu_items", "eighty_six_at")
    op.drop_column("menu_items", "eighty_six_reason")
    op.drop_column("menu_items", "is_86")
    op.drop_column("menu_items", "contribution_margin")
    op.drop_column("menu_items", "food_cost_per_serving")

    # workspace_menu
    op.drop_column("workspace_menu", "eighty_six_at")
    op.drop_column("workspace_menu", "eighty_six_reason")
    op.drop_column("workspace_menu", "is_86")
    op.drop_column("workspace_menu", "menu_mix_pct")
    op.drop_column("workspace_menu", "quantity_sold")
    op.drop_column("workspace_menu", "food_cost_pct")
    op.drop_column("workspace_menu", "contribution_margin")
    op.drop_column("workspace_menu", "food_cost")
    op.drop_column("workspace_menu", "price")
