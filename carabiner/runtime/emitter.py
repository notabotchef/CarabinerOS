"""Socket.IO envelope wrapper and emit helpers.

Every bridge→frontend payload is wrapped in:

    {
        "handlerId": <str>,        # who emitted (e.g. "bridge.state")
        "eventId":   <str>,        # unique per emit (uuid4 hex)
        "correlationId": <str>,    # echoes client-supplied cid when present
        "ts": <int epoch seconds>,
        "data": { ... }            # the actual event payload
    }

The frontend (``frontend/src/lib/socket-client.ts``) unwraps
``data.snapshot`` and ``data.card``; tests must therefore look inside
``envelope.data``, not at the top level.

Default namespace is ``/ws`` — the same namespace the frontend
subscribes to. Do **not** emit to ``/state_sync``; nothing listens
there and the cards will be silently dropped (see the comment in
``python/tools/action_card.py:147``).
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Dict, Optional


DEFAULT_NAMESPACE = "/ws"


def make_envelope(
    handler_id: str,
    data: Dict[str, Any],
    correlation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a fresh envelope with a unique event id and current ts."""
    return {
        "handlerId": handler_id,
        "eventId": uuid.uuid4().hex,
        "correlationId": correlation_id or "",
        "ts": int(time.time()),
        "data": data,
    }


def emit_state_push(
    sio: Any,
    context: str,
    snapshot: Dict[str, Any],
    correlation_id: Optional[str] = None,
    sid: Optional[str] = None,
    namespace: str = DEFAULT_NAMESPACE,
) -> str:
    """Emit a ``state_push`` event with the full snapshot.

    Returns the event id (useful for logging / tests).
    Pass ``sid`` to target a single connected client; ``None`` means
    "broadcast to everyone on the namespace".
    """
    envelope = make_envelope(
        handler_id="bridge.state",
        data={"snapshot": snapshot, "context": context},
        correlation_id=correlation_id,
    )
    if sid is not None:
        sio.emit("state_push", envelope, to=sid, namespace=namespace)
    else:
        sio.emit("state_push", envelope, namespace=namespace)
    return envelope["eventId"]


def emit_action_card(
    sio: Any,
    card: Dict[str, Any],
    correlation_id: Optional[str] = None,
    sid: Optional[str] = None,
    namespace: str = DEFAULT_NAMESPACE,
) -> str:
    """Emit an ``action_card`` event.

    The card dict must already conform to the schema in
    ``python/tools/action_card.py:127-143`` (id, type, module, action,
    summary, detail, itemId, chatId, changes, stats, priority,
    deadline, status, timestamp, source).
    """
    envelope = make_envelope(
        handler_id="bridge.cards",
        data={"card": card},
        correlation_id=correlation_id,
    )
    if sid is not None:
        sio.emit("action_card", envelope, to=sid, namespace=namespace)
    else:
        sio.emit("action_card", envelope, namespace=namespace)
    return envelope["eventId"]


def emit_card_reply(
    sio: Any,
    card_id: str,
    text: str,
    correlation_id: Optional[str] = None,
    sid: Optional[str] = None,
    namespace: str = DEFAULT_NAMESPACE,
) -> str:
    """Emit a ``card_reply`` event (assistant text attached to a card)."""
    envelope = make_envelope(
        handler_id="bridge.cards",
        data={"cardId": card_id, "text": text},
        correlation_id=correlation_id,
    )
    if sid is not None:
        sio.emit("card_reply", envelope, to=sid, namespace=namespace)
    else:
        sio.emit("card_reply", envelope, namespace=namespace)
    return envelope["eventId"]
