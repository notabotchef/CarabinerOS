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


# ===== INVENTORY OPERATIONS (counts, par levels, waste) =====


@mcp.tool()
async def inventory_count_start(
    count_type: str,
    location_id: Optional[str] = None,
    counted_by: Optional[str] = None,
    notes: Optional[str] = None,
) -> str:
    """Start a new inventory count. Returns the count header with ID.

Args:
    count_type: One of: full, spot, walk_in.
    location_id: UUID of location (defaults to first location).
    counted_by: Name of person performing the count.
    notes: Optional notes about this count.
"""
    await _ensure_db()
    from carabiner.db.repositories import create_inventory_count
    from datetime import date as date_cls

    data: dict = {
        "count_type": count_type,
        "count_date": date_cls.today(),
        "status": "in_progress",
    }
    if counted_by:
        data["counted_by"] = counted_by
    if notes:
        data["notes"] = notes

    if location_id:
        data["location_id"] = _parse_uuid(location_id)
    else:
        data["location_id"] = await _default_location_id()

    row = await create_inventory_count(data)
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def inventory_count_submit(
    count_id: str,
    lines: str,
    status: str = "completed",
) -> str:
    """Submit line items for an inventory count and optionally complete it.

Args:
    count_id: UUID of the inventory count to update.
    lines: JSON array of line items. Each: {"item_id": "uuid", "quantity": number, "unit_cost": number, "storage_area": "optional"}.
    status: New status — "in_progress" or "completed" (default: completed).
"""
    await _ensure_db()
    from carabiner.db.repositories import submit_inventory_count

    parsed_lines = json.loads(lines) if isinstance(lines, str) else lines
    result = await submit_inventory_count(
        _parse_uuid(count_id),
        parsed_lines,
        status=status,
    )
    if result is None:
        return json.dumps({"error": "not_found", "id": count_id})
    return json.dumps(_serialise(result), default=str)


@mcp.tool()
async def inventory_count_list(location_id: Optional[str] = None) -> str:
    """List past inventory counts with summary stats (line count, total value)."""
    await _ensure_db()
    from carabiner.db.repositories import list_inventory_counts

    loc = _parse_uuid(location_id) if location_id else None
    rows = await list_inventory_counts(location_id=loc)
    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def par_level_set(
    item_id: str,
    min_quantity: str,
    location_id: Optional[str] = None,
    day_of_week: Optional[int] = None,
) -> str:
    """Set a par level for an item. Creates or updates the par level.

Args:
    item_id: UUID of the item.
    min_quantity: Minimum quantity (par level).
    location_id: UUID of location (defaults to first location).
    day_of_week: Optional 0-6 (Mon-Sun). Null = all days.
"""
    await _ensure_db()
    from carabiner.db.repositories import set_par_level
    from decimal import Decimal

    data: dict = {
        "item_id": _parse_uuid(item_id),
        "min_quantity": Decimal(min_quantity),
    }
    if location_id:
        data["location_id"] = _parse_uuid(location_id)
    else:
        data["location_id"] = await _default_location_id()
    if day_of_week is not None:
        data["day_of_week"] = day_of_week

    row = await set_par_level(data)
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def par_level_list(location_id: Optional[str] = None) -> str:
    """List par levels for a location, showing current on-hand vs par and shortfall."""
    await _ensure_db()
    from carabiner.db.repositories import list_par_levels

    loc = _parse_uuid(location_id) if location_id else None
    rows = await list_par_levels(location_id=loc)
    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def waste_log_create(
    item_id: str,
    quantity: str,
    unit: str,
    reason: str,
    location_id: Optional[str] = None,
    notes: Optional[str] = None,
    waste_date: Optional[str] = None,
    estimated_cost: Optional[str] = None,
) -> str:
    """Log a waste entry.

Args:
    item_id: UUID of the item wasted.
    quantity: Amount wasted.
    unit: Unit of measure (lbs, cases, each, etc.).
    reason: One of: spoilage, overproduction, expired.
    location_id: UUID of location (defaults to first location).
    notes: Optional notes about the waste.
    waste_date: Date of waste (YYYY-MM-DD). Defaults to today.
    estimated_cost: Dollar cost of waste.
"""
    await _ensure_db()
    from carabiner.db.repositories import create_waste_log
    from datetime import date as date_cls
    from decimal import Decimal

    data: dict = {
        "item_id": _parse_uuid(item_id),
        "quantity": Decimal(quantity),
        "unit": unit,
        "reason": reason,
        "waste_date": date_cls.fromisoformat(waste_date) if waste_date else date_cls.today(),
    }
    if location_id:
        data["location_id"] = _parse_uuid(location_id)
    else:
        data["location_id"] = await _default_location_id()
    if notes:
        data["notes"] = notes
    if estimated_cost:
        data["estimated_cost"] = Decimal(estimated_cost)

    row = await create_waste_log(data)
    return json.dumps(_serialise(row), default=str)


@mcp.tool()
async def waste_log_list(
    location_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> str:
    """List waste logs with item names. Optional date range filter (YYYY-MM-DD)."""
    await _ensure_db()
    from carabiner.db.repositories import list_waste_logs
    from datetime import date as date_cls

    loc = _parse_uuid(location_id) if location_id else None
    df = date_cls.fromisoformat(date_from) if date_from else None
    dt = date_cls.fromisoformat(date_to) if date_to else None
    rows = await list_waste_logs(location_id=loc, date_from=df, date_to=dt)
    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def inventory_valuation(location_id: Optional[str] = None) -> str:
    """Get total inventory dollar value for a location. Returns {total_value, item_count}."""
    await _ensure_db()
    from carabiner.db.repositories import get_inventory_valuation

    loc = _parse_uuid(location_id) if location_id else None
    result = await get_inventory_valuation(location_id=loc)
    return json.dumps(_serialise(result), default=str)


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


# ===== MENU ENGINEERING ===== (Phase 1)


@mcp.tool()
async def menu_86(id: str, reason: str = "") -> str:
    """Mark a menu item as 86'd (unavailable). Logs the event for pattern analysis.

Args:
    id: UUID of the menu item to 86.
    reason: Why the item is being 86'd (e.g. "ran out of lobster", "supplier issue").

Example:
    menu_86(id="item-uuid", reason="ran out of lobster")
"""
    await _ensure_db()
    from carabiner.db.engine import get_session
    from carabiner.db.workspace_models import WorkspaceMenu, EightySixLog
    from sqlalchemy import select

    item_id = _parse_uuid(id)
    async with get_session() as session:
        result = await session.execute(
            select(WorkspaceMenu).where(WorkspaceMenu.id == item_id)
        )
        item = result.scalar_one_or_none()
        if item is None:
            return json.dumps({"error": "not_found", "id": id})

        if item.is_86:
            return json.dumps({"error": "already_86", "id": id, "item_name": item.item_name})

        item.is_86 = True
        item.eighty_six_reason = reason or None
        item.eighty_six_at = datetime.utcnow()

        log = EightySixLog(
            menu_item_id=item_id,
            location_id=item.location_id,
            action="86",
            reason=reason or None,
        )
        session.add(log)
        await session.commit()
        await session.refresh(item)

        return json.dumps({
            "ok": True,
            "action": "86",
            "id": str(item.id),
            "item_name": item.item_name,
            "reason": reason,
        })


@mcp.tool()
async def menu_un86(id: str) -> str:
    """Restore a menu item from 86 status (un-86 / 68). Resolves the open 86 log entry.

Args:
    id: UUID of the menu item to restore.

Example:
    menu_un86(id="item-uuid")
"""
    await _ensure_db()
    from carabiner.db.engine import get_session
    from carabiner.db.workspace_models import WorkspaceMenu, EightySixLog
    from sqlalchemy import select, and_

    item_id = _parse_uuid(id)
    async with get_session() as session:
        result = await session.execute(
            select(WorkspaceMenu).where(WorkspaceMenu.id == item_id)
        )
        item = result.scalar_one_or_none()
        if item is None:
            return json.dumps({"error": "not_found", "id": id})

        if not item.is_86:
            return json.dumps({"error": "not_86", "id": id, "item_name": item.item_name})

        item.is_86 = False
        item.eighty_six_reason = None
        item.eighty_six_at = None

        # Resolve the most recent open 86 log
        log_result = await session.execute(
            select(EightySixLog)
            .where(
                and_(
                    EightySixLog.menu_item_id == item_id,
                    EightySixLog.action == "86",
                    EightySixLog.resolved_at.is_(None),
                )
            )
            .order_by(EightySixLog.logged_at.desc())
            .limit(1)
        )
        open_log = log_result.scalar_one_or_none()
        if open_log:
            open_log.resolved_at = datetime.utcnow()

        # Also create a 68 (back on) log entry
        back_log = EightySixLog(
            menu_item_id=item_id,
            location_id=item.location_id,
            action="68",
        )
        session.add(back_log)
        await session.commit()

        return json.dumps({
            "ok": True,
            "action": "68",
            "id": str(item.id),
            "item_name": item.item_name,
        })


@mcp.tool()
async def menu_recalculate_matrix(location_id: Optional[str] = None) -> str:
    """Recalculate the menu engineering matrix (Star/Puzzle/Plowhorse/Dog) for all items.

    Uses contribution margin (price - food_cost) and menu mix % to classify items
    into the BCG-derived quadrants. Items without price/food_cost are skipped.

Args:
    location_id: Optional UUID to scope to one location. Omit to recalculate all.

Returns:
    Summary of reclassified items and any quadrant changes.
"""
    await _ensure_db()
    from carabiner.db.engine import get_session
    from carabiner.db.workspace_models import WorkspaceMenu, MenuItemHistory
    from sqlalchemy import select
    from decimal import Decimal

    async with get_session() as session:
        stmt = select(WorkspaceMenu).where(
            WorkspaceMenu.price.isnot(None),
            WorkspaceMenu.food_cost.isnot(None),
        )
        if location_id:
            stmt = stmt.where(WorkspaceMenu.location_id == _parse_uuid(location_id))

        result = await session.execute(stmt)
        items = list(result.scalars().all())

        if not items:
            return json.dumps({"ok": True, "message": "No items with price/food_cost to classify", "changes": []})

        # Calculate CM for each item
        for item in items:
            price = float(item.price) if item.price else 0
            cost = float(item.food_cost) if item.food_cost else 0
            cm = price - cost
            item.contribution_margin = Decimal(str(round(cm, 2)))
            item.food_cost_pct = Decimal(str(round((cost / price * 100) if price > 0 else 0, 2)))

        # Calculate total qty sold and weighted avg CM
        total_qty = sum(item.quantity_sold or 0 for item in items)
        if total_qty > 0:
            weighted_cm = sum(
                float(item.contribution_margin) * (item.quantity_sold or 0)
                for item in items
            ) / total_qty
        else:
            weighted_cm = sum(float(item.contribution_margin) for item in items) / len(items)

        # Calculate menu mix % and popularity threshold (70% rule)
        n_items = len(items)
        popularity_threshold = (1 / n_items) * 0.7 * 100 if n_items > 0 else 0

        for item in items:
            if total_qty > 0:
                mix_pct = ((item.quantity_sold or 0) / total_qty) * 100
            else:
                mix_pct = 100 / n_items if n_items > 0 else 0
            item.menu_mix_pct = Decimal(str(round(mix_pct, 2)))

        # Classify into quadrants
        changes = []
        for item in items:
            cm = float(item.contribution_margin)
            mix = float(item.menu_mix_pct)
            is_profitable = cm >= weighted_cm
            is_popular = mix >= popularity_threshold

            if is_profitable and is_popular:
                new_perf = "Star"
            elif is_profitable and not is_popular:
                new_perf = "Puzzle"
            elif not is_profitable and is_popular:
                new_perf = "Plowhorse"
            else:
                new_perf = "Dog"

            old_perf = item.performance
            if old_perf != new_perf:
                # Log the change
                history = MenuItemHistory(
                    menu_item_id=item.id,
                    field_changed="performance",
                    old_value=old_perf,
                    new_value=new_perf,
                    changed_by="agent",
                )
                session.add(history)
                changes.append({
                    "id": str(item.id),
                    "item_name": item.item_name,
                    "old": old_perf,
                    "new": new_perf,
                })

            item.performance = new_perf
            # Update margin_pct for backward compat
            item.margin_pct = f"{float(item.food_cost_pct):.1f}%"

        await session.commit()

        return json.dumps({
            "ok": True,
            "items_evaluated": len(items),
            "weighted_avg_cm": round(weighted_cm, 2),
            "popularity_threshold_pct": round(popularity_threshold, 2),
            "changes": changes,
        })


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


# ===== DAILY FOOD COST (Operational) =====


@mcp.tool()
async def daily_food_cost_list(
    start: Optional[str] = None,
    end: Optional[str] = None,
    location_id: Optional[str] = None,
) -> str:
    """Query daily food cost rows for a date range.

    Returns actual vs theoretical food cost data per day. Defaults to last 30 days.

    Args:
        start: Start date (YYYY-MM-DD). Defaults to 30 days ago.
        end: End date (YYYY-MM-DD). Defaults to today.
        location_id: Optional location UUID to filter by.

    Examples:
        daily_food_cost_list()
        daily_food_cost_list(start="2026-03-01", end="2026-03-24")
    """
    await _ensure_db()
    from datetime import date as _date, timedelta
    from carabiner.db.engine import get_session
    from carabiner.db.models import DailyFoodCost
    from sqlalchemy import select, and_

    today = _date.today()
    end_date = _date.fromisoformat(end) if end else today
    start_date = _date.fromisoformat(start) if start else end_date - timedelta(days=30)
    loc = _parse_uuid(location_id) if location_id else None

    async with get_session() as session:
        stmt = (
            select(DailyFoodCost)
            .where(and_(DailyFoodCost.cost_date >= start_date, DailyFoodCost.cost_date <= end_date))
            .order_by(DailyFoodCost.cost_date.asc())
        )
        if loc:
            stmt = stmt.where(DailyFoodCost.location_id == loc)
        result = await session.execute(stmt)
        rows = result.scalars().all()

    return json.dumps(_serialise(rows), default=str)


@mcp.tool()
async def food_cost_summary_kpis(location_id: Optional[str] = None) -> str:
    """Compute food cost KPIs: today's %, period %, budget vs actual, prime cost.

    Returns a summary object with today_food_cost_pct, period_food_cost_pct,
    budget_target_pct, budget_over_under, prime_cost_pct, and period totals.

    Args:
        location_id: Optional location UUID to scope the summary.

    Examples:
        food_cost_summary_kpis()
        food_cost_summary_kpis(location_id="abc-123")
    """
    await _ensure_db()
    from datetime import date as _date, timedelta
    from carabiner.db.engine import get_session
    from carabiner.db.models import BudgetPeriod, DailyFoodCost, DailyPL
    from sqlalchemy import select, and_, func

    today = _date.today()
    loc = _parse_uuid(location_id) if location_id else None
    out: dict = {}

    async with get_session() as session:
        today_stmt = select(DailyFoodCost).where(DailyFoodCost.cost_date == today)
        if loc:
            today_stmt = today_stmt.where(DailyFoodCost.location_id == loc)
        today_row = (await session.execute(today_stmt)).scalars().first()

        if today_row:
            out["today_food_cost_pct"] = float(today_row.food_cost_pct) if today_row.food_cost_pct else None
            out["today_sales"] = float(today_row.sales)
            out["today_purchases"] = float(today_row.purchases)

        bp_stmt = select(BudgetPeriod).where(
            and_(BudgetPeriod.period_start <= today, BudgetPeriod.period_end >= today)
        )
        if loc:
            bp_stmt = bp_stmt.where(BudgetPeriod.location_id == loc)
        budget = (await session.execute(bp_stmt)).scalars().first()

        period_start = budget.period_start if budget else today - timedelta(days=30)
        out["period_start"] = str(period_start)
        out["period_end"] = str(budget.period_end if budget else today)
        if budget:
            out["budget_target_pct"] = float(budget.target_food_cost_pct) if budget.target_food_cost_pct else None
            out["target_revenue"] = float(budget.target_revenue) if budget.target_revenue else None

        agg_stmt = select(
            func.sum(DailyFoodCost.purchases).label("total_purchases"),
            func.sum(DailyFoodCost.sales).label("total_sales"),
            func.sum(DailyFoodCost.actual_food_cost).label("total_food_cost"),
        ).where(and_(DailyFoodCost.cost_date >= period_start, DailyFoodCost.cost_date <= today))
        if loc:
            agg_stmt = agg_stmt.where(DailyFoodCost.location_id == loc)
        agg = (await session.execute(agg_stmt)).one()

        total_sales = float(agg.total_sales or 0)
        total_food_cost = float(agg.total_food_cost or 0)
        out["period_total_purchases"] = float(agg.total_purchases or 0)
        out["period_total_sales"] = total_sales
        if total_sales > 0:
            out["period_food_cost_pct"] = round(total_food_cost / total_sales * 100, 2)
        if budget and budget.target_food_cost_pct and total_sales > 0:
            expected = total_sales * (float(budget.target_food_cost_pct) / 100)
            out["budget_over_under"] = round(total_food_cost - expected, 2)

        pl_stmt = select(DailyPL).where(DailyPL.pl_date == today)
        if loc:
            pl_stmt = pl_stmt.where(DailyPL.location_id == loc)
        pl_row = (await session.execute(pl_stmt)).scalars().first()
        if pl_row:
            food = float(pl_row.food_cost_pct) if pl_row.food_cost_pct else 0
            labor = float(pl_row.labor_pct) if pl_row.labor_pct else 0
            out["prime_cost_pct"] = round(food + labor, 2)

    return json.dumps(out, default=str)


@mcp.tool()
async def food_cost_create_daily(data: str) -> str:
    """Create or update a DailyFoodCost row for manual entry via chat.

    Use when the user reports daily spend, e.g. "Today's spend: Sysco $2100, revenue $8200."
    If a row already exists for the same date + location, it is updated (upserted).

    Args:
        data: JSON string with fields:
            - location_id (optional, defaults to first location)
            - cost_date (YYYY-MM-DD, defaults to today)
            - purchases (total spend for the day)
            - sales (revenue for the day)
            - beginning_inventory (optional)
            - ending_inventory (optional)

    The actual_food_cost and food_cost_pct are computed automatically.

    Examples:
        food_cost_create_daily(data='{"purchases": 2950, "sales": 8200}')
        food_cost_create_daily(data='{"cost_date": "2026-03-24", "purchases": 3100, "sales": 9500}')
    """
    await _ensure_db()
    from datetime import date as _date
    from decimal import Decimal
    from carabiner.db.engine import get_session
    from carabiner.db.models import DailyFoodCost
    from sqlalchemy import select, and_

    parsed = json.loads(data)
    parsed = await _resolve_location_id(parsed)

    cost_date = _date.fromisoformat(parsed.get("cost_date", str(_date.today())))
    loc_id = parsed["location_id"]

    purchases = Decimal(str(parsed.get("purchases", 0)))
    sales = Decimal(str(parsed.get("sales", 0)))
    beg_inv = Decimal(str(parsed.get("beginning_inventory", 0)))
    end_inv = Decimal(str(parsed.get("ending_inventory", 0)))

    actual_food_cost = beg_inv + purchases - end_inv
    food_cost_pct = round(actual_food_cost / sales * 100, 2) if sales > 0 else None

    async with get_session() as session:
        stmt = select(DailyFoodCost).where(
            and_(DailyFoodCost.location_id == loc_id, DailyFoodCost.cost_date == cost_date)
        )
        existing = (await session.execute(stmt)).scalars().first()

        if existing:
            existing.purchases = purchases
            existing.sales = sales
            existing.beginning_inventory = beg_inv
            existing.ending_inventory = end_inv
            existing.actual_food_cost = actual_food_cost
            existing.food_cost_pct = food_cost_pct
            await session.commit()
            await session.refresh(existing)
            return json.dumps({"ok": True, "action": "updated", **_serialise(existing)}, default=str)
        else:
            row = DailyFoodCost(
                location_id=loc_id,
                cost_date=cost_date,
                purchases=purchases,
                sales=sales,
                beginning_inventory=beg_inv,
                ending_inventory=end_inv,
                actual_food_cost=actual_food_cost,
                food_cost_pct=food_cost_pct,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return json.dumps({"ok": True, "action": "created", **_serialise(row)}, default=str)


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


# ===================================================================
# PREP OPERATIONAL TOOLS -- work with PrepList/PrepListItem/PrepStation
# (the real prep system, not the legacy workspace_prep layer)
# ===================================================================


@mcp.tool()
async def prep_generate_list(
    expected_covers: int = 100,
    prep_date: Optional[str] = None,
    location_id: Optional[str] = None,
    service_lane: str = "All Day",
) -> str:
    """Generate a prep list for a date based on expected covers.

    Creates a new PrepList with items derived from active recipes.
    Quantities are scaled by the cover count. If a list already exists
    for the date, returns it instead of creating a duplicate.

    Args:
        expected_covers: Forecasted guest count (default 100).
        prep_date: Date string YYYY-MM-DD (default today).
        location_id: Location UUID (default first location).
        service_lane: "Lunch", "Dinner", or "All Day" (default "All Day").
    """
    await _ensure_db()
    from datetime import date as date_type
    from decimal import Decimal as D
    from carabiner.db.prep_repositories import (
        create_prep_list,
        get_prep_list_by_date,
    )
    from carabiner.db.repositories import list_recipes

    loc = _parse_uuid(location_id) if location_id else await _default_location_id()
    target_date = date_type.fromisoformat(prep_date) if prep_date else date_type.today()

    existing = await get_prep_list_by_date(loc, target_date)
    if existing:
        return json.dumps({
            "message": f"Prep list already exists for {target_date}",
            "prep_list_id": str(existing.id),
            "item_count": len(existing.items),
        }, default=str)

    recipes = await list_recipes(location_id=loc)
    items_data = []
    for i, recipe in enumerate(recipes):
        base_qty = D(str(max(1, expected_covers // 25)))
        items_data.append({
            "recipe_id": recipe.id,
            "name": recipe.name,
            "qty_needed": base_qty,
            "unit": str(recipe.yield_unit or "ea") if hasattr(recipe, "yield_unit") else "ea",
            "on_hand": D("0"),
            "to_prep": base_qty,
            "station": str(recipe.category) if hasattr(recipe, "category") else "Unassigned",
            "service_lane": service_lane,
            "sort_order": i,
            "is_complete": False,
        })

    if not items_data:
        return json.dumps({
            "error": "no_recipes",
            "message": "No recipes found to generate prep list from.",
        })

    prep_list = await create_prep_list({
        "location_id": loc,
        "prep_date": target_date,
        "status": "generated",
        "expected_covers": expected_covers,
        "generated_by": "ai",
        "items": items_data,
    })

    return json.dumps({
        "message": f"Generated prep list for {target_date} -- {len(items_data)} items, {expected_covers} covers",
        "prep_list_id": str(prep_list.id),
        "item_count": len(items_data),
    }, default=str)


@mcp.tool()
async def prep_mark_complete(
    item_id: str,
    completed_qty: Optional[str] = None,
) -> str:
    """Mark a prep item as complete (or toggle back to incomplete).

    Args:
        item_id: UUID of the prep list item.
        completed_qty: Actual quantity prepped (defaults to the to_prep amount).
    """
    await _ensure_db()
    from decimal import Decimal as D
    from carabiner.db.prep_repositories import complete_prep_item

    qty = D(completed_qty) if completed_qty else None
    item = await complete_prep_item(_parse_uuid(item_id), qty)
    if item is None:
        return json.dumps({"error": "not_found", "id": item_id})
    return json.dumps(_serialise(item), default=str)


@mcp.tool()
async def prep_check_shortages(
    location_id: Optional[str] = None,
    prep_date: Optional[str] = None,
) -> str:
    """Check today's prep list for shortages against on-hand inventory.

    Args:
        location_id: Location UUID (default first location).
        prep_date: Date string YYYY-MM-DD (default today).
    """
    await _ensure_db()
    from datetime import date as date_type
    from carabiner.db.prep_repositories import get_prep_list_by_date, get_prep_list_today

    loc = _parse_uuid(location_id) if location_id else await _default_location_id()

    if prep_date:
        pl = await get_prep_list_by_date(loc, date_type.fromisoformat(prep_date))
    else:
        pl = await get_prep_list_today(loc)

    if pl is None:
        return json.dumps({"message": "No prep list found", "shortages": []})

    shortages = []
    for item in pl.items:
        if item.on_hand < item.qty_needed and not item.is_complete:
            shortages.append({
                "item_id": str(item.id),
                "name": item.name or f"Recipe {item.recipe_id}",
                "station": item.station or "Unassigned",
                "qty_needed": float(item.qty_needed),
                "on_hand": float(item.on_hand),
                "deficit": float(item.qty_needed - item.on_hand),
                "unit": item.unit,
            })

    return json.dumps({
        "prep_date": str(pl.prep_date),
        "total_items": len(pl.items),
        "shortages": shortages,
        "shortage_count": len(shortages),
    }, default=str)
# ===== INVOICES PHASE 1 TOOLS =====


@mcp.tool()
async def invoices_upload(file_path: str, location_id: Optional[str] = None) -> str:
    """Upload an invoice file (PDF, JPEG, PNG, HEIC) and create an invoice record.

Args:
    file_path: Absolute path to the invoice file on disk.
    location_id: Optional location UUID. Defaults to first available location.

Returns the created invoice record as JSON.
"""
    await _ensure_db()
    import os
    import shutil

    if not os.path.isfile(file_path):
        return json.dumps({"error": "file_not_found", "file_path": file_path})

    upload_dir = os.path.join(os.getcwd(), "uploads", "invoices")
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file_path)[1].lower()
    file_id = uuid.uuid4()
    filename = f"{file_id}{ext}"
    dest = os.path.join(upload_dir, filename)
    shutil.copy2(file_path, dest)

    # Detect mime
    mime_map = {".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                ".png": "image/png", ".heic": "image/heic"}
    mime = mime_map.get(ext, "application/octet-stream")

    loc = _parse_uuid(location_id) if location_id else await _default_location_id()

    from carabiner.db.engine import get_session
    from carabiner.db.workspace_models import WorkspaceInvoice, InvoiceEvent

    async with get_session() as session:
        invoice = WorkspaceInvoice(
            location_id=loc,
            status="Uploaded",
            source="upload",
            file_path=f"/uploads/invoices/{filename}",
            file_mime=mime,
        )
        session.add(invoice)
        await session.flush()

        event = InvoiceEvent(
            invoice_id=invoice.id,
            event_type="uploaded",
            actor="agent",
            detail={"original_path": file_path, "mime": mime},
        )
        session.add(event)
        await session.commit()
        await session.refresh(invoice)

    return json.dumps(_serialise(invoice), default=str)


@mcp.tool()
async def invoices_approve(id: str, approved_by: str = "agent") -> str:
    """Approve an invoice by UUID.

Args:
    id: UUID of the invoice to approve.
    approved_by: Who is approving (default: "agent").

Returns the updated invoice record.
"""
    await _ensure_db()
    from carabiner.db.engine import get_session
    from carabiner.db.workspace_models import WorkspaceInvoice, InvoiceEvent
    from sqlalchemy import select

    uid = _parse_uuid(id)
    async with get_session() as session:
        result = await session.execute(
            select(WorkspaceInvoice).where(WorkspaceInvoice.id == uid)
        )
        invoice = result.scalar_one_or_none()
        if invoice is None:
            return json.dumps({"error": "not_found", "id": id})

        invoice.status = "Approved"
        invoice.approved_by = approved_by
        invoice.approved_at = datetime.utcnow()

        event = InvoiceEvent(
            invoice_id=invoice.id,
            event_type="approved",
            actor=approved_by,
        )
        session.add(event)
        await session.commit()
        await session.refresh(invoice)

    return json.dumps(_serialise(invoice), default=str)


@mcp.tool()
async def invoices_price_check(id: str) -> str:
    """Check line-item prices against last known prices for an invoice.

Args:
    id: UUID of the invoice to check.

Returns a JSON array of line items with price variance information.
"""
    await _ensure_db()
    from carabiner.db.engine import get_session
    from carabiner.db.workspace_models import WorkspaceInvoice
    from sqlalchemy import select

    uid = _parse_uuid(id)
    async with get_session() as session:
        result = await session.execute(
            select(WorkspaceInvoice).where(WorkspaceInvoice.id == uid)
        )
        invoice = result.scalar_one_or_none()
        if invoice is None:
            return json.dumps({"error": "not_found", "id": id})

        line_items = invoice.line_items or []
        if not isinstance(line_items, list):
            return json.dumps({"error": "no_line_items", "id": id})

        # Compare each line item against Item.last_known_price
        from carabiner.db.models import Item
        variances = []
        for li in line_items:
            desc = li.get("description", "")
            unit_price = li.get("unit_price")
            if unit_price is None:
                continue
            try:
                current = float(unit_price)
            except (TypeError, ValueError):
                continue

            # Fuzzy match: search items by name containing the description
            stmt = select(Item).where(Item.name.ilike(f"%{desc[:50]}%"))
            item_result = await session.execute(stmt)
            item = item_result.scalar_one_or_none()
            if item and item.last_known_price:
                last = float(item.last_known_price)
                variance_pct = ((current - last) / last * 100) if last != 0 else 0
                variances.append({
                    "description": desc,
                    "current_price": current,
                    "last_known_price": last,
                    "variance_pct": round(variance_pct, 2),
                    "flagged": abs(variance_pct) > 5,
                    "item_id": str(item.id),
                })
            else:
                variances.append({
                    "description": desc,
                    "current_price": current,
                    "last_known_price": None,
                    "variance_pct": None,
                    "flagged": False,
                    "item_id": None,
                })

    return json.dumps(variances, default=str)


# ---------------------------------------------------------------------------
# Entry point -- stdio transport for Agent Zero subprocess
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run(transport="stdio")
