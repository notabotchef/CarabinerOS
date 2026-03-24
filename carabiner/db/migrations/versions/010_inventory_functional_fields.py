"""Add missing columns for inventory functional upgrade.

- WorkspaceInventory: item_id, category, storage_area, unit_cost, last_count_id
- InventoryCount: counted_by, notes
- WasteLog: estimated_cost
- Item: storage_area, is_active

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
    # --- WorkspaceInventory ---
    op.add_column(
        "workspace_inventory",
        sa.Column("item_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "workspace_inventory",
        sa.Column("category", sa.String(100), nullable=True),
    )
    op.add_column(
        "workspace_inventory",
        sa.Column("storage_area", sa.String(100), nullable=True),
    )
    op.add_column(
        "workspace_inventory",
        sa.Column("unit_cost", sa.String(50), nullable=True),
    )
    op.add_column(
        "workspace_inventory",
        sa.Column("last_count_id", UUID(as_uuid=True), nullable=True),
    )

    # --- InventoryCount ---
    op.add_column(
        "inventory_counts",
        sa.Column("counted_by", sa.String(100), nullable=True),
    )
    op.add_column(
        "inventory_counts",
        sa.Column("notes", sa.Text(), nullable=True),
    )

    # --- WasteLog ---
    op.add_column(
        "waste_logs",
        sa.Column("estimated_cost", sa.Numeric(12, 2), nullable=True),
    )

    # --- Item ---
    op.add_column(
        "items",
        sa.Column("storage_area", sa.String(100), nullable=True),
    )
    op.add_column(
        "items",
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("items", "is_active")
    op.drop_column("items", "storage_area")
    op.drop_column("waste_logs", "estimated_cost")
    op.drop_column("inventory_counts", "notes")
    op.drop_column("inventory_counts", "counted_by")
    op.drop_column("workspace_inventory", "last_count_id")
    op.drop_column("workspace_inventory", "unit_cost")
    op.drop_column("workspace_inventory", "storage_area")
    op.drop_column("workspace_inventory", "category")
    op.drop_column("workspace_inventory", "item_id")
