"""Locations endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException

from carabiner.api.schemas import LocationOut
from carabiner.db import repositories as repo

router = APIRouter(prefix="/api", tags=["locations"])


@router.get("/locations", response_model=List[LocationOut])
async def list_locations() -> list:
    locations = await repo.list_locations()
    return [LocationOut.model_validate(loc) for loc in locations]


@router.get("/locations/{slug}", response_model=LocationOut)
async def get_location(slug: str) -> LocationOut:
    loc = await repo.get_location_by_slug(slug)
    if loc is None:
        raise HTTPException(status_code=404, detail=f"Location '{slug}' not found")
    return LocationOut.model_validate(loc)
