"""CarabinerOS Engine — FastAPI application wrapping Agent Zero.

Entry point for the backend. Boots FastAPI with:
- Agent Zero (via submodule + overlay)
- Socket.IO for real-time communication
- REST API endpoints for restaurant operations
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import socketio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from bridge import AgentBridge
from carabiner.api.health import router as health_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# --- Agent Bridge (singleton) ---
agent_bridge = AgentBridge()

# --- Socket.IO ---
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)


@sio.event
async def connect(sid: str, environ: dict) -> None:
    logger.info("Client connected: %s", sid)


@sio.event
async def disconnect(sid: str) -> None:
    logger.info("Client disconnected: %s", sid)


@sio.on("chat_message")
async def handle_chat_message(sid: str, data: dict) -> None:
    """Placeholder for chat message handling (Phase 4)."""
    logger.info("Chat message from %s: %s", sid, data.get("message", "")[:100])
    await sio.emit(
        "status_update",
        {"context_id": data.get("context_id", ""), "status": "received"},
        to=sid,
    )


# --- FastAPI App ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Agent Zero bridge on startup."""
    logger.info("Starting CarabinerOS Engine...")

    try:
        await agent_bridge.initialize()
        discovered = agent_bridge.verify_overlay_discovery()
        logger.info("Overlay tools discovered: %s", discovered["tools"])
        logger.info("Overlay extensions discovered: %s", discovered["extensions"])
    except Exception:
        logger.warning(
            "Agent Zero initialization skipped (submodule dependencies may not be installed). "
            "REST API will still work.",
            exc_info=True,
        )

    logger.info("CarabinerOS Engine started")
    yield
    logger.info("CarabinerOS Engine shutting down")


app = FastAPI(
    title="CarabinerOS Engine",
    description="Restaurant operations platform powered by Agent Zero",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(health_router)

# Mount Socket.IO as ASGI sub-app
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


@app.get("/api/overlay/status")
async def overlay_status() -> dict:
    """Check overlay discovery status (development endpoint)."""
    return {
        "initialized": agent_bridge.is_initialized,
        "overlay": agent_bridge.verify_overlay_discovery(),
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[".", "carabiner"],
    )
