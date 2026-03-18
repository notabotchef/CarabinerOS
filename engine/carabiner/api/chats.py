"""Chat persistence endpoints — wires Agent Zero's persist_chat into REST API."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chats"])


def _context_summary(ctx: Any) -> dict:
    """Extract a lightweight summary dict from an AgentContext."""
    return {
        "id": ctx.id,
        "name": ctx.name,
        "created_at": ctx.created_at.isoformat() if ctx.created_at else None,
        "last_message": ctx.last_message.isoformat() if ctx.last_message else None,
        "type": ctx.type.value if hasattr(ctx.type, "value") else str(ctx.type),
        "running": ctx.is_running() if hasattr(ctx, "is_running") else False,
    }


def _clean_content(content: Any) -> str | None:
    """Extract the human-readable text from an Agent Zero message content.

    Agent Zero messages can be:
    - Plain strings
    - JSON strings containing {thoughts, tool_name, tool_args: {text}}
    - Dicts with the same structure
    - Dicts with {user_message: "..."}
    """
    import json

    # Already a string — try to parse as JSON first
    if isinstance(content, str):
        text = content.strip()
        if not text:
            return None
        # Try parsing JSON-encoded agent output
        if text.startswith("{"):
            try:
                parsed = json.loads(text)
                return _extract_text_from_parsed(parsed)
            except (json.JSONDecodeError, ValueError):
                pass
        return text

    if isinstance(content, dict):
        return _extract_text_from_parsed(content)

    if isinstance(content, list):
        # Multimodal content — extract text parts
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
        return "\n".join(parts).strip() or None

    return str(content) if content else None


def _extract_text_from_parsed(data: dict) -> str | None:
    """Extract clean text from a parsed Agent Zero message dict."""
    # Response tool call: {tool_name: "response", tool_args: {text: "..."}}
    if data.get("tool_name") == "response":
        tool_args = data.get("tool_args", {})
        if isinstance(tool_args, dict):
            text = tool_args.get("text", "")
            if text:
                return text

    # User message: {user_message: "..."}
    if "user_message" in data:
        return data["user_message"]

    # Message with a "text" field directly
    if "text" in data and isinstance(data["text"], str):
        return data["text"]

    # Message with a "content" field
    if "content" in data and isinstance(data["content"], str):
        return data["content"]

    # Raw content with preview
    if "preview" in data and isinstance(data["preview"], str):
        return data["preview"]

    # Last resort: if there's a "raw_content" that's a list, extract text parts
    if "raw_content" in data and isinstance(data["raw_content"], list):
        parts = []
        for item in data["raw_content"]:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
        if parts:
            return "\n".join(parts).strip()

    return None


def _extract_messages(ctx: Any) -> list[dict]:
    """Extract chat messages from a context's root agent history.

    Walks the history output and converts to {role, content} dicts,
    stripping internal Agent Zero mechanics (thoughts, tool calls, etc.)
    to return only human-readable conversation text.
    """
    messages: list[dict] = []
    try:
        outputs = ctx.agent0.history.output()
        for out in outputs:
            role = "assistant" if out.get("ai") else "user"
            raw_content = out.get("content", "")
            content = _clean_content(raw_content)
            if content and content.strip():
                messages.append({"role": role, "content": content.strip()})
    except Exception as e:
        logger.warning("Failed to extract messages from context %s: %s", ctx.id, e)
    return messages


@router.get("/chats")
async def list_chats() -> list[dict]:
    """List all non-BACKGROUND chat contexts, sorted by last_message desc.

    Also ensures any on-disk chats not yet in memory are loaded.
    """
    try:
        from agent import AgentContext, AgentContextType

        # Ensure saved chats are loaded (idempotent — already-loaded IDs
        # will just get re-registered, which is cheap).
        try:
            from python.helpers import persist_chat
            persist_chat.load_tmp_chats()
        except Exception as e:
            logger.debug("Could not load persisted chats: %s", e)

        contexts = AgentContext.all()
        result = []
        for ctx in contexts:
            if ctx.type == AgentContextType.BACKGROUND:
                continue
            result.append(_context_summary(ctx))

        # Sort by last_message descending (most recent first)
        result.sort(
            key=lambda c: c.get("last_message") or "",
            reverse=True,
        )
        return result
    except ImportError:
        # Agent Zero not available
        return []


@router.get("/chats/{context_id}/messages")
async def get_chat_messages(context_id: str) -> list[dict]:
    """Return the message history for a specific chat context."""
    try:
        from agent import AgentContext

        ctx = AgentContext.get(context_id)
        if ctx is None:
            raise HTTPException(status_code=404, detail="Chat not found")
        return _extract_messages(ctx)
    except ImportError:
        raise HTTPException(status_code=503, detail="Agent Zero not available")


@router.post("/chats", status_code=201)
async def create_chat() -> dict:
    """Create a new empty chat context and return its summary."""
    try:
        from agent import AgentContext

        # Import bridge to build config with the correct profile
        # _build_config includes sio reference for socket event emission
        from bridge import agent_bridge
        config = agent_bridge._build_config(profile="gm")
        ctx = AgentContext(config=config)

        # Persist the new (empty) context so it survives engine restarts
        try:
            from python.helpers import persist_chat
            persist_chat.save_tmp_chat(ctx)
        except Exception as e:
            logger.debug("Could not persist new chat %s: %s", ctx.id, e)

        logger.info("Created new chat context: %s", ctx.id)
        return _context_summary(ctx)
    except ImportError:
        raise HTTPException(status_code=503, detail="Agent Zero not available")


@router.delete("/chats/{context_id}", status_code=204)
async def delete_chat(context_id: str) -> None:
    """Remove a chat from memory and disk."""
    try:
        from agent import AgentContext
        from python.helpers import persist_chat

        ctx = AgentContext.get(context_id)
        if ctx is None:
            raise HTTPException(status_code=404, detail="Chat not found")

        AgentContext.remove(context_id)
        try:
            persist_chat.remove_chat(context_id)
        except Exception as e:
            logger.warning("Failed to remove chat files for %s: %s", context_id, e)

        logger.info("Deleted chat context: %s", context_id)
    except ImportError:
        raise HTTPException(status_code=503, detail="Agent Zero not available")
