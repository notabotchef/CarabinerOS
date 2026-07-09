"""Align live workspace tables with ChatContextMixin + stalled 010 schema.

Revision ID: 011_chat_context
Revises: 008

Context:
- Live DBs were stamped at 008 (009 seed fails; five 010 files share one
  revision id and cannot form a linear chain).
- ORM models already expected chat_context_id (ChatContextMixin) and the
  Phase-1 columns from the 010_* files.
- This migration is idempotent (ADD COLUMN IF NOT EXISTS) and is the
  recommended stamp for Hermes beta Postgres.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "011_chat_context"
down_revision = "008"
branch_labels = None
depends_on = None

_CHAT_TABLES = (
    "workspace_orders",
    "workspace_inventory",
    "workspace_prep",
    "workspace_menu",
    "workspace_campaigns",
    "workspace_invoices",
    "workspace_recipes",
)


def upgrade() -> None:
    for table in _CHAT_TABLES:
        op.execute(
            sa.text(
                f"ALTER TABLE {table} "
                f"ADD COLUMN IF NOT EXISTS chat_context_id VARCHAR(50)"
            )
        )
        op.execute(
            sa.text(
                f"CREATE INDEX IF NOT EXISTS ix_{table}_chat_context_id "
                f"ON {table} (chat_context_id)"
            )
        )

    # --- 010_inventory_functional_fields (workspace_inventory only) ---
    op.execute(sa.text("ALTER TABLE workspace_inventory ADD COLUMN IF NOT EXISTS item_id UUID"))
    op.execute(sa.text("ALTER TABLE workspace_inventory ADD COLUMN IF NOT EXISTS category VARCHAR(100)"))
    op.execute(sa.text("ALTER TABLE workspace_inventory ADD COLUMN IF NOT EXISTS storage_area VARCHAR(100)"))
    op.execute(sa.text("ALTER TABLE workspace_inventory ADD COLUMN IF NOT EXISTS unit_cost VARCHAR(50)"))
    op.execute(sa.text("ALTER TABLE workspace_inventory ADD COLUMN IF NOT EXISTS last_count_id UUID"))

    # --- 010_menu_engineering_phase1 (workspace_menu only) ---
    op.execute(sa.text("ALTER TABLE workspace_menu ADD COLUMN IF NOT EXISTS price NUMERIC(10,2)"))
    op.execute(sa.text("ALTER TABLE workspace_menu ADD COLUMN IF NOT EXISTS food_cost NUMERIC(10,2)"))
    op.execute(sa.text("ALTER TABLE workspace_menu ADD COLUMN IF NOT EXISTS contribution_margin NUMERIC(10,2)"))
    op.execute(sa.text("ALTER TABLE workspace_menu ADD COLUMN IF NOT EXISTS food_cost_pct NUMERIC(6,2)"))
    op.execute(sa.text("ALTER TABLE workspace_menu ADD COLUMN IF NOT EXISTS quantity_sold INTEGER"))
    op.execute(sa.text("ALTER TABLE workspace_menu ADD COLUMN IF NOT EXISTS menu_mix_pct NUMERIC(6,2)"))
    op.execute(
        sa.text(
            "ALTER TABLE workspace_menu ADD COLUMN IF NOT EXISTS is_86 "
            "BOOLEAN NOT NULL DEFAULT false"
        )
    )
    op.execute(sa.text("ALTER TABLE workspace_menu ADD COLUMN IF NOT EXISTS eighty_six_reason VARCHAR(200)"))
    op.execute(sa.text("ALTER TABLE workspace_menu ADD COLUMN IF NOT EXISTS eighty_six_at TIMESTAMPTZ"))

    # --- 010_invoices_phase1 ---
    op.execute(sa.text("ALTER TABLE workspace_invoices ADD COLUMN IF NOT EXISTS purchase_order_id UUID"))
    op.execute(sa.text("ALTER TABLE workspace_invoices ADD COLUMN IF NOT EXISTS match_status VARCHAR(20)"))
    op.execute(sa.text("ALTER TABLE workspace_invoices ADD COLUMN IF NOT EXISTS approved_by VARCHAR(200)"))
    op.execute(sa.text("ALTER TABLE workspace_invoices ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ"))
    op.execute(sa.text("ALTER TABLE workspace_invoices ADD COLUMN IF NOT EXISTS ocr_confidence INTEGER"))

    # --- 010_marketing_phase1_columns ---
    op.execute(sa.text("ALTER TABLE workspace_campaigns ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ"))
    op.execute(sa.text("ALTER TABLE workspace_campaigns ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ"))
    op.execute(sa.text("ALTER TABLE workspace_campaigns ADD COLUMN IF NOT EXISTS budget_cents INTEGER"))
    op.execute(sa.text("ALTER TABLE workspace_campaigns ADD COLUMN IF NOT EXISTS media_urls JSONB"))
    op.execute(sa.text("ALTER TABLE workspace_campaigns ADD COLUMN IF NOT EXISTS tags JSONB"))


def downgrade() -> None:
    # Best-effort; production rarely downgrades past beta schema alignment.
    for table in _CHAT_TABLES:
        op.execute(sa.text(f"DROP INDEX IF EXISTS ix_{table}_chat_context_id"))
        op.execute(sa.text(f"ALTER TABLE {table} DROP COLUMN IF EXISTS chat_context_id"))
