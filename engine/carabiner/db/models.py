"""SQLAlchemy ORM models for all CarabinerOS restaurant tables."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from carabiner.db.base import Base, LocationScopedMixin, TimestampMixin


# ---------------------------------------------------------------------------
# Core Tables
# ---------------------------------------------------------------------------

class Location(TimestampMixin, Base):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(500))
    timezone: Mapped[str] = mapped_column(String(50), default="America/Chicago")


class GLAccount(TimestampMixin, Base):
    __tablename__ = "gl_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)


class Vendor(TimestampMixin, Base):
    __tablename__ = "vendors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_email: Mapped[Optional[str]] = mapped_column(String(300))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50))
    payment_terms: Mapped[Optional[str]] = mapped_column(String(100))
    connector_id: Mapped[Optional[str]] = mapped_column(String(100))


class UnitOfMeasure(TimestampMixin, Base):
    __tablename__ = "units_of_measure"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    abbreviation: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)


class Item(TimestampMixin, Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    default_uom_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("units_of_measure.id")
    )
    gl_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gl_accounts.id")
    )
    last_known_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4))


# ---------------------------------------------------------------------------
# Invoice Processing
# ---------------------------------------------------------------------------

class Invoice(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False
    )
    invoice_number: Mapped[Optional[str]] = mapped_column(String(100))
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/processing/matched/approved/paid/disputed

    line_items: Mapped[list[InvoiceLineItem]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_invoices_location_date", "location_id", "invoice_date"),
    )


class InvoiceLineItem(TimestampMixin, Base):
    __tablename__ = "invoice_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id")
    )
    description: Mapped[Optional[str]] = mapped_column(String(500))
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    gl_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gl_accounts.id")
    )

    invoice: Mapped[Invoice] = relationship(back_populates="line_items")


# ---------------------------------------------------------------------------
# Inventory Management
# ---------------------------------------------------------------------------

class InventoryCount(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "inventory_counts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    count_date: Mapped[date] = mapped_column(Date, nullable=False)
    count_type: Mapped[str] = mapped_column(String(20), nullable=False)  # full/spot/walk_in
    status: Mapped[str] = mapped_column(String(20), default="in_progress")  # in_progress/completed

    lines: Mapped[list[InventoryCountLine]] = relationship(
        back_populates="count", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_inventory_counts_location_date", "location_id", "count_date"),
    )


class InventoryCountLine(TimestampMixin, Base):
    __tablename__ = "inventory_count_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    count_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_counts.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id"), nullable=False
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    storage_area: Mapped[Optional[str]] = mapped_column(String(100))

    count: Mapped[InventoryCount] = relationship(back_populates="lines")


class ParLevel(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "par_levels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id"), nullable=False
    )
    min_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    day_of_week: Mapped[Optional[int]] = mapped_column(Integer)  # 0=Mon..6=Sun, NULL=all days

    __table_args__ = (
        UniqueConstraint("location_id", "item_id", "day_of_week", name="uq_par_level_loc_item_day"),
    )


class WasteLog(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "waste_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id"), nullable=False
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)  # spoilage/overproduction/expired
    notes: Mapped[Optional[str]] = mapped_column(Text)
    waste_date: Mapped[date] = mapped_column(Date, nullable=False)

    __table_args__ = (
        Index("ix_waste_logs_location_date", "location_id", "waste_date"),
    )


# ---------------------------------------------------------------------------
# Recipe & Menu
# ---------------------------------------------------------------------------

class Recipe(TimestampMixin, Base):
    __tablename__ = "recipes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    yield_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=1)
    yield_unit: Mapped[str] = mapped_column(String(50), default="serving")
    instructions: Mapped[Optional[str]] = mapped_column(Text)
    is_sub_recipe: Mapped[bool] = mapped_column(default=False)

    ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan",
        foreign_keys="[RecipeIngredient.recipe_id]"
    )


class RecipeIngredient(TimestampMixin, Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id"))
    sub_recipe_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recipes.id")
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)

    recipe: Mapped[Recipe] = relationship(back_populates="ingredients", foreign_keys=[recipe_id])

    __table_args__ = (
        CheckConstraint(
            "(item_id IS NOT NULL AND sub_recipe_id IS NULL) OR "
            "(item_id IS NULL AND sub_recipe_id IS NOT NULL)",
            name="exactly_one_source",
        ),
    )


class MenuItem(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "menu_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recipes.id"), nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    section: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)


# ---------------------------------------------------------------------------
# Prep Lists
# ---------------------------------------------------------------------------

class PrepList(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "prep_lists"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prep_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="generated")  # generated/in_progress/completed

    items: Mapped[list[PrepListItem]] = relationship(
        back_populates="prep_list", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_prep_lists_location_date", "location_id", "prep_date"),
    )


class PrepListItem(TimestampMixin, Base):
    __tablename__ = "prep_list_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prep_list_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prep_lists.id", ondelete="CASCADE"), nullable=False
    )
    recipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recipes.id"), nullable=False
    )
    qty_needed: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    on_hand: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=0)
    to_prep: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    is_complete: Mapped[bool] = mapped_column(default=False)
    completed_qty: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    prep_list: Mapped[PrepList] = relationship(back_populates="items")


# ---------------------------------------------------------------------------
# Food Cost
# ---------------------------------------------------------------------------

class DailyFoodCost(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "daily_food_cost"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cost_date: Mapped[date] = mapped_column(Date, nullable=False)
    beginning_inventory: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    purchases: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    ending_inventory: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    actual_food_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    theoretical_food_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    sales: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    food_cost_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))

    __table_args__ = (
        UniqueConstraint("location_id", "cost_date", name="uq_daily_food_cost_loc_date"),
        Index("ix_daily_food_cost_location_date", "location_id", "cost_date"),
    )


class PriceAlert(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "price_alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id"), nullable=False
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False
    )
    previous_price: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    new_price: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    pct_change: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    alert_date: Mapped[date] = mapped_column(Date, nullable=False)
    acknowledged: Mapped[bool] = mapped_column(default=False)


# ---------------------------------------------------------------------------
# Purchasing
# ---------------------------------------------------------------------------

class OrderGuide(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "order_guides"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    items: Mapped[list[OrderGuideItem]] = relationship(
        back_populates="order_guide", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("location_id", "vendor_id", name="uq_order_guide_loc_vendor"),
    )


class OrderGuideItem(TimestampMixin, Base):
    __tablename__ = "order_guide_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_guide_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("order_guides.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id"), nullable=False
    )
    par_level: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=0)

    order_guide: Mapped[OrderGuide] = relationship(back_populates="items")


class PurchaseOrder(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False
    )
    po_number: Mapped[Optional[str]] = mapped_column(String(100))
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_delivery: Mapped[Optional[date]] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft/submitted/confirmed/received
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)

    lines: Mapped[list[PurchaseOrderLine]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_purchase_orders_location_date", "location_id", "order_date"),
    )


class PurchaseOrderLine(TimestampMixin, Base):
    __tablename__ = "purchase_order_lines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("items.id"), nullable=False
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    estimated_price: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)

    purchase_order: Mapped[PurchaseOrder] = relationship(back_populates="lines")


# ---------------------------------------------------------------------------
# POS Integration
# ---------------------------------------------------------------------------

class PosSales(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "pos_sales"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sales_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_sales: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    food_sales: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    beverage_sales: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    guest_count: Mapped[int] = mapped_column(Integer, default=0)
    check_count: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("location_id", "sales_date", name="uq_pos_sales_loc_date"),
        Index("ix_pos_sales_location_date", "location_id", "sales_date"),
    )


class PosProductMix(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "pos_product_mix"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    menu_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_items.id"), nullable=False
    )
    sales_date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity_sold: Mapped[int] = mapped_column(Integer, nullable=False)
    revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    __table_args__ = (
        Index("ix_pos_pmix_location_date", "location_id", "sales_date"),
    )


# ---------------------------------------------------------------------------
# Reporting / Budgets
# ---------------------------------------------------------------------------

class DailyPL(TimestampMixin, LocationScopedMixin, Base):
    """Daily Profit & Loss snapshot for a location."""
    __tablename__ = "daily_pl"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pl_date: Mapped[date] = mapped_column(Date, nullable=False)
    beginning_inventory: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    purchases: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    ending_inventory: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    cogs: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    food_cost_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    labor_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    labor_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (
        UniqueConstraint("location_id", "pl_date", name="uq_daily_pl_loc_date"),
        Index("ix_daily_pl_location_date", "location_id", "pl_date"),
    )


class BudgetPeriod(TimestampMixin, LocationScopedMixin, Base):
    __tablename__ = "budget_periods"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    target_food_cost_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    target_labor_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    target_revenue: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))

    __table_args__ = (
        Index("ix_budget_periods_location_start", "location_id", "period_start"),
    )
