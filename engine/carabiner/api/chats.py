"""Chat persistence endpoints.

Uses Agent Zero's AgentContext when available, otherwise falls back to
the lightweight FallbackChatStore so that chat CRUD and message history
work regardless of whether Agent Zero initializes successfully.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from carabiner.chat_store import chat_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chats"])


def _agent_zero_available() -> bool:
    """Check if Agent Zero imports are working."""
    try:
        from agent import AgentContext  # noqa: F401
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Agent-Zero-backed helpers (used when A0 is initialized)
# ---------------------------------------------------------------------------

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


def _clean_content(content: Any) -> "str | None":
    """Extract the human-readable text from an Agent Zero message content."""
    import json

    if isinstance(content, str):
        text = content.strip()
        if not text:
            return None
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
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
        return "\n".join(parts).strip() or None

    return str(content) if content else None


def _extract_text_from_parsed(data: dict) -> "str | None":
    """Extract clean text from a parsed Agent Zero message dict."""
    if data.get("tool_name") == "response":
        tool_args = data.get("tool_args", {})
        if isinstance(tool_args, dict):
            text = tool_args.get("text", "")
            if text:
                return text
    if "user_message" in data:
        return data["user_message"]
    if "text" in data and isinstance(data["text"], str):
        return data["text"]
    if "content" in data and isinstance(data["content"], str):
        return data["content"]
    if "preview" in data and isinstance(data["preview"], str):
        return data["preview"]
    if "raw_content" in data and isinstance(data["raw_content"], list):
        parts = []
        for item in data["raw_content"]:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
        if parts:
            return "\n".join(parts).strip()
    return None


def _extract_messages(ctx: Any) -> list:
    """Extract chat messages from a context's root agent history."""
    messages = []
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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/chats")
async def list_chats() -> list:
    """List all chat contexts, sorted by last_message desc."""
    if _agent_zero_available():
        try:
            from agent import AgentContext, AgentContextType

            try:
                from python.helpers import persist_chat
                persist_chat.load_tmp_chats()
            except Exception:
                pass

            contexts = AgentContext.all()
            result = []
            for ctx in contexts:
                if ctx.type == AgentContextType.BACKGROUND:
                    continue
                result.append(_context_summary(ctx))
            result.sort(key=lambda c: c.get("last_message") or "", reverse=True)
            return result
        except Exception as e:
            logger.debug("Agent Zero list_chats failed, using fallback: %s", e)

    # Fallback: use local chat store
    return [ctx.to_summary() for ctx in chat_store.all()]


@router.get("/chats/{context_id}/messages")
async def get_chat_messages(context_id: str) -> list:
    """Return the message history for a specific chat context."""
    if _agent_zero_available():
        try:
            from agent import AgentContext

            ctx = AgentContext.get(context_id)
            if ctx is not None:
                return _extract_messages(ctx)
        except Exception as e:
            logger.debug("Agent Zero get_messages failed, using fallback: %s", e)

    # Fallback: use local chat store
    ctx = chat_store.get(context_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return ctx.get_messages()


@router.post("/chats", status_code=201)
async def create_chat() -> dict:
    """Create a new empty chat context and return its summary."""
    if _agent_zero_available():
        try:
            from agent import AgentContext
            from bridge import agent_bridge

            config = agent_bridge._build_config(profile="gm")
            ctx = AgentContext(config=config)

            try:
                from python.helpers import persist_chat
                persist_chat.save_tmp_chat(ctx)
            except Exception:
                pass

            logger.info("Created new chat context (Agent Zero): %s", ctx.id)
            return _context_summary(ctx)
        except Exception as e:
            logger.debug("Agent Zero create_chat failed, using fallback: %s", e)

    # Fallback: use local chat store
    ctx = chat_store.create()
    logger.info("Created new chat context (fallback): %s", ctx.id)
    return ctx.to_summary()


@router.delete("/chats/{context_id}", status_code=204)
async def delete_chat(context_id: str) -> None:
    """Remove a chat from memory and disk."""
    deleted = False

    if _agent_zero_available():
        try:
            from agent import AgentContext

            ctx = AgentContext.get(context_id)
            if ctx is not None:
                AgentContext.remove(context_id)
                try:
                    from python.helpers import persist_chat
                    persist_chat.remove_chat(context_id)
                except Exception:
                    pass
                deleted = True
        except Exception:
            pass

    # Also try fallback store
    if chat_store.remove(context_id):
        deleted = True

    if not deleted:
        raise HTTPException(status_code=404, detail="Chat not found")
