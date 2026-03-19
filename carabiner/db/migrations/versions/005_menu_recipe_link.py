"""Add recipe_id FK column to workspace_menu table for recipe-menu linking.

Revision ID: 005
Revises: 004
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workspace_menu",
        sa.Column(
            "recipe_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workspace_recipes.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_workspace_menu_recipe_id",
        "workspace_menu",
        ["recipe_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_workspace_menu_recipe_id", "workspace_menu")
    op.drop_column("workspace_menu", "recipe_id")
