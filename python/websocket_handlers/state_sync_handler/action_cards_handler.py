"""Action cards websocket handler.

Routes card_message, card_commit, and card_dismiss events from the frontend.
card_message is forwarded to Agent Zero for a response, then broadcast as card_reply.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_FALLBACK_ERROR_MSG = "Sorry, something went wrong. Please try again."
_FALLBACK_TIMEOUT_MSG = "Sorry, the request timed out. Please try again."
_FALLBACK_UNAVAILABLE_MSG = "Sorry, the assistant is currently unavailable."

_A0_TIMEOUT = 30  # seconds


# ---------------------------------------------------------------------------
# Result object
# ---------------------------------------------------------------------------


@dataclass
class _Result:
    """Encapsulates an ok/error response from an event handler."""

    ok: bool = True
    data: dict | None = None
    error: dict | None = None

    def as_result(
        self, handler_id: str = "", fallback_correlation_id: Any = None
    ) -> dict:
        if self.ok:
            return {"ok": True, "data": self.data or {}}
        return {"ok": False, "error": self.error or {}}


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------


def _build_card_prompt(text: str, card_context: dict | None) -> str:
    """Build a prompt string that includes optional card context."""
    if not card_context:
        return text

    parts: list[str] = []
    if card_context.get("type"):
        parts.append(f"Card type: {card_context['type']}")
    if card_context.get("module"):
        parts.append(f"Module: {card_context['module']}")
    if card_context.get("summary"):
        parts.append(f"Summary: {card_context['summary']}")
    if card_context.get("detail"):
        parts.append(f"Detail: {card_context['detail']}")

    if not parts:
        return text

    context_block = "\n".join(parts)
    return f"[Card Context]\n{context_block}\n\n[User Message]\n{text}"


# ---------------------------------------------------------------------------
# ActionCardsHandler (singleton)
# ---------------------------------------------------------------------------


class ActionCardsHandler:
    _instance: Optional[ActionCardsHandler] = None

    def __init__(self, sio: Any, lock: RLock) -> None:
        self._sio = sio
        self._lock = lock

    @classmethod
    def get_instance(cls, sio: Any, lock: RLock) -> ActionCardsHandler:
        if cls._instance is None:
            cls._instance = cls(sio, lock)
        return cls._instance

    @classmethod
    def _reset_instance_for_testing(cls) -> None:
        cls._instance = None

    # -- public API --------------------------------------------------------

    async def process_event(
        self, event_type: str, data: dict, sid: str
    ) -> _Result:
        if event_type == "card_message":
            return await self._handle_message(data, sid)
        elif event_type == "card_commit":
            return _Result(ok=True, data={"status": "committed"})
        elif event_type == "card_dismiss":
            return _Result(ok=True, data={"status": "dismissed"})
        return _Result(ok=False, error={"code": "UNKNOWN_EVENT"})

    async def broadcast(self, event: str, payload: dict) -> None:
        """Emit an event to all connected clients via the websocket manager."""
        try:
            from helpers.ws_manager import send_data
            await send_data(event, payload)
        except Exception:
            # Fallback to sio.emit
            await self._sio.emit(event, payload)

    async def _get_a0_response(self, prompt: str) -> str:
        """Call Agent Zero and return the text response."""
        try:
            import agent as agent_module
            ctx = agent_module.AgentContext.first()
            if ctx is None:
                return _FALLBACK_UNAVAILABLE_MSG

            task = ctx.communicate(prompt)
            result = await asyncio.wait_for(task.result(), timeout=_A0_TIMEOUT)

            if not result:
                return _FALLBACK_ERROR_MSG
            return result

        except asyncio.TimeoutError:
            return _FALLBACK_TIMEOUT_MSG
        except Exception:
            logger.exception("Error getting A0 response")
            return _FALLBACK_ERROR_MSG

    # -- internal ----------------------------------------------------------

    async def _handle_message(self, data: dict, sid: str) -> _Result:
        card_id = data.get("cardId")
        text = data.get("text")

        if not card_id:
            return _Result(ok=False, error={"code": "MISSING_CARD_ID"})
        if not text:
            return _Result(ok=False, error={"code": "MISSING_TEXT"})

        card_context = data.get("card")
        prompt = _build_card_prompt(text, card_context)

        response_text = await self._get_a0_response(prompt)

        reply_payload = {
            "cardId": card_id,
            "message": {
                "role": "assistant",
                "text": response_text,
                "timestamp": int(time.time()),
            },
        }

        try:
            await self.broadcast("card_reply", reply_payload)
        except Exception:
            logger.warning("Failed to broadcast card_reply", exc_info=True)

        return _Result(ok=True, data={"status": "replied"})
