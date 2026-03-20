"""Add unit column to workspace_inventory and extract units from on_hand/par.

Revision ID: 007
Revises: 006
"""

from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add the nullable unit column
    op.add_column(
        "workspace_inventory",
        sa.Column("unit", sa.String(30), nullable=True),
    )

    # 2. Extract unit suffix from on_hand and populate the new column.
    #    Pattern: "18 case" -> unit="case", on_hand="18"
    #    Works for any "<number> <unit>" format.
    conn = op.get_bind()

    # Set unit from on_hand where it contains a space (i.e. "18 case")
    conn.execute(sa.text(
        """
        UPDATE workspace_inventory
        SET unit = TRIM(SUBSTRING(on_hand FROM '[^0-9.]+$'))
        WHERE on_hand ~ '^[0-9.]+ +[a-zA-Z]'
          AND unit IS NULL
        """
    ))

    # Strip the unit suffix from on_hand, keeping only the numeric part
    conn.execute(sa.text(
        """
        UPDATE workspace_inventory
        SET on_hand = TRIM(REGEXP_REPLACE(on_hand, '\s+[a-zA-Z]+$', ''))
        WHERE on_hand ~ '^[0-9.]+ +[a-zA-Z]'
        """
    ))

    # Strip the unit suffix from par, keeping only the numeric part
    conn.execute(sa.text(
        """
        UPDATE workspace_inventory
        SET par = TRIM(REGEXP_REPLACE(par, '\s+[a-zA-Z]+$', ''))
        WHERE par ~ '^[0-9.]+ +[a-zA-Z]'
        """
    ))


def downgrade() -> None:
    conn = op.get_bind()

    # Restore the unit suffix into on_hand and par before dropping the column
    conn.execute(sa.text(
        """
        UPDATE workspace_inventory
        SET on_hand = on_hand || ' ' || unit,
            par = par || ' ' || unit
        WHERE unit IS NOT NULL
        """
    ))

    op.drop_column("workspace_inventory", "unit")
