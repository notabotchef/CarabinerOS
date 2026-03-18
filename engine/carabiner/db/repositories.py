"""Repository layer — async CRUD for workspace entities."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional, Sequence, Type, TypeVar

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from carabiner.db.engine import get_session
from carabiner.db.workspace_models import (
    ActionLog,
    InboxItem,
    Organization,
    WorkspaceCampaign,
    WorkspaceFoodCost,
    WorkspaceInventory,
    WorkspaceLocation,
    WorkspaceMenu,
    WorkspaceOrder,
    WorkspacePrep,
)

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------

async def _list_all(model: Type[T], location_id: Optional[uuid.UUID] = None) -> Sequence[T]:
    async with get_session() as session:
        stmt = select(model)
        if location_id and hasattr(model, "location_id"):
            stmt = stmt.where(model.location_id == location_id)  # type: ignore[attr-defined]
        stmt = stmt.order_by(model.created_at)  # type: ignore[attr-defined]
        result = await session.execute(stmt)
        return result.scalars().all()


async def _get_by_id(model: Type[T], item_id: uuid.UUID) -> Optional[T]:
    async with get_session() as session:
        result = await session.execute(select(model).where(model.id == item_id))  # type: ignore[attr-defined]
        return result.scalar_one_or_none()


async def _create(model: Type[T], data: Dict[str, Any]) -> T:
    async with get_session() as session:
        instance = model(**data)  # type: ignore[call-arg]
        session.add(instance)
        await session.commit()
        await session.refresh(instance)
        return instance


async def _update(model: Type[T], item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[T]:
    async with get_session() as session:
        result = await session.execute(select(model).where(model.id == item_id))  # type: ignore[attr-defined]
        instance = result.scalar_one_or_none()
        if instance is None:
            return None
        for key, value in data.items():
            setattr(instance, key, value)
        await session.commit()
        await session.refresh(instance)
        return instance


async def _delete(model: Type[T], item_id: uuid.UUID) -> bool:
    async with get_session() as session:
        result = await session.execute(select(model).where(model.id == item_id))  # type: ignore[attr-defined]
        instance = result.scalar_one_or_none()
        if instance is None:
            return False
        await session.delete(instance)
        await session.commit()
        return True


# ---------------------------------------------------------------------------
# Organization
# ---------------------------------------------------------------------------

async def get_organization() -> Optional[Organization]:
    async with get_session() as session:
        result = await session.execute(select(Organization).limit(1))
        return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Locations
# ---------------------------------------------------------------------------

async def list_locations(org_id: Optional[uuid.UUID] = None) -> Sequence[WorkspaceLocation]:
    async with get_session() as session:
        stmt = select(WorkspaceLocation)
        if org_id:
            stmt = stmt.where(WorkspaceLocation.org_id == org_id)
        stmt = stmt.order_by(WorkspaceLocation.name)
        result = await session.execute(stmt)
        return result.scalars().all()


async def get_location_by_slug(slug: str) -> Optional[WorkspaceLocation]:
    async with get_session() as session:
        result = await session.execute(
            select(WorkspaceLocation).where(WorkspaceLocation.slug == slug)
        )
        return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Typed entity repositories
# ---------------------------------------------------------------------------

async def list_inbox(location_id: Optional[uuid.UUID] = None) -> Sequence[InboxItem]:
    return await _list_all(InboxItem, location_id)

async def get_inbox(item_id: uuid.UUID) -> Optional[InboxItem]:
    return await _get_by_id(InboxItem, item_id)

async def create_inbox(data: Dict[str, Any]) -> InboxItem:
    return await _create(InboxItem, data)

async def update_inbox(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[InboxItem]:
    return await _update(InboxItem, item_id, data)

async def delete_inbox(item_id: uuid.UUID) -> bool:
    return await _delete(InboxItem, item_id)


async def list_orders(location_id: Optional[uuid.UUID] = None) -> Sequence[WorkspaceOrder]:
    return await _list_all(WorkspaceOrder, location_id)

async def get_order(item_id: uuid.UUID) -> Optional[WorkspaceOrder]:
    return await _get_by_id(WorkspaceOrder, item_id)

async def create_order(data: Dict[str, Any]) -> WorkspaceOrder:
    return await _create(WorkspaceOrder, data)

async def update_order(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspaceOrder]:
    return await _update(WorkspaceOrder, item_id, data)

async def delete_order(item_id: uuid.UUID) -> bool:
    return await _delete(WorkspaceOrder, item_id)


async def list_inventory(location_id: Optional[uuid.UUID] = None) -> Sequence[WorkspaceInventory]:
    return await _list_all(WorkspaceInventory, location_id)

async def get_inventory(item_id: uuid.UUID) -> Optional[WorkspaceInventory]:
    return await _get_by_id(WorkspaceInventory, item_id)

async def create_inventory(data: Dict[str, Any]) -> WorkspaceInventory:
    return await _create(WorkspaceInventory, data)

async def update_inventory(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspaceInventory]:
    return await _update(WorkspaceInventory, item_id, data)


async def list_prep(location_id: Optional[uuid.UUID] = None) -> Sequence[WorkspacePrep]:
    return await _list_all(WorkspacePrep, location_id)

async def get_prep(item_id: uuid.UUID) -> Optional[WorkspacePrep]:
    return await _get_by_id(WorkspacePrep, item_id)

async def create_prep(data: Dict[str, Any]) -> WorkspacePrep:
    return await _create(WorkspacePrep, data)

async def update_prep(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspacePrep]:
    return await _update(WorkspacePrep, item_id, data)


async def list_food_cost(location_id: Optional[uuid.UUID] = None) -> Sequence[WorkspaceFoodCost]:
    return await _list_all(WorkspaceFoodCost, location_id)

async def get_food_cost(item_id: uuid.UUID) -> Optional[WorkspaceFoodCost]:
    return await _get_by_id(WorkspaceFoodCost, item_id)

async def create_food_cost(data: Dict[str, Any]) -> WorkspaceFoodCost:
    return await _create(WorkspaceFoodCost, data)

async def update_food_cost(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspaceFoodCost]:
    return await _update(WorkspaceFoodCost, item_id, data)


async def list_menu(location_id: Optional[uuid.UUID] = None) -> Sequence[WorkspaceMenu]:
    return await _list_all(WorkspaceMenu, location_id)

async def get_menu(item_id: uuid.UUID) -> Optional[WorkspaceMenu]:
    return await _get_by_id(WorkspaceMenu, item_id)

async def create_menu(data: Dict[str, Any]) -> WorkspaceMenu:
    return await _create(WorkspaceMenu, data)

async def update_menu(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspaceMenu]:
    return await _update(WorkspaceMenu, item_id, data)


async def list_campaigns(location_id: Optional[uuid.UUID] = None) -> Sequence[WorkspaceCampaign]:
    return await _list_all(WorkspaceCampaign, location_id)

async def get_campaign(item_id: uuid.UUID) -> Optional[WorkspaceCampaign]:
    return await _get_by_id(WorkspaceCampaign, item_id)

async def create_campaign(data: Dict[str, Any]) -> WorkspaceCampaign:
    return await _create(WorkspaceCampaign, data)

async def update_campaign(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspaceCampaign]:
    return await _update(WorkspaceCampaign, item_id, data)


async def list_action_log(location_id: Optional[uuid.UUID] = None) -> Sequence[ActionLog]:
    return await _list_all(ActionLog, location_id)

async def create_action_log(data: Dict[str, Any]) -> ActionLog:
    return await _create(ActionLog, data)
