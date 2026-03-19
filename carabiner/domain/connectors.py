"""Provider connector logic — ported from AgentCarabinerOS/python/helpers/carabiner_connectors.py."""

from __future__ import annotations

from copy import deepcopy
from enum import Enum
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, ConfigDict


class ConnectorChannel(str, Enum):
    API = "api"
    EMAIL = "email"
    BROWSER = "browser"


class ConnectorStatus(str, Enum):
    DRAFTED = "drafted"
    READY = "ready"
    EXECUTING = "executing"
    SENT = "sent"
    FAILED = "failed"
    FALLBACK_USED = "fallback_used"


class ProviderConnector(BaseModel):
    model_config = ConfigDict(frozen=True)

    provider_id: str
    provider_name: str
    channels: Tuple[ConnectorChannel, ...]
    default_channel: ConnectorChannel
    fallback_channel: Optional[ConnectorChannel] = None


PROVIDERS: Dict[str, ProviderConnector] = {
    "coastal-produce": ProviderConnector(
        provider_id="coastal-produce",
        provider_name="Coastal Produce",
        channels=(ConnectorChannel.API, ConnectorChannel.EMAIL),
        default_channel=ConnectorChannel.API,
        fallback_channel=ConnectorChannel.EMAIL,
    ),
    "prime-meats": ProviderConnector(
        provider_id="prime-meats",
        provider_name="Prime Meats",
        channels=(ConnectorChannel.BROWSER, ConnectorChannel.EMAIL),
        default_channel=ConnectorChannel.BROWSER,
        fallback_channel=ConnectorChannel.EMAIL,
    ),
    "heritage-bakery": ProviderConnector(
        provider_id="heritage-bakery",
        provider_name="Heritage Bakery",
        channels=(ConnectorChannel.EMAIL,),
        default_channel=ConnectorChannel.EMAIL,
        fallback_channel=None,
    ),
}


class ActionPlan(BaseModel):
    provider_id: str
    provider_name: str
    action_type: str
    payload_summary: str
    requested_channel: str
    channel: str
    status: ConnectorStatus
    fallback_channel: Optional[str] = None
    available_channels: List[ConnectorChannel] = []


def list_connector_capabilities() -> List[Dict[str, object]]:
    return [
        {
            "provider_id": c.provider_id,
            "provider_name": c.provider_name,
            "channels": list(c.channels),
            "default_channel": c.default_channel,
            "fallback_channel": c.fallback_channel,
        }
        for c in PROVIDERS.values()
    ]


def plan_external_action(
    *,
    provider_id: str,
    action_type: str,
    payload_summary: str,
    requested_channel: Optional[ConnectorChannel] = None,
    autonomous_enabled: bool = False,
) -> ActionPlan:
    connector = PROVIDERS.get(provider_id)
    if connector is None:
        raise KeyError(f"Unknown provider connector: {provider_id}")

    requested = requested_channel or connector.default_channel
    fallback_used = False

    if requested in connector.channels:
        channel = requested
    else:
        fallback_used = True
        channel = connector.fallback_channel or connector.default_channel

    if not autonomous_enabled:
        status = ConnectorStatus.DRAFTED
    elif fallback_used:
        status = ConnectorStatus.FALLBACK_USED
    else:
        status = ConnectorStatus.READY

    return ActionPlan(
        provider_id=connector.provider_id,
        provider_name=connector.provider_name,
        action_type=action_type,
        payload_summary=payload_summary,
        requested_channel=requested,
        channel=channel,
        status=status,
        fallback_channel=connector.fallback_channel,
        available_channels=list(connector.channels),
    )


def build_action_log_entry(action_plan: ActionPlan) -> Dict[str, object]:
    entry = action_plan.model_dump()
    entry["intent"] = action_plan.action_type
    entry["outcome"] = action_plan.status
    return entry
