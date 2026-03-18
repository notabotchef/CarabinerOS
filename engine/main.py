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

import os

from bridge import AgentBridge
from carabiner.api.health import router as health_router
from carabiner.api.hq import router as hq_router
from carabiner.api.locations import router as locations_router
from carabiner.api.workspace import router as workspace_router
from carabiner.db.engine import init_db, close_db

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
    """Handle chat messages — routes to Agent Zero if initialized, otherwise mock fallback."""
    import asyncio

    message = data.get("message", "")
    context_id = data.get("context_id", "default")
    logger.info("Chat message from %s: %s", sid, message[:100])

    # Emit thinking status
    await sio.emit("status_update", {
        "context_id": context_id,
        "status": "thinking",
        "detail": "Processing your request",
    }, to=sid)

    if agent_bridge.is_initialized:
        # Real Agent Zero path — poll log for real-time updates while task runs
        try:
            from agent import AgentContext

            await sio.emit("status_update", {
                "context_id": context_id,
                "status": "thinking",
                "detail": "Analyzing your request",
            }, to=sid)

            # Start the agent task (non-blocking)
            context, task = await agent_bridge.communicate_async(
                context_id=context_id,
                message=message,
            )

            # Poll the context log for real-time updates
            last_log_count = len(context.log.logs) if context.log else 0
            last_streamed = ""

            while task.is_alive():
                await asyncio.sleep(0.2)

                # Check for new log entries
                if context.log and len(context.log.logs) > last_log_count:
                    for i in range(last_log_count, len(context.log.logs)):
                        log_item = context.log.logs[i]
                        log_type = str(getattr(log_item, 'type', ''))
                        heading = str(getattr(log_item, 'heading', ''))
                        content = str(getattr(log_item, 'content', ''))

                        # Emit status updates for agent activity
                        if log_type in ('agent', 'tool', 'progress'):
                            detail = heading or content
                            if detail:
                                # Clean internal language
                                detail = detail.replace('Agent 0', 'GM').replace('Agent 1', 'Specialist')
                                detail = detail[:80]
                                await sio.emit("status_update", {
                                    "context_id": context_id,
                                    "status": "thinking",
                                    "detail": detail,
                                }, to=sid)

                    last_log_count = len(context.log.logs)

                # Check for streaming response content
                if context.streaming_agent:
                    current = getattr(context.streaming_agent, '_stream_full', '')
                    if current and current != last_streamed:
                        new_chunk = current[len(last_streamed):]
                        if new_chunk:
                            await sio.emit("response_stream", {
                                "context_id": context_id,
                                "chunk": new_chunk,
                                "full": current,
                            }, to=sid)
                            last_streamed = current

            # Get final response
            response = await task.result()

            # If we didn't stream anything yet, stream the full response
            if not last_streamed and response:
                full = ""
                for word in response.split(" "):
                    full += word + " "
                    await sio.emit("response_stream", {
                        "context_id": context_id,
                        "chunk": word + " ",
                        "full": full.strip(),
                    }, to=sid)
                    await asyncio.sleep(0.02)

        except Exception as e:
            logger.error("Agent Zero error: %s", e, exc_info=True)
            error_msg = f"I encountered an issue processing your request. Please try again.\n\nError: {str(e)[:200]}"
            await sio.emit("response_stream", {
                "context_id": context_id,
                "chunk": error_msg,
                "full": error_msg,
            }, to=sid)
    else:
        # Mock fallback when Agent Zero deps aren't installed
        await asyncio.sleep(0.5)
        await sio.emit("status_update", {
            "context_id": context_id,
            "status": "thinking",
            "detail": "Checking inventory levels",
        }, to=sid)

        await asyncio.sleep(0.5)
        response = (
            f'I\'ve analyzed your request: "{message[:80]}"\n\n'
            "Here's what I found:\n\n"
            "- **Inventory check** completed for the active location\n"
            "- **Par levels** are within normal range for 3 of 5 key items\n"
            "- **Two items** are below par and may need replenishment\n\n"
            "Would you like me to draft an order for the items that need restocking?\n\n"
            "*Note: Running in mock mode — Agent Zero is not connected.*"
        )

        full = ""
        for word in response.split(" "):
            full += word + " "
            await sio.emit("response_stream", {
                "context_id": context_id,
                "chunk": word + " ",
                "full": full.strip(),
            }, to=sid)
            await asyncio.sleep(0.05)

    # Done
    await sio.emit("status_update", {
        "context_id": context_id,
        "status": "waiting",
    }, to=sid)


# --- FastAPI App ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Agent Zero bridge on startup."""
    logger.info("Starting CarabinerOS Engine...")

    # Initialize database
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://carabiner:carabiner@localhost:5432/carabiner",
    )
    try:
        await init_db(database_url)
        logger.info("Database connected: %s", database_url.split("@")[-1])
    except Exception:
        logger.warning("Database connection failed. Endpoints requiring DB will error.", exc_info=True)

    # Initialize Agent Zero
    try:
        await agent_bridge.initialize(sio=sio)
        discovered = agent_bridge.verify_overlay_discovery()
        logger.info("Overlay tools discovered: %s", discovered["tools"])
        logger.info("Overlay extensions discovered: %s", discovered["extensions"])
        logger.info("Overlay profiles discovered: %s", discovered.get("profiles", []))
    except Exception:
        logger.warning(
            "Agent Zero initialization skipped (submodule dependencies may not be installed). "
            "REST API will still work.",
            exc_info=True,
        )

    logger.info("CarabinerOS Engine started")
    yield

    await close_db()
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
app.include_router(hq_router)
app.include_router(locations_router)
app.include_router(workspace_router)

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
    # Use asyncio loop (not uvloop) so nest_asyncio can patch it for Agent Zero
    uvicorn.run(
        "main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[".", "carabiner"],
        loop="asyncio",
    )
