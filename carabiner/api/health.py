"""Health check endpoint."""

from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from carabiner.db.engine import get_session

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check() -> JSONResponse:
    try:
        async with get_session() as session:
            await session.execute(text("SELECT 1"))
        return JSONResponse(
            content={"status": "ok", "db": "connected", "service": "carabiner-engine"},
        )
    except Exception:
        logger.exception("Health check DB connectivity failed")
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "db": "disconnected", "service": "carabiner-engine"},
        )
