"""Add workspace_invoices table and seed data for Phase 6.

Revision ID: 006
Revises: 005
"""

import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None

# Re-use deterministic location IDs from migration 002
LOC_RIVER_NORTH = uuid.UUID("00000000-0000-0000-0001-000000000001")
LOC_WEST_LOOP = uuid.UUID("00000000-0000-0000-0001-000000000002")
LOC_FULTON_MARKET = uuid.UUID("00000000-0000-0000-0001-000000000003")


def upgrade() -> None:
    op.create_table(
        "workspace_invoices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "location_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workspace_locations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("vendor", sa.String(200), nullable=False),
        sa.Column("invoice_number", sa.String(100)),
        sa.Column("invoice_date", sa.String(30), nullable=False),
        sa.Column("due_date", sa.String(30)),
        sa.Column("status", sa.String(30), nullable=False, server_default="Uploaded"),
        sa.Column("total", sa.String(50), nullable=False),
        sa.Column("line_items", JSONB, server_default="[]"),
        sa.Column("gl_codes", JSONB, server_default="[]"),
        sa.Column("po_match_id", sa.String(200)),
        sa.Column("variance_notes", sa.Text),
        sa.Column("file_path", sa.String(500)),
        sa.Column("summary", sa.Text),
        sa.Column("detail_points", ARRAY(sa.Text), server_default="{}"),
        sa.Column("prompt", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    _seed_invoices()


def _seed_invoices() -> None:
    """Insert sample invoices across locations."""

    inv = sa.table(
        "workspace_invoices",
        sa.column("id", UUID),
        sa.column("location_id", UUID),
        sa.column("vendor", sa.String),
        sa.column("invoice_number", sa.String),
        sa.column("invoice_date", sa.String),
        sa.column("due_date", sa.String),
        sa.column("status", sa.String),
        sa.column("total", sa.String),
        sa.column("line_items", JSONB),
        sa.column("gl_codes", JSONB),
        sa.column("po_match_id", sa.String),
        sa.column("variance_notes", sa.Text),
        sa.column("file_path", sa.String),
        sa.column("summary", sa.Text),
        sa.column("detail_points", ARRAY(sa.Text)),
        sa.column("prompt", sa.Text),
    )

    op.bulk_insert(inv, [
        {
            "id": uuid.uuid4(),
            "location_id": LOC_RIVER_NORTH,
            "vendor": "Coastal Produce",
            "invoice_number": "CP-2026-4417",
            "invoice_date": "2026-03-15",
            "due_date": "2026-04-14",
            "status": "Matched",
            "total": "$1,284.50",
            "line_items": [
                {"description": "Hass Avocados (case)", "qty": 6, "unit_price": 42.00, "total": 252.00, "gl_code": "5010"},
                {"description": "Roma Tomatoes (case)", "qty": 4, "unit_price": 28.50, "total": 114.00, "gl_code": "5010"},
                {"description": "Fresh Basil (bunch)", "qty": 12, "unit_price": 3.75, "total": 45.00, "gl_code": "5010"},
                {"description": "Mixed Greens (case)", "qty": 8, "unit_price": 34.00, "total": 272.00, "gl_code": "5010"},
                {"description": "Lemons (case)", "qty": 3, "unit_price": 22.50, "total": 67.50, "gl_code": "5010"},
                {"description": "Seasonal Berries (flat)", "qty": 5, "unit_price": 48.00, "total": 240.00, "gl_code": "5010"},
                {"description": "Delivery surcharge", "qty": 1, "unit_price": 15.00, "total": 15.00, "gl_code": "5090"},
            ],
            "gl_codes": [
                {"code": "5010", "name": "Food - Produce", "total": 990.50},
                {"code": "5090", "name": "Food - Delivery", "total": 15.00},
            ],
            "po_match_id": "PO-RN-0312",
            "variance_notes": "Avocado unit price $42 vs PO estimate $38 (+10.5%). All other items within 2% tolerance.",
            "summary": "Produce invoice matched to PO with a notable avocado price variance.",
            "detail_points": [
                "Invoice matched to PO-RN-0312 with 7 line items.",
                "Avocado price variance of +10.5% flagged for review.",
                "All other items are within the 2% tolerance threshold.",
                "GL auto-categorized: 98% to Food-Produce, 2% to Delivery.",
            ],
            "prompt": "Review the Coastal Produce invoice variance on avocados at River North.",
        },
        {
            "id": uuid.uuid4(),
            "location_id": LOC_WEST_LOOP,
            "vendor": "Prime Meats",
            "invoice_number": "PM-88921",
            "invoice_date": "2026-03-14",
            "due_date": "2026-03-28",
            "status": "Approved",
            "total": "$2,046.00",
            "line_items": [
                {"description": "Burger Trim 80/20 (case)", "qty": 6, "unit_price": 128.00, "total": 768.00, "gl_code": "5020"},
                {"description": "Short Ribs Bone-In (case)", "qty": 4, "unit_price": 185.00, "total": 740.00, "gl_code": "5020"},
                {"description": "Chicken Breast (case)", "qty": 3, "unit_price": 72.00, "total": 216.00, "gl_code": "5020"},
                {"description": "Pork Belly (case)", "qty": 2, "unit_price": 95.00, "total": 190.00, "gl_code": "5020"},
                {"description": "Bacon Slab (case)", "qty": 2, "unit_price": 66.00, "total": 132.00, "gl_code": "5020"},
            ],
            "gl_codes": [
                {"code": "5020", "name": "Food - Protein", "total": 2046.00},
            ],
            "po_match_id": "PO-WL-0310",
            "variance_notes": None,
            "summary": "Protein invoice approved. All items matched PO within tolerance.",
            "detail_points": [
                "Invoice matched to PO-WL-0310 with 5 line items.",
                "All prices within 1% of PO estimates.",
                "Approved by GM on 2026-03-16.",
                "Payment due in 14 days (Net 14 terms).",
            ],
            "prompt": "Show me the details of the Prime Meats invoice for West Loop.",
        },
        {
            "id": uuid.uuid4(),
            "location_id": LOC_FULTON_MARKET,
            "vendor": "Lakefront Seafood",
            "invoice_number": "LS-2026-0587",
            "invoice_date": "2026-03-16",
            "due_date": "2026-04-15",
            "status": "Processing",
            "total": "$1,612.00",
            "line_items": [
                {"description": "Shrimp 16/20 (case)", "qty": 5, "unit_price": 145.00, "total": 725.00, "gl_code": "5020"},
                {"description": "Diver Scallops (lb)", "qty": 12, "unit_price": 28.00, "total": 336.00, "gl_code": "5020"},
                {"description": "Oysters Blue Point (bag)", "qty": 8, "unit_price": 52.00, "total": 416.00, "gl_code": "5020"},
                {"description": "Smoked Salmon (lb)", "qty": 6, "unit_price": 22.50, "total": 135.00, "gl_code": "5020"},
            ],
            "gl_codes": [
                {"code": "5020", "name": "Food - Protein / Seafood", "total": 1612.00},
            ],
            "po_match_id": None,
            "variance_notes": "No matching PO found. Invoice is being matched manually.",
            "summary": "Seafood invoice is in processing; no PO match was found automatically.",
            "detail_points": [
                "OCR extraction completed with 4 line items.",
                "No matching purchase order was found in the system.",
                "GL codes auto-assigned to Food-Protein/Seafood.",
                "Manual review needed to confirm quantities and approve.",
            ],
            "prompt": "Match the Lakefront Seafood invoice to a purchase order for Fulton Market.",
        },
        {
            "id": uuid.uuid4(),
            "location_id": LOC_RIVER_NORTH,
            "vendor": "Heritage Bakery",
            "invoice_number": "HB-7744",
            "invoice_date": "2026-03-17",
            "due_date": "2026-03-31",
            "status": "Uploaded",
            "total": "$486.00",
            "line_items": [
                {"description": "Sourdough Loaves", "qty": 24, "unit_price": 6.50, "total": 156.00, "gl_code": "5010"},
                {"description": "Brioche Buns", "qty": 48, "unit_price": 3.25, "total": 156.00, "gl_code": "5010"},
                {"description": "Croissants", "qty": 36, "unit_price": 2.75, "total": 99.00, "gl_code": "5010"},
                {"description": "Focaccia Sheets", "qty": 10, "unit_price": 7.50, "total": 75.00, "gl_code": "5010"},
            ],
            "gl_codes": [
                {"code": "5010", "name": "Food - Bakery", "total": 486.00},
            ],
            "po_match_id": None,
            "variance_notes": None,
            "summary": "Bakery invoice uploaded and awaiting OCR processing.",
            "detail_points": [
                "Invoice file received from Heritage Bakery.",
                "OCR extraction has not yet been run.",
                "4 expected line items based on the usual order pattern.",
                "Use the agent to process and match this invoice.",
            ],
            "prompt": "Process the Heritage Bakery invoice for River North.",
        },
        {
            "id": uuid.uuid4(),
            "location_id": LOC_WEST_LOOP,
            "vendor": "City Spirits",
            "invoice_number": "CS-2026-1193",
            "invoice_date": "2026-03-13",
            "due_date": "2026-04-12",
            "status": "Paid",
            "total": "$3,220.00",
            "line_items": [
                {"description": "House Pour Vodka (case)", "qty": 4, "unit_price": 180.00, "total": 720.00, "gl_code": "5030"},
                {"description": "Bourbon Selection (case)", "qty": 3, "unit_price": 320.00, "total": 960.00, "gl_code": "5030"},
                {"description": "House Wine Red (case)", "qty": 6, "unit_price": 110.00, "total": 660.00, "gl_code": "5030"},
                {"description": "House Wine White (case)", "qty": 5, "unit_price": 96.00, "total": 480.00, "gl_code": "5030"},
                {"description": "Craft Beer Variety (keg)", "qty": 4, "unit_price": 100.00, "total": 400.00, "gl_code": "5030"},
            ],
            "gl_codes": [
                {"code": "5030", "name": "Beverage - Alcohol", "total": 3220.00},
            ],
            "po_match_id": "PO-WL-0308",
            "variance_notes": None,
            "summary": "Beverage invoice fully processed and paid.",
            "detail_points": [
                "Invoice matched to PO-WL-0308 with no variances.",
                "Payment processed on 2026-03-17 via ACH.",
                "All GL codes assigned to Beverage-Alcohol.",
                "Archived for accounting period 2026-Q1.",
            ],
            "prompt": "Show the payment details for the City Spirits invoice at West Loop.",
        },
    ])


def downgrade() -> None:
    op.drop_table("workspace_invoices")
