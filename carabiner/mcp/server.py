"""CarabinerOS PostgreSQL MCP Server.

Stdio-based MCP server that exposes CRUD operations for all workspace
entities. Agent Zero launches this as a subprocess and auto-discovers
the tools.

Usage:
    python -m carabiner.mcp.server
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Bootstrap: ensure the DB engine is initialised before any tool runs
# ---------------------------------------------------------------------------

_db_initialised = False


async def _ensure_db() -> None:
    """Lazy-init the async DB engine on first tool call."""
    global _db_initialised
    if _db_initialised:
        return
    from carabiner.db.engine import init_db

    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://carabiner:carabiner@localhost:5432/carabiner",
    )
    await init_db(db_url)
    _db_initialised = True


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------


def _serialise(obj: Any) -> Any:
    """Convert a SQLAlchemy model instance (or sequence) to JSON-safe dicts."""
    if obj is None:
        return None
    if isinstance(obj, (list, tuple)):
        return [_serialise(item) for item in obj]
    if isinstance(obj, dict):
        return {k: _serialise(v) for k, v in obj.items()}
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()

    # SQLAlchemy model — convert via __dict__
    if hasattr(obj, "__dict__"):
        result: dict[str, Any] = {}
        for key, value in obj.__dict__.items():
            if key.startswith("_"):
                continue
            result[key] = _serialise(value)
        return result

    return str(obj)


def _parse_uuid(value: str) -> uuid.UUID:
    """Parse a string into a UUID, raising a clear error on failure."""
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"Invalid UUID: {value!r}") from exc


# ---------------------------------------------------------------------------
# MCP Server
# ---------------------------------------------------------------------------

mcp = FastMCP(
    "carabiner_db",
    json_response=True,
)

# ===== INVENTORY =====


@mcp.tool()
async def inventory_list(location_id: Optional[str] = None) -> str:
    """List all inventory items. Optionally filter by location_id (UUID string)."""
    await _ensure_db()
    from carabiner.db.repositories import list_inventory

    loc = _parse_uuid(location_id) if location_id else None
    rows = await list_inventory(location_id=loc)
    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def inventory_get(id: str) -> str:
    """Get a single inventory item by its UUID."""
    await _ensure_db()
    from carabiner.db.repositories import get_inventory

    row = await get_inventory(_parse_uuid(id))
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def inventory_create(data: str) -> str:
    """Create a new inventory item. `data` is a JSON string with fields: location_id, item_name, on_hand, par, variance. Optional: summary, detail_points, prompt."""
    await _ensure_db()
    from carabiner.db.repositories import create_inventory

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await create_inventory(parsed)
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def inventory_update(id: str, data: str) -> str:
    """Update an inventory item by UUID. `data` is a JSON string with fields to update."""
    await _ensure_db()
    from carabiner.db.repositories import update_inventory

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await update_inventory(_parse_uuid(id), parsed)
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def inventory_delete(id: str) -> str:
    """Delete an inventory item by UUID. Returns success status."""
    await _ensure_db()
    from carabiner.db.repositories import delete_inventory

    deleted = await delete_inventory(_parse_uuid(id))
    return json.dumps({"deleted": deleted, "id": id})


# ===== ORDERS =====


@mcp.tool()
async def orders_list(location_id: Optional[str] = None) -> str:
    """List all orders. Optionally filter by location_id (UUID string)."""
    await _ensure_db()
    from carabiner.db.repositories import list_orders

    loc = _parse_uuid(location_id) if location_id else None
    rows = await list_orders(location_id=loc)
    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def orders_get(id: str) -> str:
    """Get a single order by its UUID."""
    await _ensure_db()
    from carabiner.db.repositories import get_order

    row = await get_order(_parse_uuid(id))
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def orders_create(data: str) -> str:
    """Create a new order. `data` is a JSON string with fields: location_id, vendor, channel, status, total. Optional: eta, line_items, summary, detail_points, prompt."""
    await _ensure_db()
    from carabiner.db.repositories import create_order

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await create_order(parsed)
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def orders_update(id: str, data: str) -> str:
    """Update an order by UUID. `data` is a JSON string with fields to update."""
    await _ensure_db()
    from carabiner.db.repositories import update_order

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await update_order(_parse_uuid(id), parsed)
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def orders_delete(id: str) -> str:
    """Delete an order by UUID. Returns success status."""
    await _ensure_db()
    from carabiner.db.repositories import delete_order

    deleted = await delete_order(_parse_uuid(id))
    return json.dumps({"deleted": deleted, "id": id})


# ===== PREP =====


@mcp.tool()
async def prep_list(location_id: Optional[str] = None) -> str:
    """List all prep tasks. Optionally filter by location_id (UUID string)."""
    await _ensure_db()
    from carabiner.db.repositories import list_prep

    loc = _parse_uuid(location_id) if location_id else None
    rows = await list_prep(location_id=loc)
    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def prep_get(id: str) -> str:
    """Get a single prep task by its UUID."""
    await _ensure_db()
    from carabiner.db.repositories import get_prep

    row = await get_prep(_parse_uuid(id))
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def prep_create(data: str) -> str:
    """Create a new prep task. `data` is a JSON string with fields: location_id, service_lane, task, station, readiness. Optional: shortage, summary, detail_points, prompt."""
    await _ensure_db()
    from carabiner.db.repositories import create_prep

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await create_prep(parsed)
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def prep_update(id: str, data: str) -> str:
    """Update a prep task by UUID. `data` is a JSON string with fields to update."""
    await _ensure_db()
    from carabiner.db.repositories import update_prep

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await update_prep(_parse_uuid(id), parsed)
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def prep_delete(id: str) -> str:
    """Delete a prep task by UUID. Returns success status."""
    await _ensure_db()
    from carabiner.db.repositories import delete_prep

    deleted = await delete_prep(_parse_uuid(id))
    return json.dumps({"deleted": deleted, "id": id})


# ===== INVOICES =====


@mcp.tool()
async def invoices_list(location_id: Optional[str] = None) -> str:
    """List all invoices. Optionally filter by location_id (UUID string)."""
    await _ensure_db()
    from carabiner.db.repositories import list_invoices

    loc = _parse_uuid(location_id) if location_id else None
    rows = await list_invoices(location_id=loc)
    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def invoices_get(id: str) -> str:
    """Get a single invoice by its UUID."""
    await _ensure_db()
    from carabiner.db.repositories import get_invoice

    row = await get_invoice(_parse_uuid(id))
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def invoices_create(data: str) -> str:
    """Create a new invoice. `data` is a JSON string with fields: location_id, status. Optional: vendor_name, invoice_number, invoice_date, due_date, file_path, file_mime, source, subtotal, tax, total, line_items, gl_codes, extracted_data, summary, detail_points, prompt."""
    await _ensure_db()
    from carabiner.db.repositories import create_invoice

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await create_invoice(parsed)
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def invoices_update(id: str, data: str) -> str:
    """Update an invoice by UUID. `data` is a JSON string with fields to update."""
    await _ensure_db()
    from carabiner.db.repositories import update_invoice

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await update_invoice(_parse_uuid(id), parsed)
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def invoices_delete(id: str) -> str:
    """Delete an invoice by UUID. Returns success status."""
    await _ensure_db()
    from carabiner.db.repositories import delete_invoice

    deleted = await delete_invoice(_parse_uuid(id))
    return json.dumps({"deleted": deleted, "id": id})


# ===== RECIPES =====


@mcp.tool()
async def recipes_list(
    location_id: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> str:
    """List recipes. Optional filters: location_id (UUID), status, category, search (name substring)."""
    await _ensure_db()
    from carabiner.db.repositories import list_recipes

    loc = _parse_uuid(location_id) if location_id else None
    rows = await list_recipes(location_id=loc, status=status, category=category, search=search)
    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def recipes_get(id: str) -> str:
    """Get a recipe by UUID, including nested components, ingredients, and steps."""
    await _ensure_db()
    from carabiner.db.repositories import get_recipe

    row = await get_recipe(_parse_uuid(id))
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def recipes_create(data: str) -> str:
    """Create a new recipe. `data` is a JSON string with fields: location_id, name, category. Optional: description, status, yield_quantity, yield_unit, total_weight_g, total_cost, cost_per_serving, image_url, source, equipment, notes, tags, components (array of {name, sort_order, yield_quantity, yield_unit, ingredients: [{name, weight_g, ...}], steps: [{step_number, instruction, ...}]})."""
    await _ensure_db()
    from carabiner.db.repositories import create_recipe

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await create_recipe(parsed)
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def recipes_update(id: str, data: str) -> str:
    """Update a recipe by UUID. `data` is a JSON string with fields to update. If components are provided, they replace all existing components."""
    await _ensure_db()
    from carabiner.db.repositories import update_recipe

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await update_recipe(_parse_uuid(id), parsed)
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def recipes_delete(id: str) -> str:
    """Delete a recipe by UUID (cascades to components, ingredients, steps). Returns success status."""
    await _ensure_db()
    from carabiner.db.repositories import delete_recipe

    deleted = await delete_recipe(_parse_uuid(id))
    return json.dumps({"deleted": deleted, "id": id})


# ===== MENU ITEMS =====


@mcp.tool()
async def menu_list(location_id: Optional[str] = None) -> str:
    """List all menu items. Optionally filter by location_id (UUID string)."""
    await _ensure_db()
    from carabiner.db.repositories import list_menu

    loc = _parse_uuid(location_id) if location_id else None
    rows = await list_menu(location_id=loc)
    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def menu_get(id: str) -> str:
    """Get a single menu item by its UUID."""
    await _ensure_db()
    from carabiner.db.repositories import get_menu

    row = await get_menu(_parse_uuid(id))
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def menu_create(data: str) -> str:
    """Create a new menu item. `data` is a JSON string with fields: location_id, item_name, category, performance, margin_pct, recommendation. Optional: recipe, recipe_id, summary, detail_points, prompt."""
    await _ensure_db()
    from carabiner.db.repositories import create_menu

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    if "recipe_id" in parsed and parsed["recipe_id"]:
        parsed["recipe_id"] = _parse_uuid(parsed["recipe_id"])
    row = await create_menu(parsed)
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def menu_update(id: str, data: str) -> str:
    """Update a menu item by UUID. `data` is a JSON string with fields to update."""
    await _ensure_db()
    from carabiner.db.repositories import update_menu

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    if "recipe_id" in parsed and parsed["recipe_id"]:
        parsed["recipe_id"] = _parse_uuid(parsed["recipe_id"])
    row = await update_menu(_parse_uuid(id), parsed)
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def menu_delete(id: str) -> str:
    """Delete a menu item by UUID. Returns success status."""
    await _ensure_db()
    from carabiner.db.repositories import delete_menu

    deleted = await delete_menu(_parse_uuid(id))
    return json.dumps({"deleted": deleted, "id": id})


# ===== FOOD COST =====


@mcp.tool()
async def food_cost_list(location_id: Optional[str] = None) -> str:
    """List all food cost entries. Optionally filter by location_id (UUID string)."""
    await _ensure_db()
    from carabiner.db.repositories import list_food_cost

    loc = _parse_uuid(location_id) if location_id else None
    rows = await list_food_cost(location_id=loc)
    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def food_cost_get(id: str) -> str:
    """Get a single food cost entry by its UUID."""
    await _ensure_db()
    from carabiner.db.repositories import get_food_cost

    row = await get_food_cost(_parse_uuid(id))
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def food_cost_create(data: str) -> str:
    """Create a new food cost entry. `data` is a JSON string with fields: location_id, menu_item_name, pressure, current_cost_pct, action. Optional: summary, detail_points, prompt."""
    await _ensure_db()
    from carabiner.db.repositories import create_food_cost

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await create_food_cost(parsed)
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def food_cost_update(id: str, data: str) -> str:
    """Update a food cost entry by UUID. `data` is a JSON string with fields to update."""
    await _ensure_db()
    from carabiner.db.repositories import update_food_cost

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await update_food_cost(_parse_uuid(id), parsed)
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def food_cost_delete(id: str) -> str:
    """Delete a food cost entry by UUID. Returns success status."""
    await _ensure_db()
    from carabiner.db.repositories import delete_food_cost

    deleted = await delete_food_cost(_parse_uuid(id))
    return json.dumps({"deleted": deleted, "id": id})


# ===== CAMPAIGNS (Marketing) =====


@mcp.tool()
async def campaigns_list(location_id: Optional[str] = None) -> str:
    """List all marketing campaigns. Optionally filter by location_id (UUID string)."""
    await _ensure_db()
    from carabiner.db.repositories import list_campaigns

    loc = _parse_uuid(location_id) if location_id else None
    rows = await list_campaigns(location_id=loc)
    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def campaigns_get(id: str) -> str:
    """Get a single marketing campaign by its UUID."""
    await _ensure_db()
    from carabiner.db.repositories import get_campaign

    row = await get_campaign(_parse_uuid(id))
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def campaigns_create(data: str) -> str:
    """Create a new marketing campaign. `data` is a JSON string with fields: location_id, campaign_name, channel, stage, deliverable. Optional: summary, detail_points, prompt."""
    await _ensure_db()
    from carabiner.db.repositories import create_campaign

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await create_campaign(parsed)
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def campaigns_update(id: str, data: str) -> str:
    """Update a marketing campaign by UUID. `data` is a JSON string with fields to update."""
    await _ensure_db()
    from carabiner.db.repositories import update_campaign

    parsed = json.loads(data)
    if "location_id" in parsed:
        parsed["location_id"] = _parse_uuid(parsed["location_id"])
    row = await update_campaign(_parse_uuid(id), parsed)
    if row is None:
        return json.dumps({"error": "not_found", "id": id})
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def campaigns_delete(id: str) -> str:
    """Delete a marketing campaign by UUID. Returns success status."""
    await _ensure_db()
    from carabiner.db.repositories import delete_campaign

    deleted = await delete_campaign(_parse_uuid(id))
    return json.dumps({"deleted": deleted, "id": id})


# ---------------------------------------------------------------------------
# Entry point — stdio transport for Agent Zero subprocess
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run(transport="stdio")
