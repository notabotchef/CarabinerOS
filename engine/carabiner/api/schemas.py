"""Pydantic response/request schemas for the REST API."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


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
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


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


# --- Menu ---

class MenuOut(TimestampSchema):
    id: uuid.UUID
    location_id: uuid.UUID
    item_name: str
    category: str
    performance: str
    margin_pct: str
    recommendation: str
    recipe: Optional[Dict[str, Any]] = None
    summary: Optional[str] = None
    detail_points: Optional[List[str]] = None
    prompt: Optional[str] = None


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
