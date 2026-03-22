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
    """Parse a string into a UUID, handling Python repr format."""
    if isinstance(value, uuid.UUID):
        return value
    value = str(value).strip()
    # Handle UUID('...') repr format from LLMs
    if value.upper().startswith("UUID(") and value.endswith(")"):
        value = value[5:-1].strip("'\"")
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError) as exc:
        raise ValueError(f"Invalid UUID: {value!r}") from exc


async def _default_location_id() -> uuid.UUID:
    """Return the first available location UUID as a fallback."""
    await _ensure_db()
    from carabiner.db.repositories import list_locations

    rows = await list_locations()
    if not rows:
        raise ValueError("No locations found in database")
    return rows[0].id


async def _resolve_location_id(parsed: dict) -> dict:
    """Ensure parsed dict has a valid location_id, defaulting to first location."""
    loc = parsed.get("location_id")
    if not loc or loc in ("unknown", "null", "none", ""):
        parsed["location_id"] = await _default_location_id()
    else:
        parsed["location_id"] = _parse_uuid(loc)
    return parsed


# ---------------------------------------------------------------------------
# MCP Server
# ---------------------------------------------------------------------------

mcp = FastMCP(
    "carabiner_db",
    json_response=True,
)

# ===================================================================
# SMART ROUTER TOOLS — 3 high-level tools that replace 40 individual
# CRUD operations. Reduces system-prompt token cost from ~16k to ~800.
# ===================================================================

# Maps module name -> (list_fn, get_fn, create_fn, update_fn, delete_fn)
# Each value is the import name from carabiner.db.repositories.
_MODULE_REGISTRY: dict[str, dict[str, str]] = {
    "inventory": {
        "list": "list_inventory",
        "get": "get_inventory",
        "create": "create_inventory",
        "update": "update_inventory",
        "delete": "delete_inventory",
    },
    "orders": {
        "list": "list_orders",
        "get": "get_order",
        "create": "create_order",
        "update": "update_order",
        "delete": "delete_order",
    },
    "prep": {
        "list": "list_prep",
        "get": "get_prep",
        "create": "create_prep",
        "update": "update_prep",
        "delete": "delete_prep",
    },
    "invoices": {
        "list": "list_invoices",
        "get": "get_invoice",
        "create": "create_invoice",
        "update": "update_invoice",
        "delete": "delete_invoice",
    },
    "recipes": {
        "list": "list_recipes",
        "get": "get_recipe",
        "create": "create_recipe",
        "update": "update_recipe",
        "delete": "delete_recipe",
    },
    "menu": {
        "list": "list_menu",
        "get": "get_menu",
        "create": "create_menu",
        "update": "update_menu",
        "delete": "delete_menu",
    },
    "food_cost": {
        "list": "list_food_cost",
        "get": "get_food_cost",
        "create": "create_food_cost",
        "update": "update_food_cost",
        "delete": "delete_food_cost",
    },
    "campaigns": {
        "list": "list_campaigns",
        "get": "get_campaign",
        "create": "create_campaign",
        "update": "update_campaign",
        "delete": "delete_campaign",
    },
}

_VALID_MODULES = sorted(_MODULE_REGISTRY.keys())
_VALID_ACTIONS = ("create", "update", "delete")


async def _resolve_repo_fn(module: str, action: str) -> Any:
    """Dynamically import and return a repository function by module+action."""
    import importlib

    repo = importlib.import_module("carabiner.db.repositories")
    fn_name = _MODULE_REGISTRY[module][action]
    return getattr(repo, fn_name)


def _coerce_types_for_model(model_cls: type, data: dict[str, Any]) -> dict[str, Any]:
    """Coerce string values to match SQLAlchemy column types on *model_cls*.

    - sa.Numeric  -> Decimal
    - sa.Integer  -> int
    - sa.Float    -> float
    - UUID columns -> uuid.UUID (via _parse_uuid)
    - None values and already-correct types are skipped.
    """
    import sqlalchemy as sa
    from sqlalchemy.dialects.postgresql import UUID as PG_UUID

    data = dict(data)  # shallow copy
    table = model_cls.__table__
    for col_name, col_obj in table.columns.items():
        if col_name not in data or data[col_name] is None:
            continue
        col_type = col_obj.type
        value = data[col_name]

        # UUID columns
        if isinstance(col_type, (PG_UUID, sa.Uuid)):
            if not isinstance(value, uuid.UUID):
                data[col_name] = _parse_uuid(value)
        # Numeric columns -> Decimal
        elif isinstance(col_type, sa.Numeric) and not isinstance(col_type, sa.Float):
            if isinstance(value, str):
                data[col_name] = Decimal(value)
        # Integer columns -> int
        elif isinstance(col_type, sa.Integer):
            if isinstance(value, str):
                data[col_name] = int(value)
        # Float columns -> float
        elif isinstance(col_type, sa.Float):
            if isinstance(value, str):
                data[col_name] = float(value)
    return data


# Module name -> workspace model class (lazy-resolved)
_MODULE_MODEL_MAP: dict[str, str] = {
    "orders": "WorkspaceOrder",
    "inventory": "WorkspaceInventory",
    "prep": "WorkspacePrep",
    "food_cost": "WorkspaceFoodCost",
    "menu": "WorkspaceMenu",
    "campaigns": "WorkspaceCampaign",
    "invoices": "WorkspaceInvoice",
    "recipes": "WorkspaceRecipe",
}


def _coerce_types(module: str, data: dict[str, Any]) -> dict[str, Any]:
    """Coerce string values in *data* to match the column types for *module*."""
    class_name = _MODULE_MODEL_MAP.get(module)
    if class_name is None:
        return data
    import carabiner.db.workspace_models as wm

    model_cls = getattr(wm, class_name, None)
    if model_cls is None:
        return data
    return _coerce_types_for_model(model_cls, data)


def _prepare_data(module: str, data: dict[str, Any]) -> dict[str, Any]:
    """Coerce types and parse UUID fields before passing to the repository."""
    data = _coerce_types(module, data)
    return data


@mcp.tool()
async def db_query(module: str, filters: Optional[str] = None) -> str:
    """Query restaurant data from any module.

Args:
    module: One of: campaigns, food_cost, inventory, invoices, menu, orders, prep, recipes.
    filters: Optional JSON string with filter fields. Common: {"location_id": "uuid"}.
             Recipes also accept: status, category, search (name substring).
             Pass {"id": "uuid"} to fetch a single record by its primary key.

Examples:
    db_query(module="inventory")
    db_query(module="inventory", filters='{"location_id": "abc-123"}')
    db_query(module="orders", filters='{"id": "order-uuid-here"}')
    db_query(module="recipes", filters='{"category": "desserts", "status": "active"}')
"""
    await _ensure_db()

    if module not in _MODULE_REGISTRY:
        return json.dumps({
            "error": "invalid_module",
            "message": f"Unknown module {module!r}. Valid modules: {_VALID_MODULES}",
        })

    try:
        parsed_filters: dict[str, Any] = json.loads(filters) if filters else {}
    except json.JSONDecodeError as exc:
        return json.dumps({
            "error": "invalid_filters",
            "message": f"Could not parse filters JSON: {exc}",
        })

    # Single-record lookup by id
    if "id" in parsed_filters:
        fn = await _resolve_repo_fn(module, "get")
        row = await fn(_parse_uuid(parsed_filters["id"]))
        if row is None:
            return json.dumps({"error": "not_found", "id": parsed_filters["id"]})
        return json.dumps(_serialise(row), default=str)

    # List with optional filters
    fn = await _resolve_repo_fn(module, "list")
    kwargs: dict[str, Any] = {}
    if "location_id" in parsed_filters:
        kwargs["location_id"] = _parse_uuid(parsed_filters["location_id"])
    # Recipes support extra filter kwargs
    if module == "recipes":
        for key in ("status", "category", "search"):
            if key in parsed_filters:
                kwargs[key] = parsed_filters[key]

    rows = await fn(**kwargs)
    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def db_mutate(module: str, action: str, data: str) -> str:
    """Create, update, or delete a record in any module.

Args:
    module: One of: campaigns, food_cost, inventory, invoices, menu, orders, prep, recipes.
    action: One of: create, update, delete.
    data: JSON string with record fields.
          - create: include all required fields for the module (e.g. location_id, item_name, ...).
          - update: must include "id" (UUID of record to update) plus fields to change.
          - delete: must include "id" (UUID of record to delete).

Examples:
    db_mutate(module="inventory", action="create", data='{"location_id":"abc","item_name":"Tomatoes","on_hand":50,"par":100,"variance":-50}')
    db_mutate(module="orders", action="update", data='{"id":"order-uuid","status":"completed"}')
    db_mutate(module="prep", action="delete", data='{"id":"task-uuid"}')
"""
    await _ensure_db()

    if module not in _MODULE_REGISTRY:
        return json.dumps({
            "error": "invalid_module",
            "message": f"Unknown module {module!r}. Valid modules: {_VALID_MODULES}",
        })

    if action not in _VALID_ACTIONS:
        return json.dumps({
            "error": "invalid_action",
            "message": f"Unknown action {action!r}. Valid actions: {list(_VALID_ACTIONS)}",
        })

    try:
        parsed: dict[str, Any] = json.loads(data)
    except json.JSONDecodeError as exc:
        return json.dumps({
            "error": "invalid_data",
            "message": f"Could not parse data JSON: {exc}",
        })

    fn = await _resolve_repo_fn(module, action)
    prepared = _prepare_data(module, parsed)

    if action == "create":
        prepared = await _resolve_location_id(prepared)
        row = await fn(prepared)
        return json.dumps(_serialise(row), default=str)

    elif action == "update":
        record_id = prepared.pop("id", None)
        if not record_id:
            return json.dumps({
                "error": "missing_id",
                "message": "Update requires an 'id' field in data.",
            })
        row = await fn(_parse_uuid(str(record_id)), prepared)
        if row is None:
            return json.dumps({"error": "not_found", "id": str(record_id)})
        return json.dumps(_serialise(row), default=str)

    else:  # delete
        record_id = parsed.get("id")
        if not record_id:
            return json.dumps({
                "error": "missing_id",
                "message": "Delete requires an 'id' field in data.",
            })
        deleted = await fn(_parse_uuid(str(record_id)))
        return json.dumps({"deleted": deleted, "id": str(record_id)})


@mcp.tool()
async def db_batch(operations: str) -> str:
    """Execute multiple database operations in one call.

Args:
    operations: JSON string containing an array of operation objects.
                Each object has: module, action, data (optional filters for "query" action).
                action is one of: query, create, update, delete.

Example:
    db_batch(operations='[
        {"module": "inventory", "action": "query", "data": {"location_id": "abc"}},
        {"module": "orders", "action": "query", "data": {"id": "order-uuid"}},
        {"module": "prep", "action": "create", "data": {"location_id": "abc", "task": "Dice onions", "station": "Prep", "readiness": "pending"}}
    ]')

Returns a JSON array of results, one per operation, in the same order.
Each result is either the operation output or {"error": "...", "message": "..."}.
"""
    await _ensure_db()

    try:
        ops: list[dict[str, Any]] = json.loads(operations)
    except json.JSONDecodeError as exc:
        return json.dumps({
            "error": "invalid_operations",
            "message": f"Could not parse operations JSON: {exc}",
        })

    if not isinstance(ops, list):
        return json.dumps({
            "error": "invalid_operations",
            "message": "operations must be a JSON array of {module, action, data} objects.",
        })

    results: list[Any] = []
    for i, op in enumerate(ops):
        try:
            mod = op.get("module", "")
            act = op.get("action", "")
            op_data = op.get("data", {})

            if act == "query":
                # Route through db_query logic
                filters_str = json.dumps(op_data) if op_data else None
                result = await db_query(module=mod, filters=filters_str)
            else:
                # Route through db_mutate logic
                data_str = json.dumps(op_data) if op_data else "{}"
                result = await db_mutate(module=mod, action=act, data=data_str)

            results.append(json.loads(result))
        except Exception as exc:
            results.append({
                "error": "operation_failed",
                "index": i,
                "message": str(exc),
            })

    return json.dumps(results, default=str)


# ===================================================================
# LEGACY INDIVIDUAL TOOLS — will be removed after router validation.
# Kept for backward compatibility during the transition period.
# ===================================================================

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
    parsed = await _resolve_location_id(parsed)
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


# ===== ORDERS ===== (legacy)


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
    parsed = await _resolve_location_id(parsed)
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


# ===== PREP ===== (legacy)


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
    parsed = await _resolve_location_id(parsed)
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


# ===== INVOICES ===== (legacy)


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
    parsed = await _resolve_location_id(parsed)
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


# ===== RECIPES ===== (legacy)


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
    parsed = await _resolve_location_id(parsed)
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


# ===== MENU ITEMS ===== (legacy)


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
    parsed = await _resolve_location_id(parsed)
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


# ===== FOOD COST ===== (legacy)


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
    parsed = await _resolve_location_id(parsed)
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


# ===== CAMPAIGNS (Marketing) ===== (legacy)


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
    parsed = await _resolve_location_id(parsed)
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
