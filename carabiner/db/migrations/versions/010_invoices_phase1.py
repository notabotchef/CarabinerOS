"""Invoices Phase 1: new fields on workspace_invoices + invoice_events table.

Adds purchase_order_id, match_status, approved_by, approved_at, ocr_confidence
to workspace_invoices. Creates invoice_events audit trail table.

Revision ID: 010
Revises: 009
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New columns on workspace_invoices
    op.add_column(
        "workspace_invoices",
        sa.Column("purchase_order_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "workspace_invoices",
        sa.Column("match_status", sa.String(20), nullable=True),
    )
    op.add_column(
        "workspace_invoices",
        sa.Column("approved_by", sa.String(200), nullable=True),
    )
    op.add_column(
        "workspace_invoices",
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "workspace_invoices",
        sa.Column("ocr_confidence", sa.Integer, nullable=True),
    )

    # invoice_events audit trail
    op.create_table(
        "invoice_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "invoice_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workspace_invoices.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("actor", sa.String(200), nullable=True),
        sa.Column("detail", JSONB, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("invoice_events")
    op.drop_column("workspace_invoices", "ocr_confidence")
    op.drop_column("workspace_invoices", "approved_at")
    op.drop_column("workspace_invoices", "approved_by")
    op.drop_column("workspace_invoices", "match_status")
    op.drop_column("workspace_invoices", "purchase_order_id")
