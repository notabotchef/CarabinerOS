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

# Suppress noisy uvicorn access logs (health checks every 10s)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

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


_AGENT_ROLE_MAP = {
    "0": "GM",
    "1": "Assistant GM",
    "2": "Executive Chef",
    "3": "Sous Chef",
    "4": "Marketing Manager",
}

_AGENT_NAME_MAP = {
    "agm": "Assistant GM",
    "executivechef": "Executive Chef",
    "souschef": "Sous Chef",
    "marketing": "Marketing Manager",
    "gm": "GM",
}

import re as _re

def _clean_status_detail(detail: str) -> str:
    """Clean internal agent language from status pill text."""
    d = detail
    # Map agent numbers to roles
    for num, role in _AGENT_ROLE_MAP.items():
        d = d.replace(f"Agent {num}", role)
        d = d.replace(f"A{num}", role)
    # Map profile names
    for profile, role in _AGENT_NAME_MAP.items():
        d = _re.sub(rf"\b{profile}\b", role, d, flags=_re.IGNORECASE)
    # Clean tool names
    d = d.replace("call_subordinate", "Delegating to")
    d = d.replace("inventory_tool", "Checking inventory")
    d = d.replace("order_tool", "Managing orders")
    d = d.replace("prep_tool", "Checking prep")
    d = d.replace("food_cost_tool", "Analyzing food cost")
    d = d.replace("menu_tool", "Reviewing menu")
    d = d.replace("marketing_tool", "Reviewing campaigns")
    d = d.replace("code_execution_tool", "Processing data")
    d = d.replace("response", "Composing response")
    # Clean prefixes
    d = _re.sub(r"^(icon://\S+\s*)", "", d)
    d = _re.sub(r"Using tool '([^']+)'", r"Using \1", d)
    d = _re.sub(r"\s{2,}", " ", d).strip()
    return d


def _clean_response(text: str) -> str:
    """Clean internal artifacts from the final response text."""
    t = text
    t = _re.sub(r"§§[^\n]*", "", t)
    t = _re.sub(r"(?:response |order response |result )?from (?:subordinate|sub) ?(?:agent)?:?\s*", "", t, flags=_re.IGNORECASE)
    for num, role in _AGENT_ROLE_MAP.items():
        t = t.replace(f"Agent {num}", role)
        t = t.replace(f"A{num}", role)
    t = _re.sub(r"\b(subordinate|subagent|superior)\s*(agent)?\b", "", t, flags=_re.IGNORECASE)
    t = _re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


@sio.on("clear_chat")
async def handle_clear_chat(sid: str, data: dict) -> None:
    """Clear an agent context and its persisted chat data."""
    context_id = data.get("context_id", "default")
    logger.info("Clearing chat context: %s", context_id)
    try:
        from agent import AgentContext
        context = AgentContext.get(context_id)
        if context:
            AgentContext.remove(context_id)
            logger.info("Agent context %s removed", context_id)
    except Exception as e:
        logger.warning("Failed to clear context %s: %s", context_id, e)


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
            last_progress = ""

            while task.is_alive():
                await asyncio.sleep(0.15)

                # Check for new log entries
                if context.log and len(context.log.logs) > last_log_count:
                    for i in range(last_log_count, len(context.log.logs)):
                        log_item = context.log.logs[i]
                        log_type = str(getattr(log_item, 'type', ''))
                        heading = str(getattr(log_item, 'heading', ''))
                        content = str(getattr(log_item, 'content', ''))

                        # Emit status updates for all meaningful log types
                        detail = ""
                        if log_type == 'tool':
                            detail = heading or content
                        elif log_type == 'agent':
                            detail = heading or content
                        elif log_type == 'progress':
                            detail = content or heading
                        elif log_type == 'response':
                            detail = "Composing response"
                        elif log_type == 'user':
                            continue  # skip user messages

                        if detail:
                            detail = _clean_status_detail(detail)
                            if detail and detail != last_progress:
                                last_progress = detail
                                await sio.emit("status_update", {
                                    "context_id": context_id,
                                    "status": "thinking",
                                    "detail": detail[:120],
                                }, to=sid)

                    last_log_count = len(context.log.logs)

                # Check context.log.progress for live reasoning updates
                if context.log:
                    progress = getattr(context.log, 'progress', '') or ''
                    if progress and progress != last_progress:
                        cleaned = _clean_status_detail(progress)
                        if cleaned:
                            last_progress = progress
                            await sio.emit("status_update", {
                                "context_id": context_id,
                                "status": "thinking",
                                "detail": cleaned[:120],
                            }, to=sid)

            # Get final response
            response = await task.result()

            # Clean and stream the response
            if response:
                response = _clean_response(response)
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
