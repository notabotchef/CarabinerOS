"""Flask blueprint for operational Prep API routes.

New REST endpoints for PrepList/PrepListItem/PrepStation -- the real prep
system, not the legacy workspace_prep layer.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from flask import Blueprint, Response, request

from carabiner.db.engine import get_session
from carabiner.db.prep_repositories import (
    complete_prep_item,
    create_prep_item,
    create_prep_list,
    create_prep_station,
    delete_prep_item,
    get_prep_item,
    get_prep_list_by_date,
    get_prep_list_by_id,
    get_prep_list_today,
    list_prep_stations,
    update_prep_item,
    update_prep_list,
    update_prep_station,
)
from carabiner.api.schemas import (
    PrepListItemOut,
    PrepListOut,
    PrepStationOut,
)

logger = logging.getLogger(__name__)

prep_blueprint = Blueprint("carabiner_prep_api", __name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_uuid(raw: str) -> uuid.UUID:
    """Parse a string into a UUID."""
    return uuid.UUID(raw.strip())


def _parse_location_id() -> Optional[uuid.UUID]:
    """Extract optional location_id query parameter."""
    raw = request.args.get("location_id")
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except (ValueError, AttributeError):
        return None


async def _default_location_id() -> uuid.UUID:
    """Return the first available location UUID as a fallback."""
    from carabiner.db.repositories import list_locations
    rows = await list_locations()
    if not rows:
        raise ValueError("No locations found in database")
    return rows[0].id


def _json(data, status: int = 200) -> Response:
    """Return a JSON response."""
    body = json.dumps(data, default=str)
    return Response(response=body, status=status, mimetype="application/json")


def _ok(data=None) -> Response:
    return _json({"ok": True, "data": data})


def _err(msg: str, status: int = 400) -> Response:
    return _json({"ok": False, "error": msg}, status=status)


def _serialize_prep_list(pl) -> dict:
    """Serialize a PrepList with its items."""
    items = []
    for item in (pl.items or []):
        items.append(PrepListItemOut.model_validate(item).model_dump(mode="json"))
    result = PrepListOut.model_validate(pl).model_dump(mode="json")
    result["items"] = items
    return result


# ---------------------------------------------------------------------------
# Routes: Prep Lists
# ---------------------------------------------------------------------------

@prep_blueprint.route("/api/prep/today", methods=["GET"])
async def prep_today():
    """Get today's prep list with all items, grouped by station."""
    try:
        location_id = _parse_location_id()
        if not location_id:
            location_id = await _default_location_id()

        pl = await get_prep_list_today(location_id)
        if pl is None:
            return _json({"ok": True, "data": None})

        return _ok(_serialize_prep_list(pl))
    except Exception:
        logger.exception("Failed to fetch today's prep list")
        return _err("Failed to fetch prep list", 500)


@prep_blueprint.route("/api/prep/lists", methods=["GET"])
async def prep_lists_by_date():
    """Get prep list for a specific date. Query param: ?date=YYYY-MM-DD"""
    try:
        location_id = _parse_location_id()
        if not location_id:
            location_id = await _default_location_id()

        date_str = request.args.get("date")
        if date_str:
            prep_date = date.fromisoformat(date_str)
        else:
            prep_date = date.today()

        pl = await get_prep_list_by_date(location_id, prep_date)
        if pl is None:
            return _json({"ok": True, "data": None})

        return _ok(_serialize_prep_list(pl))
    except Exception:
        logger.exception("Failed to fetch prep list by date")
        return _err("Failed to fetch prep list", 500)


@prep_blueprint.route("/api/prep/lists/<list_id>", methods=["GET"])
async def prep_list_detail(list_id: str):
    """Get a single prep list by ID with all items."""
    try:
        pl = await get_prep_list_by_id(_parse_uuid(list_id))
        if pl is None:
            return _err("Prep list not found", 404)
        return _ok(_serialize_prep_list(pl))
    except Exception:
        logger.exception("Failed to fetch prep list")
        return _err("Failed to fetch prep list", 500)


@prep_blueprint.route("/api/prep/lists/<list_id>", methods=["PATCH"])
async def prep_list_update(list_id: str):
    """Update a prep list (status, approved_by, expected_covers)."""
    try:
        data = request.get_json(force=True)
        pl = await update_prep_list(_parse_uuid(list_id), data)
        if pl is None:
            return _err("Prep list not found", 404)
        return _ok(_serialize_prep_list(pl))
    except Exception:
        logger.exception("Failed to update prep list")
        return _err("Failed to update prep list", 500)


# ---------------------------------------------------------------------------
# Routes: Prep Items
# ---------------------------------------------------------------------------

@prep_blueprint.route("/api/prep/items", methods=["POST"])
async def prep_item_create():
    """Add a prep item to a list."""
    try:
        data = request.get_json(force=True)
        if "prep_list_id" not in data:
            return _err("prep_list_id is required")
        if "recipe_id" not in data:
            return _err("recipe_id is required")

        # Convert string UUIDs
        data["prep_list_id"] = _parse_uuid(str(data["prep_list_id"]))
        data["recipe_id"] = _parse_uuid(str(data["recipe_id"]))

        # Convert numeric fields
        for field in ("qty_needed", "on_hand", "to_prep", "completed_qty"):
            if field in data and data[field] is not None:
                data[field] = Decimal(str(data[field]))

        item = await create_prep_item(data)
        return _ok(PrepListItemOut.model_validate(item).model_dump(mode="json"))
    except Exception:
        logger.exception("Failed to create prep item")
        return _err("Failed to create prep item", 500)


@prep_blueprint.route("/api/prep/items/<item_id>", methods=["PATCH"])
async def prep_item_update(item_id: str):
    """Update a prep item."""
    try:
        data = request.get_json(force=True)
        # Convert numeric fields
        for field in ("qty_needed", "on_hand", "to_prep", "completed_qty"):
            if field in data and data[field] is not None:
                data[field] = Decimal(str(data[field]))

        item = await update_prep_item(_parse_uuid(item_id), data)
        if item is None:
            return _err("Prep item not found", 404)
        return _ok(PrepListItemOut.model_validate(item).model_dump(mode="json"))
    except Exception:
        logger.exception("Failed to update prep item")
        return _err("Failed to update prep item", 500)


@prep_blueprint.route("/api/prep/items/<item_id>/complete", methods=["PATCH"])
async def prep_item_complete(item_id: str):
    """Mark a prep item complete (or toggle back to incomplete)."""
    try:
        data = request.get_json(silent=True) or {}
        completed_qty = None
        if "completed_qty" in data and data["completed_qty"] is not None:
            completed_qty = Decimal(str(data["completed_qty"]))

        item = await complete_prep_item(_parse_uuid(item_id), completed_qty)
        if item is None:
            return _err("Prep item not found", 404)
        return _ok(PrepListItemOut.model_validate(item).model_dump(mode="json"))
    except Exception:
        logger.exception("Failed to complete prep item")
        return _err("Failed to complete prep item", 500)


@prep_blueprint.route("/api/prep/items/<item_id>", methods=["DELETE"])
async def prep_item_delete(item_id: str):
    """Remove a prep item."""
    try:
        deleted = await delete_prep_item(_parse_uuid(item_id))
        if not deleted:
            return _err("Prep item not found", 404)
        return _ok({"deleted": True, "id": item_id})
    except Exception:
        logger.exception("Failed to delete prep item")
        return _err("Failed to delete prep item", 500)


# ---------------------------------------------------------------------------
# Routes: Prep Stations
# ---------------------------------------------------------------------------

@prep_blueprint.route("/api/prep/stations", methods=["GET"])
async def prep_stations_list():
    """List all prep stations for a location."""
    try:
        location_id = _parse_location_id()
        if not location_id:
            location_id = await _default_location_id()

        stations = await list_prep_stations(location_id)
        data = [PrepStationOut.model_validate(s).model_dump(mode="json") for s in stations]
        return _ok(data)
    except Exception:
        logger.exception("Failed to fetch prep stations")
        return _err("Failed to fetch prep stations", 500)


@prep_blueprint.route("/api/prep/stations", methods=["POST"])
async def prep_station_create():
    """Create a new prep station."""
    try:
        data = request.get_json(force=True)
        if "location_id" not in data:
            loc_id = _parse_location_id()
            if not loc_id:
                loc_id = await _default_location_id()
            data["location_id"] = loc_id
        else:
            data["location_id"] = _parse_uuid(str(data["location_id"]))

        station = await create_prep_station(data)
        return _ok(PrepStationOut.model_validate(station).model_dump(mode="json"))
    except Exception:
        logger.exception("Failed to create prep station")
        return _err("Failed to create prep station", 500)
