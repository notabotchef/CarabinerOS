"""Health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "carabiner-engine"}
