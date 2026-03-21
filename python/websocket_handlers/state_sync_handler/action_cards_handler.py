"""Handle client-to-server action card events on /state_sync.

Events:
- card_commit  -- chef confirms a card (log only for v0.1)
- card_dismiss -- chef dismisses a card (log only for v0.1)
- card_message -- inline chat on a card; routes to A0 and replies
"""

from __future__ import annotations

import logging
import time
from typing import Any

from python.helpers.websocket import WebSocketHandler, WebSocketResult

logger = logging.getLogger(__name__)


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

        # v0.1: acknowledge with a stub reply.  Full A0 routing will be added
        # when the card-message->agent pipeline is wired in a later iteration.
        reply_message = {
            "role": "assistant",
            "text": f"Acknowledged. Card {card_id[:8]} noted.",
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
