"""Workspace-oriented models for the CarabinerOS frontend.

These tables serve the UI directly with summary/detail_points/prompt fields.
The operational tables in models.py handle the deeper accounting logic (Phase 5).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, List

import sqlalchemy as sa
import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from carabiner.db.base import Base, ChatContextMixin, TimestampMixin


# ---------------------------------------------------------------------------
# Organization (multi-tenant root)
# ---------------------------------------------------------------------------

class Organization(TimestampMixin, Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


# ---------------------------------------------------------------------------
# Workspace Location (enriched with UI fields)
# ---------------------------------------------------------------------------

class WorkspaceLocation(TimestampMixin, Base):
    __tablename__ = "workspace_locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Stable")
    sales_delta: Mapped[Optional[str]] = mapped_column(String(20))
    labor_delta: Mapped[Optional[str]] = mapped_column(String(20))


# ---------------------------------------------------------------------------
# Inbox Items
# ---------------------------------------------------------------------------

class InboxItem(TimestampMixin, Base):
    __tablename__ = "inbox_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_locations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    owner: Mapped[Optional[str]] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(100), nullable=False, default="Open")
    module: Mapped[str] = mapped_column(String(50), nullable=False, default="inbox")
    summary: Mapped[Optional[str]] = mapped_column(Text)
    detail_points: Mapped[Optional[list]] = mapped_column(ARRAY(Text), default=list)
    prompt: Mapped[Optional[str]] = mapped_column(Text)


# ---------------------------------------------------------------------------
# Workspace Orders
# ---------------------------------------------------------------------------

class WorkspaceOrder(ChatContextMixin, TimestampMixin, Base):
    __tablename__ = "workspace_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_locations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    vendor: Mapped[str] = mapped_column(String(200), nullable=False)
    channel: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Drafting")
    total: Mapped[str] = mapped_column(String(50), nullable=False)
    eta: Mapped[Optional[str]] = mapped_column(String(100))
    line_items: Mapped[Optional[dict]] = mapped_column(JSONB, default=list)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    detail_points: Mapped[Optional[list]] = mapped_column(ARRAY(Text), default=list)
    prompt: Mapped[Optional[str]] = mapped_column(Text)


# ---------------------------------------------------------------------------
# Workspace Inventory
# ---------------------------------------------------------------------------

class WorkspaceInventory(ChatContextMixin, TimestampMixin, Base):
    __tablename__ = "workspace_inventory"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_locations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    on_hand: Mapped[str] = mapped_column(String(50), nullable=False)
    par: Mapped[str] = mapped_column(String(50), nullable=False)
    unit: Mapped[Optional[str]] = mapped_column(String(30))
    variance: Mapped[str] = mapped_column(String(20), nullable=False)
    item_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    storage_area: Mapped[Optional[str]] = mapped_column(String(100))
    unit_cost: Mapped[Optional[str]] = mapped_column(String(50))
    last_count_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    summary: Mapped[Optional[str]] = mapped_column(Text)
    detail_points: Mapped[Optional[list]] = mapped_column(ARRAY(Text), default=list)
    prompt: Mapped[Optional[str]] = mapped_column(Text)


# ---------------------------------------------------------------------------
# Workspace Prep Tasks
# ---------------------------------------------------------------------------

class WorkspacePrep(ChatContextMixin, TimestampMixin, Base):
    __tablename__ = "workspace_prep"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_locations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    service_lane: Mapped[str] = mapped_column(String(50), nullable=False)
    task: Mapped[str] = mapped_column(String(200), nullable=False)
    station: Mapped[str] = mapped_column(String(100), nullable=False)
    readiness: Mapped[str] = mapped_column(String(50), nullable=False, default="Ready")
    shortage: Mapped[Optional[str]] = mapped_column(String(200))
    summary: Mapped[Optional[str]] = mapped_column(Text)
    detail_points: Mapped[Optional[list]] = mapped_column(ARRAY(Text), default=list)
    prompt: Mapped[Optional[str]] = mapped_column(Text)


# ---------------------------------------------------------------------------
# Workspace Food Cost
# ---------------------------------------------------------------------------

class WorkspaceFoodCost(TimestampMixin, Base):
    __tablename__ = "workspace_food_cost"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_locations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    menu_item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    pressure: Mapped[str] = mapped_column(String(30), nullable=False)
    current_cost_pct: Mapped[str] = mapped_column(String(20), nullable=False)
    action: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    detail_points: Mapped[Optional[list]] = mapped_column(ARRAY(Text), default=list)
    prompt: Mapped[Optional[str]] = mapped_column(Text)


# ---------------------------------------------------------------------------
# Workspace Menu
# ---------------------------------------------------------------------------

class WorkspaceMenu(ChatContextMixin, TimestampMixin, Base):
    __tablename__ = "workspace_menu"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_locations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    performance: Mapped[str] = mapped_column(String(50), nullable=False)
    margin_pct: Mapped[str] = mapped_column(String(20), nullable=False)
    recommendation: Mapped[str] = mapped_column(String(200), nullable=False)
    recipe: Mapped[Optional[dict]] = mapped_column(JSONB)
    recipe_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_recipes.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    summary: Mapped[Optional[str]] = mapped_column(Text)
    detail_points: Mapped[Optional[list]] = mapped_column(ARRAY(Text), default=list)
    prompt: Mapped[Optional[str]] = mapped_column(Text)

    # --- Menu Engineering Phase 1 ---
    price: Mapped[Optional[float]] = mapped_column(sa.Numeric(10, 2), nullable=True)
    food_cost: Mapped[Optional[float]] = mapped_column(sa.Numeric(10, 2), nullable=True)
    contribution_margin: Mapped[Optional[float]] = mapped_column(sa.Numeric(10, 2), nullable=True)
    food_cost_pct: Mapped[Optional[float]] = mapped_column(sa.Numeric(6, 2), nullable=True)
    quantity_sold: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    menu_mix_pct: Mapped[Optional[float]] = mapped_column(sa.Numeric(6, 2), nullable=True)
    is_86: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    eighty_six_reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    eighty_six_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# Workspace Campaigns (Marketing)
# ---------------------------------------------------------------------------

class WorkspaceCampaign(ChatContextMixin, TimestampMixin, Base):
    __tablename__ = "workspace_campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_locations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    campaign_name: Mapped[str] = mapped_column(String(200), nullable=False)
    channel: Mapped[str] = mapped_column(String(100), nullable=False)
    stage: Mapped[str] = mapped_column(String(50), nullable=False, default="Drafting")
    deliverable: Mapped[str] = mapped_column(String(200), nullable=False)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    budget_cents: Mapped[Optional[int]] = mapped_column(sa.Integer)
    media_urls: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    tags: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    detail_points: Mapped[Optional[list]] = mapped_column(ARRAY(Text), default=list)
    prompt: Mapped[Optional[str]] = mapped_column(Text)


# ---------------------------------------------------------------------------
# Workspace Invoices
# ---------------------------------------------------------------------------

class WorkspaceInvoice(ChatContextMixin, TimestampMixin, Base):
    __tablename__ = "workspace_invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_locations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    vendor_name: Mapped[Optional[str]] = mapped_column(String(200))
    invoice_number: Mapped[Optional[str]] = mapped_column(String(100))
    invoice_date: Mapped[Optional[str]] = mapped_column(String(50))
    due_date: Mapped[Optional[str]] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="uploaded")
    file_path: Mapped[Optional[str]] = mapped_column(String(500))
    file_mime: Mapped[Optional[str]] = mapped_column(String(100))
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="upload")
    subtotal: Mapped[Optional[str]] = mapped_column(String(50))
    tax: Mapped[Optional[str]] = mapped_column(String(50))
    total: Mapped[Optional[str]] = mapped_column(String(50))
    line_items: Mapped[Optional[dict]] = mapped_column(JSONB, default=list)
    gl_codes: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    extracted_data: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    detail_points: Mapped[Optional[list]] = mapped_column(ARRAY(Text), default=list)
    prompt: Mapped[Optional[str]] = mapped_column(Text)

    # Phase 1 fields
    purchase_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    match_status: Mapped[Optional[str]] = mapped_column(String(20))  # unmatched/partial/full/exception
    approved_by: Mapped[Optional[str]] = mapped_column(String(200))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ocr_confidence: Mapped[Optional[int]] = mapped_column(sa.Integer)

    events: Mapped[list["InvoiceEvent"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan",
        order_by="InvoiceEvent.created_at",
    )


class InvoiceEvent(TimestampMixin, Base):
    """Audit trail for invoice lifecycle events."""
    __tablename__ = "invoice_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_invoices.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # uploaded/extracted/matched/approved/rejected/paid/commented
    actor: Mapped[Optional[str]] = mapped_column(String(200))
    detail: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)

    invoice: Mapped[WorkspaceInvoice] = relationship(back_populates="events")


# ---------------------------------------------------------------------------
# Workspace Recipes (Modernist Cuisine format)
# ---------------------------------------------------------------------------

class WorkspaceRecipe(ChatContextMixin, TimestampMixin, Base):
    __tablename__ = "workspace_recipes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_locations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    yield_quantity: Mapped[Optional[float]] = mapped_column(sa.Numeric(12, 4))
    yield_unit: Mapped[Optional[str]] = mapped_column(String(50))
    total_weight_g: Mapped[Optional[float]] = mapped_column(sa.Numeric(12, 2))
    total_cost: Mapped[Optional[float]] = mapped_column(sa.Numeric(12, 2))
    cost_per_serving: Mapped[Optional[float]] = mapped_column(sa.Numeric(12, 2))
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")
    equipment: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[list]] = mapped_column(JSONB, default=list)

    components: Mapped[list["RecipeComponent"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan",
        order_by="RecipeComponent.sort_order",
    )


class RecipeComponent(TimestampMixin, Base):
    __tablename__ = "recipe_components"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_recipes.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sort_order: Mapped[int] = mapped_column(sa.Integer, default=0)
    yield_quantity: Mapped[Optional[float]] = mapped_column(sa.Numeric(12, 4))
    yield_unit: Mapped[Optional[str]] = mapped_column(String(50))

    recipe: Mapped[WorkspaceRecipe] = relationship(back_populates="components")
    ingredients: Mapped[list["RecipeComponentIngredient"]] = relationship(
        back_populates="component", cascade="all, delete-orphan",
        order_by="RecipeComponentIngredient.sort_order",
    )
    steps: Mapped[list["RecipeStep"]] = relationship(
        back_populates="component", cascade="all, delete-orphan",
        order_by="RecipeStep.step_number",
    )


class RecipeComponentIngredient(TimestampMixin, Base):
    __tablename__ = "recipe_component_ingredients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recipe_components.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    item_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("items.id"))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    weight_g: Mapped[float] = mapped_column(sa.Numeric(12, 4), nullable=False)
    percentage: Mapped[Optional[float]] = mapped_column(sa.Numeric(8, 2))
    unit_display: Mapped[str] = mapped_column(String(20), default="g")
    sort_order: Mapped[int] = mapped_column(sa.Integer, default=0)
    notes: Mapped[Optional[str]] = mapped_column(String(300))

    component: Mapped[RecipeComponent] = relationship(back_populates="ingredients")


class RecipeStep(TimestampMixin, Base):
    __tablename__ = "recipe_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recipe_components.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    step_number: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    instruction: Mapped[str] = mapped_column(Text, nullable=False)
    temperature: Mapped[Optional[str]] = mapped_column(String(50))
    duration: Mapped[Optional[str]] = mapped_column(String(50))
    technique: Mapped[Optional[str]] = mapped_column(String(100))

    component: Mapped[RecipeComponent] = relationship(back_populates="steps")


# ---------------------------------------------------------------------------
# Action Log
# ---------------------------------------------------------------------------

class ActionLog(TimestampMixin, Base):
    __tablename__ = "action_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"),
    )
    location_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_locations.id", ondelete="SET NULL"),
    )
    provider_id: Mapped[Optional[str]] = mapped_column(String(100))
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    agent_context_id: Mapped[Optional[str]] = mapped_column(String(200))
    extra: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)


# ---------------------------------------------------------------------------
# Menu Item History (audit trail for price/cost/performance changes)
# ---------------------------------------------------------------------------

class MenuItemHistory(Base):
    __tablename__ = "menu_item_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    menu_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_menu.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    field_changed: Mapped[str] = mapped_column(String(50), nullable=False)
    old_value: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    new_value: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    changed_by: Mapped[str] = mapped_column(String(100), nullable=False, server_default="system")


# ---------------------------------------------------------------------------
# Eighty-Six Log (86/68 event tracking for pattern analysis)
# ---------------------------------------------------------------------------

class EightySixLog(Base):
    __tablename__ = "eighty_six_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    menu_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_menu.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspace_locations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    action: Mapped[str] = mapped_column(String(10), nullable=False)  # '86' or '68'
    reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
