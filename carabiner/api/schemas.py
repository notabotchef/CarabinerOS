"""Pydantic response/request schemas for the REST API."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class TimestampSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# --- Organization & Locations ---

class OrganizationOut(TimestampSchema):
    id: uuid.UUID
    name: str
    slug: str


class LocationOut(TimestampSchema):
    id: uuid.UUID
    slug: str
    name: str
    city: str
    status: str
    sales_delta: Optional[str] = None
    labor_delta: Optional[str] = None


# --- Inbox ---

class InboxItemOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    title: str
    priority: str
    owner: Optional[str] = None
    status: str
    module: str
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


class InboxItemCreate(BaseModel):
    location_id: uuid.UUID
    title: str
    priority: str = "medium"
    owner: Optional[str] = None
    status: str = "Open"
    module: str = "inbox"
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


class InboxItemUpdate(BaseModel):
    title: Optional[str] = None
    priority: Optional[str] = None
    owner: Optional[str] = None
    status: Optional[str] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None


# --- Orders ---

class OrderOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    vendor: str
    channel: str
    status: str
    total: str
    eta: Optional[str] = None
    line_items: Optional[Any] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


class OrderCreate(BaseModel):
    location_id: uuid.UUID
    vendor: str
    channel: str
    status: str = "Drafting"
    total: str
    eta: Optional[str] = None
    line_items: Optional[Any] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


class OrderUpdate(BaseModel):
    vendor: Optional[str] = None
    channel: Optional[str] = None
    status: Optional[str] = None
    total: Optional[str] = None
    eta: Optional[str] = None
    line_items: Optional[Any] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None


# --- Inventory ---

class InventoryOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    item_name: str
    on_hand: str
    par: str
    variance: str
    unit: Optional[str] = None
    item_id: Optional[uuid.UUID] = None
    category: Optional[str] = None
    storage_area: Optional[str] = None
    unit_cost: Optional[str] = None
    last_count_id: Optional[uuid.UUID] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


class InventoryCreate(BaseModel):
    location_id: uuid.UUID
    item_name: str
    on_hand: str
    par: str
    variance: str
    unit: Optional[str] = None
    item_id: Optional[uuid.UUID] = None
    category: Optional[str] = None
    storage_area: Optional[str] = None
    unit_cost: Optional[str] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


class InventoryUpdate(BaseModel):
    item_name: Optional[str] = None
    on_hand: Optional[str] = None
    par: Optional[str] = None
    variance: Optional[str] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    storage_area: Optional[str] = None
    unit_cost: Optional[str] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None


# --- Inventory Counts ---

class CountLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    count_id: uuid.UUID
    item_id: uuid.UUID
    item_name: Optional[str] = None
    quantity: float
    unit_cost: float
    storage_area: Optional[str] = None


class CountOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    count_date: str
    count_type: str
    status: str
    counted_by: Optional[str] = None
    notes: Optional[str] = None
    line_count: int = 0
    total_value: Optional[float] = None
    lines: Optional[List[CountLineOut]] = None


# --- Par Levels ---

class ParLevelOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    item_id: uuid.UUID
    item_name: Optional[str] = None
    min_quantity: float
    on_hand: Optional[str] = None
    shortfall: Optional[float] = None
    day_of_week: Optional[int] = None


# --- Waste Log ---

class WasteLogOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    item_id: uuid.UUID
    item_name: Optional[str] = None
    quantity: float
    unit: str
    reason: str
    notes: Optional[str] = None
    waste_date: str
    estimated_cost: Optional[float] = None


# --- Items ---

class ItemOut(TimestampSchema):
    id: uuid.UUID
    name: str
    category: str
    storage_area: Optional[str] = None
    is_active: bool = True
    last_known_price: Optional[float] = None


# --- Inventory Valuation ---

class ValuationOut(BaseModel):
    total_value: float
    item_count: int
    location_id: Optional[uuid.UUID] = None


# --- Prep ---

class PrepOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    service_lane: str
    task: str
    station: str
    readiness: str
    shortage: Optional[str] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


class PrepCreate(BaseModel):
    location_id: uuid.UUID
    service_lane: str
    task: str
    station: str
    readiness: str = "Ready"
    shortage: Optional[str] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


class PrepUpdate(BaseModel):
    service_lane: Optional[str] = None
    task: Optional[str] = None
    station: Optional[str] = None
    readiness: Optional[str] = None
    shortage: Optional[str] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None


# --- Prep Operational (PrepList / PrepListItem / PrepStation) ---

class PrepListItemOut(TimestampSchema):
    id: uuid.UUID
    prep_list_id: uuid.UUID
    recipe_id: uuid.UUID
    name: Optional[str] = None
    qty_needed: float
    unit: str = "ea"
    on_hand: float = 0
    to_prep: float
    is_complete: bool = False
    completed_qty: Optional[float] = None
    completed_at: Optional[datetime] = None
    station: Optional[str] = None
    assigned_to: Optional[str] = None
    est_minutes: Optional[int] = None
    sort_order: int = 0
    service_lane: Optional[str] = None
    notes: Optional[str] = None


class PrepListOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    prep_date: str
    status: str
    expected_covers: Optional[int] = None
    generated_by: str = "manual"
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    items: List[PrepListItemOut] = []


class PrepListItemComplete(BaseModel):
    completed_qty: Optional[float] = None


class PrepStationOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    name: str
    sort_order: int = 0
    default_cook: Optional[str] = None


class PrepStationCreate(BaseModel):
    location_id: uuid.UUID
    name: str
    sort_order: int = 0
    default_cook: Optional[str] = None


# --- Food Cost ---

class FoodCostOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    menu_item_name: str
    pressure: str
    current_cost_pct: str
    action: str
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


class FoodCostCreate(BaseModel):
    location_id: uuid.UUID
    menu_item_name: str
    pressure: str
    current_cost_pct: str
    action: str
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


class FoodCostUpdate(BaseModel):
    menu_item_name: Optional[str] = None
    pressure: Optional[str] = None
    current_cost_pct: Optional[str] = None
    action: Optional[str] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None


# --- Menu ---

class MenuOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    item_name: str
    category: str
    performance: str
    margin_pct: str
    recommendation: str
    recipe: Optional[Dict[str, Any] | str] = None
    recipe_id: Optional[uuid.UUID] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None
    # Menu Engineering Phase 1
    price: Optional[float] = None
    food_cost: Optional[float] = None
    contribution_margin: Optional[float] = None
    food_cost_pct: Optional[float] = None
    quantity_sold: Optional[int] = None
    menu_mix_pct: Optional[float] = None
    is_86: bool = False
    eighty_six_reason: Optional[str] = None
    eighty_six_at: Optional[datetime] = None


class MenuCreate(BaseModel):
    location_id: uuid.UUID
    item_name: str
    category: str
    performance: str
    margin_pct: str
    recommendation: str
    recipe: Optional[Dict[str, Any] | str] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None
    # Menu Engineering Phase 1
    price: Optional[float] = None
    food_cost: Optional[float] = None
    contribution_margin: Optional[float] = None
    food_cost_pct: Optional[float] = None
    quantity_sold: Optional[int] = None
    menu_mix_pct: Optional[float] = None
    is_86: bool = False
    eighty_six_reason: Optional[str] = None


class MenuUpdate(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    performance: Optional[str] = None
    margin_pct: Optional[str] = None
    recommendation: Optional[str] = None
    recipe: Optional[Dict[str, Any] | str] = None
    recipe_id: Optional[uuid.UUID] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    # Menu Engineering Phase 1
    price: Optional[float] = None
    food_cost: Optional[float] = None
    contribution_margin: Optional[float] = None
    food_cost_pct: Optional[float] = None
    quantity_sold: Optional[int] = None
    menu_mix_pct: Optional[float] = None
    is_86: Optional[bool] = None
    eighty_six_reason: Optional[str] = None


class EightySixLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    menu_item_id: uuid.UUID
    location_id: uuid.UUID
    action: str
    reason: Optional[str] = None
    logged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


class MenuItemHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    menu_item_id: uuid.UUID
    field_changed: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_at: Optional[datetime] = None
    changed_by: str = "system"


# --- Marketing / Campaigns ---

class CampaignOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    campaign_name: str
    channel: str
    stage: str
    deliverable: str
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


class CampaignCreate(BaseModel):
    location_id: uuid.UUID
    campaign_name: str
    channel: str
    stage: str = "Drafting"
    deliverable: str
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


class CampaignUpdate(BaseModel):
    campaign_name: Optional[str] = None
    channel: Optional[str] = None
    stage: Optional[str] = None
    deliverable: Optional[str] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None


# --- Invoices ---

class InvoiceOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    status: str
    file_path: Optional[str] = None
    file_mime: Optional[str] = None
    source: Optional[str] = None
    subtotal: Optional[str] = None
    tax: Optional[str] = None
    total: Optional[str] = None
    line_items: Optional[Any] = None
    gl_codes: Optional[Dict[str, Any]] = None
    extracted_data: Optional[Dict[str, Any]] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None
    purchase_order_id: Optional[uuid.UUID] = None
    match_status: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    ocr_confidence: Optional[int] = None


class InvoiceEventOut(TimestampSchema):
    id: uuid.UUID
    invoice_id: uuid.UUID
    event_type: str
    actor: Optional[str] = None
    detail: Optional[Dict[str, Any]] = None


class InvoiceDetailOut(InvoiceOut):
    """Full invoice detail including audit trail events."""
    events: List[InvoiceEventOut] = []


class InvoiceCreate(BaseModel):
    location_id: uuid.UUID
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    status: str = "uploaded"
    source: str = "upload"
    summary: Optional[str] = None


class InvoiceUpdate(BaseModel):
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    subtotal: Optional[str] = None
    tax: Optional[str] = None
    total: Optional[str] = None
    line_items: Optional[Any] = None
    gl_codes: Optional[Dict[str, Any]] = None
    extracted_data: Optional[Dict[str, Any]] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None


# --- Locations ---

class LocationCreate(BaseModel):
    org_id: uuid.UUID
    slug: str
    name: str
    city: str
    status: str = "Stable"
    sales_delta: Optional[str] = None
    labor_delta: Optional[str] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    status: Optional[str] = None
    sales_delta: Optional[str] = None
    labor_delta: Optional[str] = None


class EmailWebhookPayload(BaseModel):
    location_id: uuid.UUID
    from_address: str
    subject: str
    body: Optional[str] = None
    attachment_url: Optional[str] = None


# --- HQ Payload ---

class MetricOut(BaseModel):
    label: str
    value: str
    delta: str


class ConnectorOut(BaseModel):
    provider_id: str
    provider_name: str
    channels: List[str]
    default_channel: str
    fallback_channel: Optional[str] = None


class HQPayload(BaseModel):
    brand: Dict[str, str]
    organization: Optional[OrganizationOut] = None
    active_location_id: Optional[str] = None
    locations: List[LocationOut]
    modules: List[Dict[str, str]]
    suggested_prompts: List[str]
    metrics: List[MetricOut]
    inbox: List[InboxItemOut]
    connectors: List[ConnectorOut]
    execution_mode: Dict[str, Any]


# --- Recipes (Modernist Cuisine format) ---

class RecipeStepOut(TimestampSchema):
    id: uuid.UUID
    component_id: uuid.UUID
    step_number: int
    instruction: str
    temperature: Optional[str] = None
    duration: Optional[str] = None
    technique: Optional[str] = None


class RecipeComponentIngredientOut(TimestampSchema):
    id: uuid.UUID
    component_id: uuid.UUID
    item_id: Optional[uuid.UUID] = None
    name: str
    weight_g: float
    percentage: Optional[float] = None
    unit_display: str = "g"
    sort_order: int = 0
    notes: Optional[str] = None


class RecipeComponentOut(TimestampSchema):
    id: uuid.UUID
    recipe_id: uuid.UUID
    name: str
    sort_order: int = 0
    yield_quantity: Optional[float] = None
    yield_unit: Optional[str] = None
    ingredients: List[RecipeComponentIngredientOut] = []
    steps: List[RecipeStepOut] = []


class RecipeOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    name: str
    category: str
    description: Optional[str] = None
    status: str = "draft"
    yield_quantity: Optional[float] = None
    yield_unit: Optional[str] = None
    total_weight_g: Optional[float] = None
    total_cost: Optional[float] = None
    cost_per_serving: Optional[float] = None
    image_url: Optional[str] = None
    source: Optional[str] = "manual"
    equipment: Optional[List[str]] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class RecipeDetailOut(RecipeOut):
    """Full recipe detail including nested components, ingredients, and steps."""
    components: List[RecipeComponentOut] = []


class RecipeStepCreate(BaseModel):
    step_number: int
    instruction: str
    temperature: Optional[str] = None
    duration: Optional[str] = None
    technique: Optional[str] = None


class RecipeComponentIngredientCreate(BaseModel):
    item_id: Optional[uuid.UUID] = None
    name: str
    weight_g: float
    percentage: Optional[float] = None
    unit_display: str = "g"
    sort_order: int = 0
    notes: Optional[str] = None


class RecipeComponentCreate(BaseModel):
    name: str
    sort_order: int = 0
    yield_quantity: Optional[float] = None
    yield_unit: Optional[str] = None
    ingredients: List[RecipeComponentIngredientCreate] = []
    steps: List[RecipeStepCreate] = []


class RecipeCreate(BaseModel):
    location_id: uuid.UUID
    name: str
    category: str
    description: Optional[str] = None
    status: str = "draft"
    yield_quantity: Optional[float] = None
    yield_unit: Optional[str] = None
    total_weight_g: Optional[float] = None
    total_cost: Optional[float] = None
    cost_per_serving: Optional[float] = None
    image_url: Optional[str] = None
    source: str = "manual"
    equipment: Optional[List[str]] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    components: List[RecipeComponentCreate] = []


class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    yield_quantity: Optional[float] = None
    yield_unit: Optional[str] = None
    total_weight_g: Optional[float] = None
    total_cost: Optional[float] = None
    cost_per_serving: Optional[float] = None
    image_url: Optional[str] = None
    source: Optional[str] = None
    equipment: Optional[List[str]] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    components: Optional[List[RecipeComponentCreate]] = None


class RecipeParseRequest(BaseModel):
    """Request body for recipe parsing. Either text or image_url should be provided."""
    text: Optional[str] = None
    image_url: Optional[str] = None


class RecipeParseResponse(BaseModel):
    """Mock parsed recipe from OCR/LLM."""
    draft: RecipeCreate


# --- Daily Food Cost (Operational) ---

class DailyFoodCostOut(BaseModel):
    """Response schema for DailyFoodCost rows."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    location_id: uuid.UUID
    cost_date: date
    beginning_inventory: float
    purchases: float
    ending_inventory: float
    actual_food_cost: float
    theoretical_food_cost: Optional[float] = None
    sales: float
    food_cost_pct: Optional[float] = None


class FoodCostSummaryOut(BaseModel):
    """Computed KPIs for the food cost summary endpoint."""
    today_food_cost_pct: Optional[float] = None
    today_sales: Optional[float] = None
    today_purchases: Optional[float] = None
    period_food_cost_pct: Optional[float] = None
    period_total_purchases: float = 0
    period_total_sales: float = 0
    budget_target_pct: Optional[float] = None
    budget_amount: Optional[float] = None
    budget_over_under: Optional[float] = None
    prime_cost_pct: Optional[float] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None


class BudgetOut(BaseModel):
    """Response schema for the budget endpoint."""
    model_config = ConfigDict(from_attributes=True)

    id: Optional[uuid.UUID] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    target_food_cost_pct: Optional[float] = None
    target_labor_pct: Optional[float] = None
    target_revenue: Optional[float] = None
    actual_purchases: float = 0
    actual_sales: float = 0
    actual_food_cost_pct: Optional[float] = None
    over_under: Optional[float] = None
    days_elapsed: int = 0
    days_total: int = 0


# --- Vendors ---

class VendorOut(TimestampSchema):
    id: uuid.UUID
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    payment_terms: Optional[str] = None
    connector_id: Optional[str] = None
