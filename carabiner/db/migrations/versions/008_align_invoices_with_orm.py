"""Align workspace_invoices table with WorkspaceInvoice ORM model.

Add missing columns (vendor_name, file_mime, source, subtotal, tax,
extracted_data) and rename vendor -> vendor_name so the ORM can query
without crashing.

Revision ID: 008
Revises: 007
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename vendor -> vendor_name to match ORM
    op.alter_column(
        "workspace_invoices",
        "vendor",
        new_column_name="vendor_name",
    )

    # Make vendor_name nullable (ORM declares Optional)
    op.alter_column(
        "workspace_invoices",
        "vendor_name",
        nullable=True,
    )

    # Add columns present in the ORM but missing from the table
    op.add_column(
        "workspace_invoices",
        sa.Column("file_mime", sa.String(100), nullable=True),
    )
    op.add_column(
        "workspace_invoices",
        sa.Column("source", sa.String(50), nullable=False, server_default="upload"),
    )
    op.add_column(
        "workspace_invoices",
        sa.Column("subtotal", sa.String(50), nullable=True),
    )
    op.add_column(
        "workspace_invoices",
        sa.Column("tax", sa.String(50), nullable=True),
    )
    op.add_column(
        "workspace_invoices",
        sa.Column("extracted_data", JSONB, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("workspace_invoices", "extracted_data")
    op.drop_column("workspace_invoices", "tax")
    op.drop_column("workspace_invoices", "subtotal")
    op.drop_column("workspace_invoices", "source")
    op.drop_column("workspace_invoices", "file_mime")

    # Restore original nullability
    op.alter_column(
        "workspace_invoices",
        "vendor_name",
        nullable=False,
    )

    # Rename back
    op.alter_column(
        "workspace_invoices",
        "vendor_name",
        new_column_name="vendor",
    )
