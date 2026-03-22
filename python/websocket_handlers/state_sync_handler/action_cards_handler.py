"""Handle client-to-server action card events on /state_sync.

Events:
- card_commit  -- chef confirms a card (log only for v0.1)
- card_dismiss -- chef dismisses a card (log only for v0.1)
- card_message -- inline chat on a card; routes to A0 and replies
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from python.helpers.websocket import WebSocketHandler, WebSocketResult

logger = logging.getLogger(__name__)

# Timeout (seconds) for waiting on A0 to respond to a card message.
_A0_TIMEOUT_SECONDS = 30

_FALLBACK_TIMEOUT_MSG = "I'm still working on this. Please check back."
_FALLBACK_ERROR_MSG = "Something went wrong. Try asking in the main chat."
_FALLBACK_UNAVAILABLE_MSG = "Agent unavailable. Try asking in the main chat."


def _build_card_prompt(text: str, card: dict[str, Any] | None) -> str:
    """Build an A0-consumable prompt that includes card context."""
    if not card:
        return text

    card_type = card.get("type", "unknown")
    module = card.get("module", "unknown")
    summary = card.get("summary", "")
    detail = card.get("detail", "")

    parts = [
        f"Chef is responding to a {card_type} action card",
        f"about {module}",
    ]
    if summary:
        parts.append(f": '{summary}'")
    if detail:
        parts.append(f" (detail: {detail})")
    parts.append(f". Message: {text}")

    return "".join(parts)


class ActionCardsHandler(WebSocketHandler):
    @classmethod
    def get_event_types(cls) -> list[str]:
        return ["card_commit", "card_dismiss", "card_message"]

    async def process_event(
        self,
        event_type: str,
        data: dict[str, Any],
        sid: str,
    ) -> dict[str, Any] | WebSocketResult | None:
        card_id = data.get("cardId")
        if not card_id:
            return self.result_error(
                code="MISSING_CARD_ID",
                message="cardId is required",
            )

        if event_type == "card_commit":
            return await self._handle_commit(card_id, sid)
        elif event_type == "card_dismiss":
            return await self._handle_dismiss(card_id, sid)
        elif event_type == "card_message":
            return await self._handle_message(card_id, data, sid)

        return None

    async def _handle_commit(self, card_id: str, sid: str) -> WebSocketResult:
        logger.info("[ActionCards] card_commit cardId=%s sid=%s", card_id, sid)
        return self.result_ok({"cardId": card_id, "status": "committed"})

    async def _handle_dismiss(self, card_id: str, sid: str) -> WebSocketResult:
        logger.info("[ActionCards] card_dismiss cardId=%s sid=%s", card_id, sid)
        return self.result_ok({"cardId": card_id, "status": "dismissed"})

    async def _handle_message(
        self, card_id: str, data: dict[str, Any], sid: str
    ) -> WebSocketResult:
        text = data.get("text", "")
        if not text:
            return self.result_error(
                code="MISSING_TEXT",
                message="text is required for card_message",
            )

        logger.info(
            "[ActionCards] card_message cardId=%s sid=%s text=%s",
            card_id,
            sid,
            text[:80],
        )

        # Build prompt with card context from frontend
        card_context = data.get("card")  # optional dict from frontend
        prompt = _build_card_prompt(text, card_context)

        # Route through A0 agent processing
        response_text = await self._get_a0_response(prompt)

        reply_message = {
            "role": "assistant",
            "text": response_text,
            "timestamp": time.time(),
        }

        # Emit the reply back to all connected clients on this namespace
        try:
            await self.broadcast(
                "card_reply",
                {"cardId": card_id, "message": reply_message},
            )
        except Exception as exc:
            logger.warning("[ActionCards] failed to emit card_reply: %s", exc)

        return self.result_ok({"cardId": card_id, "status": "replied"})

    async def _get_a0_response(self, prompt: str) -> str:
        """Send prompt to A0 and return the text response.

        Uses the first available AgentContext (the main chat context).
        Falls back to a user-friendly error message on any failure.
        """
        try:
            from agent import AgentContext, UserMessage

            context = AgentContext.first()
            if not context:
                logger.warning("[ActionCards] no AgentContext available")
                return _FALLBACK_UNAVAILABLE_MSG

            task = context.communicate(UserMessage(prompt))
            result = await asyncio.wait_for(
                task.result(),
                timeout=_A0_TIMEOUT_SECONDS,
            )

            if not result or not isinstance(result, str):
                logger.warning("[ActionCards] A0 returned empty/non-string: %r", result)
                return _FALLBACK_ERROR_MSG

            return result

        except asyncio.TimeoutError:
            logger.warning(
                "[ActionCards] A0 timed out after %ds", _A0_TIMEOUT_SECONDS
            )
            return _FALLBACK_TIMEOUT_MSG
        except Exception:
            logger.exception("[ActionCards] A0 processing failed")
            return _FALLBACK_ERROR_MSG
