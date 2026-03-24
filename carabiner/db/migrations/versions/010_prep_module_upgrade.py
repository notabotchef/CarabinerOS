"""Prep module upgrade — extend prep_lists, prep_list_items, add prep_stations.

Revision ID: 010
Revises: 009
Create Date: 2026-03-24

Phase 1 of the Prep Module functional upgrade:
- Add station, assigned_to, est_minutes, sort_order, service_lane, notes to prep_list_items
- Add expected_covers, generated_by, approved_by, approved_at to prep_lists
- Create prep_stations reference table
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Extend prep_lists ---
    op.add_column("prep_lists", sa.Column("expected_covers", sa.Integer, nullable=True))
    op.add_column("prep_lists", sa.Column("generated_by", sa.String(50), server_default="manual", nullable=False))
    op.add_column("prep_lists", sa.Column("approved_by", sa.String(100), nullable=True))
    op.add_column("prep_lists", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))

    # --- Extend prep_list_items ---
    op.add_column("prep_list_items", sa.Column("station", sa.String(100), nullable=True))
    op.add_column("prep_list_items", sa.Column("assigned_to", sa.String(100), nullable=True))
    op.add_column("prep_list_items", sa.Column("est_minutes", sa.Integer, nullable=True))
    op.add_column("prep_list_items", sa.Column("sort_order", sa.Integer, server_default="0", nullable=False))
    op.add_column("prep_list_items", sa.Column("service_lane", sa.String(50), nullable=True))
    op.add_column("prep_list_items", sa.Column("notes", sa.Text, nullable=True))
    op.add_column("prep_list_items", sa.Column("unit", sa.String(50), server_default="ea", nullable=False))
    op.add_column("prep_list_items", sa.Column("name", sa.String(200), nullable=True))

    # --- Create prep_stations ---
    op.create_table(
        "prep_stations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True),
                   sa.ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("sort_order", sa.Integer, server_default="0", nullable=False),
        sa.Column("default_cook", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_prep_stations_location_id", "prep_stations", ["location_id"])


def downgrade() -> None:
    op.drop_table("prep_stations")

    op.drop_column("prep_list_items", "name")
    op.drop_column("prep_list_items", "unit")
    op.drop_column("prep_list_items", "notes")
    op.drop_column("prep_list_items", "service_lane")
    op.drop_column("prep_list_items", "sort_order")
    op.drop_column("prep_list_items", "est_minutes")
    op.drop_column("prep_list_items", "assigned_to")
    op.drop_column("prep_list_items", "station")

    op.drop_column("prep_lists", "approved_at")
    op.drop_column("prep_lists", "approved_by")
    op.drop_column("prep_lists", "generated_by")
    op.drop_column("prep_lists", "expected_covers")
