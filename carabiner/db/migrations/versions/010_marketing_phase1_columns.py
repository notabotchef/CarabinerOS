"""Add Phase 1 marketing columns to workspace_campaigns.

Adds scheduled_at, end_date, budget_cents, media_urls, tags columns.
All nullable so existing data is unaffected.

Revision ID: 010
Revises: 009
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workspace_campaigns",
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "workspace_campaigns",
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "workspace_campaigns",
        sa.Column("budget_cents", sa.Integer(), nullable=True),
    )
    op.add_column(
        "workspace_campaigns",
        sa.Column("media_urls", JSONB(), nullable=True),
    )
    op.add_column(
        "workspace_campaigns",
        sa.Column("tags", JSONB(), nullable=True),
    )

    # Update seed campaigns with scheduled dates for calendar demo
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE workspace_campaigns
        SET scheduled_at = now() + interval '3 days',
            tags = '["brunch", "social", "email"]'::jsonb
        WHERE campaign_name = 'Weekend brunch feature'
    """))
    conn.execute(sa.text("""
        UPDATE workspace_campaigns
        SET scheduled_at = now() + interval '7 days',
            tags = '["happy-hour", "local"]'::jsonb
        WHERE campaign_name = 'Happy hour launch'
    """))


def downgrade() -> None:
    op.drop_column("workspace_campaigns", "tags")
    op.drop_column("workspace_campaigns", "media_urls")
    op.drop_column("workspace_campaigns", "budget_cents")
    op.drop_column("workspace_campaigns", "end_date")
    op.drop_column("workspace_campaigns", "scheduled_at")
