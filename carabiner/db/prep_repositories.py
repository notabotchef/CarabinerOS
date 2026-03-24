"""Repository layer -- async CRUD for operational Prep models.

PrepList, PrepListItem, PrepStation -- the real prep data, not the
workspace summary layer.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from carabiner.db.engine import get_session
from carabiner.db.models import PrepList, PrepListItem, PrepStation


# ---------------------------------------------------------------------------
# PrepList
# ---------------------------------------------------------------------------

async def get_prep_list_today(
    location_id: uuid.UUID,
) -> Optional[PrepList]:
    """Get today's prep list with all items eagerly loaded."""
    today = date.today()
    async with get_session() as session:
        stmt = (
            select(PrepList)
            .where(
                and_(
                    PrepList.location_id == location_id,
                    PrepList.prep_date == today,
                )
            )
            .options(selectinload(PrepList.items))
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def get_prep_list_by_date(
    location_id: uuid.UUID,
    prep_date: date,
) -> Optional[PrepList]:
    """Get a prep list for a specific date."""
    async with get_session() as session:
        stmt = (
            select(PrepList)
            .where(
                and_(
                    PrepList.location_id == location_id,
                    PrepList.prep_date == prep_date,
                )
            )
            .options(selectinload(PrepList.items))
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def get_prep_list_by_id(prep_list_id: uuid.UUID) -> Optional[PrepList]:
    """Get a single prep list by ID with items."""
    async with get_session() as session:
        stmt = (
            select(PrepList)
            .where(PrepList.id == prep_list_id)
            .options(selectinload(PrepList.items))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def create_prep_list(data: Dict[str, Any]) -> PrepList:
    """Create a prep list (without items -- add those separately)."""
    items_data = data.pop("items", [])
    async with get_session() as session:
        prep_list = PrepList(**data)
        session.add(prep_list)
        await session.flush()

        for item_data in items_data:
            item_data["prep_list_id"] = prep_list.id
            item = PrepListItem(**item_data)
            session.add(item)

        await session.commit()
        await session.refresh(prep_list)
        # Re-fetch with items loaded
        return await get_prep_list_by_id(prep_list.id)  # type: ignore[return-value]


async def update_prep_list(
    prep_list_id: uuid.UUID,
    data: Dict[str, Any],
) -> Optional[PrepList]:
    """Update prep list metadata (status, approved_by, etc.)."""
    async with get_session() as session:
        result = await session.execute(
            select(PrepList).where(PrepList.id == prep_list_id)
        )
        prep_list = result.scalar_one_or_none()
        if prep_list is None:
            return None
        for key, value in data.items():
            setattr(prep_list, key, value)
        await session.commit()
        return await get_prep_list_by_id(prep_list_id)


# ---------------------------------------------------------------------------
# PrepListItem
# ---------------------------------------------------------------------------

async def get_prep_item(item_id: uuid.UUID) -> Optional[PrepListItem]:
    """Get a single prep item by ID."""
    async with get_session() as session:
        result = await session.execute(
            select(PrepListItem).where(PrepListItem.id == item_id)
        )
        return result.scalar_one_or_none()


async def create_prep_item(data: Dict[str, Any]) -> PrepListItem:
    """Add a prep item to an existing list."""
    async with get_session() as session:
        item = PrepListItem(**data)
        session.add(item)
        await session.commit()
        await session.refresh(item)
        return item


async def update_prep_item(
    item_id: uuid.UUID,
    data: Dict[str, Any],
) -> Optional[PrepListItem]:
    """Update a prep item (assigned_to, qty, station, notes, etc.)."""
    async with get_session() as session:
        result = await session.execute(
            select(PrepListItem).where(PrepListItem.id == item_id)
        )
        item = result.scalar_one_or_none()
        if item is None:
            return None
        for key, value in data.items():
            setattr(item, key, value)
        await session.commit()
        await session.refresh(item)
        return item


async def complete_prep_item(
    item_id: uuid.UUID,
    completed_qty: Optional[Decimal] = None,
) -> Optional[PrepListItem]:
    """Mark a prep item as complete with timestamp."""
    async with get_session() as session:
        result = await session.execute(
            select(PrepListItem).where(PrepListItem.id == item_id)
        )
        item = result.scalar_one_or_none()
        if item is None:
            return None

        # Toggle: if already complete, uncomplete it
        if item.is_complete:
            item.is_complete = False
            item.completed_qty = None
            item.completed_at = None
        else:
            item.is_complete = True
            item.completed_qty = completed_qty if completed_qty is not None else item.to_prep
            item.completed_at = datetime.now(timezone.utc)

        await session.commit()
        await session.refresh(item)

        # Check if all items in the list are complete -> update list status
        list_result = await session.execute(
            select(PrepListItem).where(PrepListItem.prep_list_id == item.prep_list_id)
        )
        all_items = list_result.scalars().all()
        any_complete = any(i.is_complete for i in all_items)
        all_complete = all(i.is_complete for i in all_items)

        list_result2 = await session.execute(
            select(PrepList).where(PrepList.id == item.prep_list_id)
        )
        prep_list = list_result2.scalar_one_or_none()
        if prep_list:
            if all_complete:
                prep_list.status = "completed"
            elif any_complete:
                prep_list.status = "in_progress"
            else:
                prep_list.status = "generated"
            await session.commit()

        return item


async def delete_prep_item(item_id: uuid.UUID) -> bool:
    """Remove a prep item."""
    async with get_session() as session:
        result = await session.execute(
            select(PrepListItem).where(PrepListItem.id == item_id)
        )
        item = result.scalar_one_or_none()
        if item is None:
            return False
        await session.delete(item)
        await session.commit()
        return True


# ---------------------------------------------------------------------------
# PrepStation
# ---------------------------------------------------------------------------

async def list_prep_stations(
    location_id: uuid.UUID,
) -> Sequence[PrepStation]:
    """List all prep stations for a location, ordered by sort_order."""
    async with get_session() as session:
        stmt = (
            select(PrepStation)
            .where(PrepStation.location_id == location_id)
            .order_by(PrepStation.sort_order)
        )
        result = await session.execute(stmt)
        return result.scalars().all()


async def create_prep_station(data: Dict[str, Any]) -> PrepStation:
    """Create a new prep station."""
    async with get_session() as session:
        station = PrepStation(**data)
        session.add(station)
        await session.commit()
        await session.refresh(station)
        return station


async def update_prep_station(
    station_id: uuid.UUID,
    data: Dict[str, Any],
) -> Optional[PrepStation]:
    """Update a prep station."""
    async with get_session() as session:
        result = await session.execute(
            select(PrepStation).where(PrepStation.id == station_id)
        )
        station = result.scalar_one_or_none()
        if station is None:
            return None
        for key, value in data.items():
            setattr(station, key, value)
        await session.commit()
        await session.refresh(station)
        return station
