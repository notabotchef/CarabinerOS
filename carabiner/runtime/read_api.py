"""Read-only FastAPI router exposing the 8 module lists/details.

Mounted by ``carabiner.runtime.server`` at ``/api``.

Routes:

- ``GET /api/orders``              list with optional ``?location_id=``
- ``GET /api/orders/{id}``         single record
- ... and the same pattern for inventory, prep, food-cost, menu,
    recipes, invoices, campaigns.

All responses wrapped in ``{"ok": True, "data": ...}``. Heavy JSONB/Text
columns are stripped via :func:`carabiner.mcp.server._slim` so the
frontend doesn't drown in detail rows.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api", tags=["read"])


# Maps URL path → carabiner.mcp.server._MODULE_REGISTRY key.
# Hyphenated URL stays the canonical user-facing form; the registry
# stores underscored keys, so we map both ways.
_RESOURCE_MAP: dict[str, str] = {
    "orders": "orders",
    "inventory": "inventory",
    "prep": "prep",
    "food-cost": "food_cost",
    "menu": "menu",
    "recipes": "recipes",
    "invoices": "invoices",
    "campaigns": "campaigns",
}


def _ok(data: Any) -> dict[str, Any]:
    return {"ok": True, "data": data}


def _err(message: str) -> dict[str, Any]:
    return {"ok": False, "error": message}


async def _list_module(resource_url: str, location_id: str | None) -> list[dict[str, Any]]:
    """Run the registry list function and slim the result."""
    from carabiner.mcp import server as mcp_server

    registry_key = _RESOURCE_MAP.get(resource_url)
    if registry_key is None:
        raise HTTPException(status_code=404, detail=f"unknown resource: {resource_url}")
    await mcp_server._ensure_db()
    fn_name = mcp_server._MODULE_REGISTRY[registry_key]["list"]
    fn = getattr(__import__("carabiner.db.repositories", fromlist=[fn_name]), fn_name)
    kwargs: dict[str, Any] = {}
    if location_id:
        kwargs["location_id"] = location_id
    rows = await fn(**kwargs)
    return mcp_server._slim([mcp_server._serialise(r) for r in rows])


async def _get_module(resource_url: str, record_id: str) -> dict[str, Any]:
    """Run the registry get function and slim the result."""
    from carabiner.mcp import server as mcp_server

    registry_key = _RESOURCE_MAP.get(resource_url)
    if registry_key is None:
        raise HTTPException(status_code=404, detail=f"unknown resource: {resource_url}")
    await mcp_server._ensure_db()
    fn_name = mcp_server._MODULE_REGISTRY[registry_key]["get"]
    fn = getattr(__import__("carabiner.db.repositories", fromlist=[fn_name]), fn_name)
    row = await fn(record_id)
    if row is None:
        raise HTTPException(status_code=404, detail="not_found")
    return mcp_server._slim([mcp_server._serialise(row)])[0]


def _register(router: APIRouter, url_key: str) -> None:
    """Attach list + get routes for one resource to the router."""

    @router.get(f"/{url_key}", summary=f"List {url_key}")
    async def _list(location_id: str | None = Query(default=None)) -> dict[str, Any]:
        try:
            data = await _list_module(url_key, location_id)
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            return _err(str(exc))
        return _ok(data)

    @router.get(f"/{url_key}/{{record_id}}", summary=f"Get one {url_key}")
    async def _get(record_id: str) -> dict[str, Any]:
        try:
            data = await _get_module(url_key, record_id)
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            return _err(str(exc))
        return _ok(data)


for _key in _RESOURCE_MAP:
    _register(router, _key)