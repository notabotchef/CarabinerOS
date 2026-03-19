"""Locations endpoints."""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, HTTPException

from carabiner.api.schemas import LocationCreate, LocationOut, LocationUpdate
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


@router.post("/locations", response_model=LocationOut, status_code=201)
async def create_location(body: LocationCreate) -> LocationOut:
    loc = await repo.create_location(body.model_dump())
    return LocationOut.model_validate(loc)


@router.patch("/locations/{location_id}", response_model=LocationOut)
async def update_location(location_id: uuid.UUID, body: LocationUpdate) -> LocationOut:
    loc = await repo.update_location(location_id, body.model_dump(exclude_unset=True))
    if loc is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return LocationOut.model_validate(loc)


@router.delete("/locations/{location_id}", status_code=204)
async def delete_location(location_id: uuid.UUID) -> None:
    deleted = await repo.delete_location(location_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Location not found")
