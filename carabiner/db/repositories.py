"""Repository layer — async CRUD for workspace entities."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence, Type, TypeVar

from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from carabiner.db.engine import get_session
from carabiner.db.models import (
    InventoryCount,
    InventoryCountLine,
    Item,
    ParLevel,
    WasteLog,
)
from carabiner.db.workspace_models import (
    ActionLog,
    InboxItem,
    Organization,
    RecipeComponent,
    RecipeComponentIngredient,
    RecipeStep,
    WorkspaceCampaign,
    WorkspaceFoodCost,
    WorkspaceInventory,
    WorkspaceInvoice,
    WorkspaceLocation,
    WorkspaceMenu,
    WorkspaceOrder,
    WorkspacePrep,
    WorkspaceRecipe,
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
    """Create an order with dedup guard: if an order with the same vendor AND
    chat_context_id was created within the last 60 seconds, return the existing
    order instead of inserting a duplicate."""
    vendor = data.get("vendor")
    chat_ctx = data.get("chat_context_id")

    if vendor and chat_ctx:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
        async with get_session() as session:
            stmt = (
                select(WorkspaceOrder)
                .where(
                    WorkspaceOrder.vendor == vendor,
                    WorkspaceOrder.chat_context_id == chat_ctx,
                    WorkspaceOrder.created_at >= cutoff,
                )
                .order_by(WorkspaceOrder.created_at.desc())
                .limit(1)
            )
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing is not None:
                return existing

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

async def delete_inventory(item_id: uuid.UUID) -> bool:
    return await _delete(WorkspaceInventory, item_id)


async def list_prep(location_id: Optional[uuid.UUID] = None) -> Sequence[WorkspacePrep]:
    return await _list_all(WorkspacePrep, location_id)

async def get_prep(item_id: uuid.UUID) -> Optional[WorkspacePrep]:
    return await _get_by_id(WorkspacePrep, item_id)

async def create_prep(data: Dict[str, Any]) -> WorkspacePrep:
    return await _create(WorkspacePrep, data)

async def update_prep(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspacePrep]:
    return await _update(WorkspacePrep, item_id, data)

async def delete_prep(item_id: uuid.UUID) -> bool:
    return await _delete(WorkspacePrep, item_id)


async def list_food_cost(location_id: Optional[uuid.UUID] = None) -> Sequence[WorkspaceFoodCost]:
    return await _list_all(WorkspaceFoodCost, location_id)

async def get_food_cost(item_id: uuid.UUID) -> Optional[WorkspaceFoodCost]:
    return await _get_by_id(WorkspaceFoodCost, item_id)

async def create_food_cost(data: Dict[str, Any]) -> WorkspaceFoodCost:
    return await _create(WorkspaceFoodCost, data)

async def update_food_cost(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspaceFoodCost]:
    return await _update(WorkspaceFoodCost, item_id, data)

async def delete_food_cost(item_id: uuid.UUID) -> bool:
    return await _delete(WorkspaceFoodCost, item_id)


async def list_menu(location_id: Optional[uuid.UUID] = None) -> Sequence[WorkspaceMenu]:
    return await _list_all(WorkspaceMenu, location_id)

async def get_menu(item_id: uuid.UUID) -> Optional[WorkspaceMenu]:
    return await _get_by_id(WorkspaceMenu, item_id)

async def create_menu(data: Dict[str, Any]) -> WorkspaceMenu:
    return await _create(WorkspaceMenu, data)

async def update_menu(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspaceMenu]:
    return await _update(WorkspaceMenu, item_id, data)

async def delete_menu(item_id: uuid.UUID) -> bool:
    return await _delete(WorkspaceMenu, item_id)


async def list_campaigns(location_id: Optional[uuid.UUID] = None) -> Sequence[WorkspaceCampaign]:
    return await _list_all(WorkspaceCampaign, location_id)

async def get_campaign(item_id: uuid.UUID) -> Optional[WorkspaceCampaign]:
    return await _get_by_id(WorkspaceCampaign, item_id)

async def create_campaign(data: Dict[str, Any]) -> WorkspaceCampaign:
    return await _create(WorkspaceCampaign, data)

async def update_campaign(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspaceCampaign]:
    return await _update(WorkspaceCampaign, item_id, data)

async def delete_campaign(item_id: uuid.UUID) -> bool:
    return await _delete(WorkspaceCampaign, item_id)


# ---------------------------------------------------------------------------
# Locations CRUD
# ---------------------------------------------------------------------------

async def get_location(item_id: uuid.UUID) -> Optional[WorkspaceLocation]:
    return await _get_by_id(WorkspaceLocation, item_id)

async def create_location(data: Dict[str, Any]) -> WorkspaceLocation:
    return await _create(WorkspaceLocation, data)

async def update_location(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspaceLocation]:
    return await _update(WorkspaceLocation, item_id, data)

async def delete_location(item_id: uuid.UUID) -> bool:
    return await _delete(WorkspaceLocation, item_id)


async def list_invoices(location_id: Optional[uuid.UUID] = None) -> Sequence[WorkspaceInvoice]:
    return await _list_all(WorkspaceInvoice, location_id)

async def get_invoice(item_id: uuid.UUID) -> Optional[WorkspaceInvoice]:
    return await _get_by_id(WorkspaceInvoice, item_id)

async def create_invoice(data: Dict[str, Any]) -> WorkspaceInvoice:
    return await _create(WorkspaceInvoice, data)

async def update_invoice(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspaceInvoice]:
    return await _update(WorkspaceInvoice, item_id, data)

async def delete_invoice(item_id: uuid.UUID) -> bool:
    return await _delete(WorkspaceInvoice, item_id)


async def list_invoices(location_id: Optional[uuid.UUID] = None) -> Sequence[WorkspaceInvoice]:
    return await _list_all(WorkspaceInvoice, location_id)

async def get_invoice(item_id: uuid.UUID) -> Optional[WorkspaceInvoice]:
    return await _get_by_id(WorkspaceInvoice, item_id)

async def create_invoice(data: Dict[str, Any]) -> WorkspaceInvoice:
    return await _create(WorkspaceInvoice, data)

async def update_invoice(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspaceInvoice]:
    return await _update(WorkspaceInvoice, item_id, data)

async def delete_invoice(item_id: uuid.UUID) -> bool:
    return await _delete(WorkspaceInvoice, item_id)


async def get_menu_items_by_recipe(recipe_id: uuid.UUID) -> Sequence[WorkspaceMenu]:
    """Get all menu items linked to a specific recipe."""
    async with get_session() as session:
        stmt = select(WorkspaceMenu).where(WorkspaceMenu.recipe_id == recipe_id)
        result = await session.execute(stmt)
        return result.scalars().all()


async def list_action_log(location_id: Optional[uuid.UUID] = None) -> Sequence[ActionLog]:
    return await _list_all(ActionLog, location_id)

async def create_action_log(data: Dict[str, Any]) -> ActionLog:
    return await _create(ActionLog, data)


# ---------------------------------------------------------------------------
# Recipes (Modernist Cuisine)
# ---------------------------------------------------------------------------

async def list_recipes(
    location_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> Sequence[WorkspaceRecipe]:
    async with get_session() as session:
        from sqlalchemy.orm import selectinload
        stmt = select(WorkspaceRecipe)
        if location_id:
            stmt = stmt.where(WorkspaceRecipe.location_id == location_id)
        if status:
            stmt = stmt.where(WorkspaceRecipe.status == status)
        if category:
            stmt = stmt.where(WorkspaceRecipe.category == category)
        if search:
            stmt = stmt.where(WorkspaceRecipe.name.ilike(f"%{search}%"))
        stmt = stmt.order_by(WorkspaceRecipe.created_at)
        result = await session.execute(stmt)
        return result.scalars().all()


async def get_recipe(item_id: uuid.UUID) -> Optional[WorkspaceRecipe]:
    """Get recipe with full nested components, ingredients, and steps."""
    from sqlalchemy.orm import selectinload
    async with get_session() as session:
        stmt = (
            select(WorkspaceRecipe)
            .where(WorkspaceRecipe.id == item_id)
            .options(
                selectinload(WorkspaceRecipe.components)
                .selectinload(RecipeComponent.ingredients),
                selectinload(WorkspaceRecipe.components)
                .selectinload(RecipeComponent.steps),
            )
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


async def create_recipe(data: Dict[str, Any]) -> WorkspaceRecipe:
    """Create recipe with nested components, ingredients, and steps."""
    async with get_session() as session:
        components_data = data.pop("components", [])
        recipe = WorkspaceRecipe(**data)
        session.add(recipe)
        await session.flush()

        for comp_data in components_data:
            ingredients_data = comp_data.pop("ingredients", [])
            steps_data = comp_data.pop("steps", [])
            component = RecipeComponent(recipe_id=recipe.id, **comp_data)
            session.add(component)
            await session.flush()

            for ing_data in ingredients_data:
                ingredient = RecipeComponentIngredient(component_id=component.id, **ing_data)
                session.add(ingredient)

            for step_data in steps_data:
                step = RecipeStep(component_id=component.id, **step_data)
                session.add(step)

        await session.commit()
        # Re-fetch with relationships
        return await get_recipe(recipe.id)  # type: ignore[return-value]


async def update_recipe(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[WorkspaceRecipe]:
    """Update recipe. If components are provided, replaces all components."""
    async with get_session() as session:
        result = await session.execute(
            select(WorkspaceRecipe).where(WorkspaceRecipe.id == item_id)
        )
        recipe = result.scalar_one_or_none()
        if recipe is None:
            return None

        components_data = data.pop("components", None)

        for key, value in data.items():
            setattr(recipe, key, value)

        if components_data is not None:
            # Delete existing components (cascade deletes ingredients + steps)
            await session.execute(
                delete(RecipeComponent).where(RecipeComponent.recipe_id == item_id)
            )
            await session.flush()

            for comp_data in components_data:
                ingredients_data = comp_data.pop("ingredients", [])
                steps_data = comp_data.pop("steps", [])
                component = RecipeComponent(recipe_id=item_id, **comp_data)
                session.add(component)
                await session.flush()

                for ing_data in ingredients_data:
                    ingredient = RecipeComponentIngredient(component_id=component.id, **ing_data)
                    session.add(ingredient)

                for step_data in steps_data:
                    step = RecipeStep(component_id=component.id, **step_data)
                    session.add(step)

        await session.commit()
        return await get_recipe(item_id)


async def delete_recipe(item_id: uuid.UUID) -> bool:
    return await _delete(WorkspaceRecipe, item_id)


# ---------------------------------------------------------------------------
# Inventory Counts (operational)
# ---------------------------------------------------------------------------

async def list_inventory_counts(
    location_id: Optional[uuid.UUID] = None,
) -> list[dict]:
    """List inventory counts with line count and total value."""
    async with get_session() as session:
        stmt = (
            select(
                InventoryCount,
                func.count(InventoryCountLine.id).label("line_count"),
                func.sum(InventoryCountLine.quantity * InventoryCountLine.unit_cost).label("total_value"),
            )
            .outerjoin(InventoryCountLine, InventoryCount.id == InventoryCountLine.count_id)
            .group_by(InventoryCount.id)
            .order_by(InventoryCount.count_date.desc())
        )
        if location_id:
            stmt = stmt.where(InventoryCount.location_id == location_id)
        result = await session.execute(stmt)
        rows = []
        for count, line_count, total_value in result.all():
            rows.append({
                "id": count.id,
                "location_id": count.location_id,
                "count_date": str(count.count_date),
                "count_type": count.count_type,
                "status": count.status,
                "counted_by": count.counted_by,
                "notes": count.notes,
                "line_count": line_count or 0,
                "total_value": float(total_value) if total_value else None,
                "created_at": count.created_at,
                "updated_at": count.updated_at,
            })
        return rows


async def get_inventory_count(count_id: uuid.UUID) -> Optional[dict]:
    """Get a single inventory count with all lines."""
    from sqlalchemy.orm import selectinload
    async with get_session() as session:
        stmt = (
            select(InventoryCount)
            .where(InventoryCount.id == count_id)
            .options(selectinload(InventoryCount.lines))
        )
        result = await session.execute(stmt)
        count = result.scalar_one_or_none()
        if count is None:
            return None
        lines = []
        for line in count.lines:
            # Fetch item name and category
            item_result = await session.execute(
                select(Item.name, Item.category).where(Item.id == line.item_id)
            )
            item_row = item_result.one_or_none()
            item_name = item_row[0] if item_row else None
            item_category = item_row[1] if item_row else None
            line_total = float(line.quantity) * float(line.unit_cost)
            lines.append({
                "id": line.id,
                "count_id": line.count_id,
                "item_id": line.item_id,
                "item_name": item_name,
                "category": item_category,
                "quantity": float(line.quantity),
                "unit_cost": float(line.unit_cost),
                "line_total": round(line_total, 2),
                "storage_area": line.storage_area,
            })
        total_value = sum(l["line_total"] for l in lines)
        return {
            "id": count.id,
            "location_id": count.location_id,
            "count_date": str(count.count_date),
            "count_type": count.count_type,
            "status": count.status,
            "counted_by": count.counted_by,
            "notes": count.notes,
            "line_count": len(lines),
            "total_value": round(total_value, 2),
            "lines": lines,
            "created_at": count.created_at,
            "updated_at": count.updated_at,
        }


async def create_inventory_count(data: Dict[str, Any]) -> InventoryCount:
    """Create a new inventory count header."""
    lines_data = data.pop("lines", [])
    async with get_session() as session:
        count = InventoryCount(**data)
        session.add(count)
        await session.flush()
        for line_data in lines_data:
            line_data["count_id"] = count.id
            session.add(InventoryCountLine(**line_data))
        await session.commit()
        await session.refresh(count)
        return count


async def submit_inventory_count(
    count_id: uuid.UUID,
    lines: list[Dict[str, Any]],
    status: str = "completed",
) -> Optional[dict]:
    """Submit count lines and optionally complete the count. Updates workspace inventory."""
    async with get_session() as session:
        result = await session.execute(
            select(InventoryCount).where(InventoryCount.id == count_id)
        )
        count = result.scalar_one_or_none()
        if count is None:
            return None

        # Add lines
        for line_data in lines:
            line_data["count_id"] = count_id
            if "item_id" in line_data and isinstance(line_data["item_id"], str):
                line_data["item_id"] = uuid.UUID(line_data["item_id"])
            if "quantity" in line_data and isinstance(line_data["quantity"], str):
                line_data["quantity"] = Decimal(line_data["quantity"])
            if "unit_cost" in line_data and isinstance(line_data["unit_cost"], str):
                line_data["unit_cost"] = Decimal(line_data["unit_cost"])
            session.add(InventoryCountLine(**line_data))

        count.status = status
        await session.commit()
        return await get_inventory_count(count_id)


# ---------------------------------------------------------------------------
# Par Levels (operational)
# ---------------------------------------------------------------------------

async def list_par_levels(
    location_id: Optional[uuid.UUID] = None,
) -> list[dict]:
    """List par levels with item names and current on-hand from workspace inventory."""
    async with get_session() as session:
        stmt = (
            select(ParLevel, Item.name.label("item_name"))
            .join(Item, ParLevel.item_id == Item.id)
            .order_by(Item.name)
        )
        if location_id:
            stmt = stmt.where(ParLevel.location_id == location_id)
        result = await session.execute(stmt)
        rows = []
        for par, item_name in result.all():
            # Try to find matching workspace inventory for on_hand
            ws_stmt = select(WorkspaceInventory.on_hand).where(
                WorkspaceInventory.item_name == item_name
            )
            if location_id:
                ws_stmt = ws_stmt.where(WorkspaceInventory.location_id == location_id)
            ws_result = await session.execute(ws_stmt)
            on_hand_str = ws_result.scalar_one_or_none()
            on_hand_num = 0.0
            if on_hand_str:
                try:
                    on_hand_num = float(on_hand_str.split()[0])
                except (ValueError, IndexError):
                    pass
            shortfall = on_hand_num - float(par.min_quantity)
            rows.append({
                "id": par.id,
                "location_id": par.location_id,
                "item_id": par.item_id,
                "item_name": item_name,
                "min_quantity": float(par.min_quantity),
                "on_hand": on_hand_str,
                "shortfall": shortfall,
                "day_of_week": par.day_of_week,
                "created_at": par.created_at,
                "updated_at": par.updated_at,
            })
        return rows


async def set_par_level(data: Dict[str, Any]) -> ParLevel:
    """Create or update a par level for an item at a location."""
    async with get_session() as session:
        item_id = data["item_id"]
        location_id = data["location_id"]
        day_of_week = data.get("day_of_week")

        stmt = select(ParLevel).where(
            ParLevel.item_id == item_id,
            ParLevel.location_id == location_id,
        )
        if day_of_week is not None:
            stmt = stmt.where(ParLevel.day_of_week == day_of_week)
        else:
            stmt = stmt.where(ParLevel.day_of_week.is_(None))

        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.min_quantity = data["min_quantity"]
            await session.commit()
            await session.refresh(existing)
            return existing
        else:
            par = ParLevel(**data)
            session.add(par)
            await session.commit()
            await session.refresh(par)
            return par


# ---------------------------------------------------------------------------
# Waste Logs (operational)
# ---------------------------------------------------------------------------

async def list_waste_logs(
    location_id: Optional[uuid.UUID] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> list[dict]:
    """List waste logs with item names."""
    async with get_session() as session:
        stmt = (
            select(WasteLog, Item.name.label("item_name"))
            .join(Item, WasteLog.item_id == Item.id)
            .order_by(WasteLog.waste_date.desc())
        )
        if location_id:
            stmt = stmt.where(WasteLog.location_id == location_id)
        if date_from:
            stmt = stmt.where(WasteLog.waste_date >= date_from)
        if date_to:
            stmt = stmt.where(WasteLog.waste_date <= date_to)
        result = await session.execute(stmt)
        rows = []
        for waste, item_name in result.all():
            rows.append({
                "id": waste.id,
                "location_id": waste.location_id,
                "item_id": waste.item_id,
                "item_name": item_name,
                "quantity": float(waste.quantity),
                "unit": waste.unit,
                "reason": waste.reason,
                "notes": waste.notes,
                "waste_date": str(waste.waste_date),
                "estimated_cost": float(waste.estimated_cost) if waste.estimated_cost else None,
                "created_at": waste.created_at,
                "updated_at": waste.updated_at,
            })
        return rows


async def create_waste_log(data: Dict[str, Any]) -> WasteLog:
    """Create a new waste log entry."""
    async with get_session() as session:
        waste = WasteLog(**data)
        session.add(waste)
        await session.commit()
        await session.refresh(waste)
        return waste


# ---------------------------------------------------------------------------
# Items (master catalog)
# ---------------------------------------------------------------------------

async def list_items(active_only: bool = True) -> Sequence[Item]:
    """List all items from the master catalog."""
    async with get_session() as session:
        stmt = select(Item).order_by(Item.name)
        if active_only:
            stmt = stmt.where(Item.is_active == True)  # noqa: E712
        result = await session.execute(stmt)
        return result.scalars().all()


async def get_item(item_id: uuid.UUID) -> Optional[Item]:
    """Get a single item by ID."""
    async with get_session() as session:
        result = await session.execute(select(Item).where(Item.id == item_id))
        return result.scalar_one_or_none()


async def create_item(data: Dict[str, Any]) -> Item:
    """Create a new item in the master catalog."""
    async with get_session() as session:
        item = Item(**data)
        session.add(item)
        await session.commit()
        await session.refresh(item)
        return item


async def update_item(item_id: uuid.UUID, data: Dict[str, Any]) -> Optional[Item]:
    """Update an item in the master catalog."""
    async with get_session() as session:
        result = await session.execute(select(Item).where(Item.id == item_id))
        item = result.scalar_one_or_none()
        if item is None:
            return None
        for key, value in data.items():
            setattr(item, key, value)
        await session.commit()
        await session.refresh(item)
        return item


# ---------------------------------------------------------------------------
# Inventory Valuation
# ---------------------------------------------------------------------------

async def get_inventory_valuation(
    location_id: Optional[uuid.UUID] = None,
) -> dict:
    """Calculate total inventory value from workspace inventory."""
    async with get_session() as session:
        stmt = select(WorkspaceInventory)
        if location_id:
            stmt = stmt.where(WorkspaceInventory.location_id == location_id)
        result = await session.execute(stmt)
        rows = result.scalars().all()

        total_value = 0.0
        counted = 0
        for row in rows:
            try:
                on_hand = float(row.on_hand.split()[0]) if row.on_hand else 0
                cost = float(row.unit_cost) if row.unit_cost else 0
                total_value += on_hand * cost
                if cost > 0:
                    counted += 1
            except (ValueError, IndexError, AttributeError):
                pass

        return {
            "total_value": round(total_value, 2),
            "item_count": counted,
            "location_id": location_id,
        }
