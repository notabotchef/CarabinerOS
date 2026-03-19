"""HQ endpoint — full headquarters payload for the frontend."""

from __future__ import annotations

from fastapi import APIRouter

from carabiner.api.schemas import (
    ConnectorOut,
    HQPayload,
    InboxItemOut,
    LocationOut,
    MetricOut,
    OrganizationOut,
)
from carabiner.db import repositories as repo
from carabiner.domain.connectors import list_connector_capabilities

router = APIRouter(prefix="/api", tags=["hq"])

MODULES = [
    {"id": "home", "label": "Home", "icon": "forum"},
    {"id": "inbox", "label": "Inbox", "icon": "notifications_active"},
    {"id": "orders", "label": "Orders", "icon": "receipt_long"},
    {"id": "inventory", "label": "Inventory", "icon": "inventory_2"},
    {"id": "prep", "label": "Prep", "icon": "kitchen"},
    {"id": "food-cost", "label": "Food Cost", "icon": "monitoring"},
    {"id": "menu", "label": "Menu", "icon": "restaurant_menu"},
    {"id": "marketing", "label": "Marketing", "icon": "campaign"},
    {"id": "locations", "label": "Locations", "icon": "storefront"},
    {"id": "admin", "label": "Admin", "icon": "settings"},
]

SUGGESTED_PROMPTS = [
    "Build today's produce order for River North using par levels and yesterday's sales mix.",
    "Review inventory shortages across all locations and generate an urgent prep list for dinner service.",
    "Calculate food cost pressure for the spring menu and suggest price updates that protect margin.",
    "Research three marketing campaign ideas for a new happy hour launch in West Loop.",
    "Summarize vendor issues from this week and draft follow-up actions by provider.",
    "Design a menu engineering brief showing stars, puzzles, plowhorses, and dogs.",
]

METRICS = [
    MetricOut(label="Orders ready", value="08", delta="+3 today"),
    MetricOut(label="Inventory risks", value="05", delta="2 critical"),
    MetricOut(label="Food cost alerts", value="03", delta="1 new"),
    MetricOut(label="Campaign ideas", value="12", delta="for next launch"),
]


@router.get("/hq", response_model=HQPayload)
async def get_hq() -> HQPayload:
    org = await repo.get_organization()
    locations = await repo.list_locations()
    inbox = await repo.list_inbox()

    caps = list_connector_capabilities()
    connectors = [
        ConnectorOut(
            provider_id=c["provider_id"],
            provider_name=c["provider_name"],
            channels=[ch.value if hasattr(ch, "value") else ch for ch in c["channels"]],
            default_channel=c["default_channel"].value if hasattr(c["default_channel"], "value") else c["default_channel"],
            fallback_channel=c["fallback_channel"].value if c["fallback_channel"] and hasattr(c["fallback_channel"], "value") else c["fallback_channel"],
        )
        for c in caps
    ]

    return HQPayload(
        brand={
            "name": "CarabinerOS",
            "tagline": "Restaurant operations, executed in natural language.",
            "theme": "ember",
        },
        organization=OrganizationOut.model_validate(org) if org else None,
        active_location_id=locations[0].slug if locations else None,
        locations=[LocationOut.model_validate(loc) for loc in locations],
        modules=MODULES,
        suggested_prompts=SUGGESTED_PROMPTS,
        metrics=METRICS,
        inbox=[InboxItemOut.model_validate(item) for item in inbox],
        connectors=connectors,
        execution_mode={
            "default": "demo",
            "autonomous_enabled": False,
            "policy": "opt_in_credentials_required",
        },
    )
