"""Socket.IO handlers for the ``/ws`` namespace.

This is the bridge's real-time layer. It owns the contract that the
frontend's ``socket-client.ts`` subscribes to (see
``docs/.../carabineros-hermes-migration-plan.md`` §3). Every emit
goes through ``carabiner.runtime.emitter`` so the envelope is
consistent across HTTP and socket paths.

Handlers (in this order):

- ``connect``              — verify CSRF token + ``handlers=["ws_webui"]``
- ``state_request``        — ack ``{ok, data:{runtime_epoch, seq_base},
                              correlationId}`` + immediate full snapshot
                              (no delta protocol per Fable audit)
- ``card_commit``          — idempotent status guard → policy re-check
                              → execute (stub) → audit write → re-emit
                              ``action_card`` with ``status:"committed"``.
                              Fails closed if ``AUDIT_REQUIRED`` and
                              the audit write fails.
- ``card_dismiss``         — re-emit ``action_card`` with
                              ``status:"dismissed"``.
- ``card_message``         — emit ``card_reply`` (assistant text back
                              to the originating card).

This module replaces the A0-side no-ops at
``python/websocket_handlers/state_sync_handler/action_cards_handler.py:107-109``.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, Optional

import socketio  # python-socketio (>=5.11)

from carabiner.runtime import config as runtime_config
from carabiner.runtime import emitter
from carabiner.runtime import security
from carabiner.runtime import state as runtime_state


logger = logging.getLogger(__name__)


# Card status lifecycle strings — match the A0 convention so the
# frontend's ``use-action-cards.ts`` doesn't need a second source of
# truth.
STATUS_NEW = "new"
STATUS_COMMITTED = "committed"
STATUS_DISMISSED = "dismissed"


def build_server(
    cfg: Optional[runtime_config.RuntimeConfig] = None,
    store: Optional[runtime_state.SnapshotStore] = None,
    async_mode: str = "asgi",
) -> socketio.AsyncServer:
    """Build and return a configured AsyncServer.

    The server is namespaced to ``/ws``; we expose it as an ASGI
    application through ``socketio.ASGIApp`` in ``server.py``.
    """

    if cfg is None:
        cfg = runtime_config.get_config()
    if store is None:
        store = runtime_state.get_store()
    assert cfg is not None and store is not None  # nosec

    runtime_id = security.derive_runtime_id(cfg.bridge_secret_key)
    server = socketio.AsyncServer(
        async_mode=async_mode,
        cors_allowed_origins="*",
        namespaces=["/ws"],
        logger=False,
        engineio_logger=False,
    )

    # ---- /ws namespace handlers ------------------------------------------

    @server.on("connect", namespace="/ws")
    async def _connect(sid: str, environ: Dict[str, Any], auth: Optional[Dict[str, Any]] = None) -> bool:
        # The python-socketio client passes the ``auth`` payload as
        # the third positional argument; the JS client sends it as
        # the ``auth`` field in the handshake options.
        payload = auth if isinstance(auth, dict) else None
        if payload is None:
            # Fallback: some transports surface ``auth`` inside
            # ``environ`` under ``"aiohttp.request"`` / ``"asgi"`` keys.
            payload = (environ or {}).get("auth")  # type: ignore[assignment]
        ok = security.verify_socket_auth(cfg.bridge_secret_key, runtime_id, payload)
        if not ok:
            logger.info("ws connect refused: invalid handshake (sid=%s)", sid)
            return False  # refuses the connection
        logger.debug("ws connect accepted: sid=%s", sid)
        return True

    @server.on("disconnect", namespace="/ws")
    async def _disconnect(sid: str) -> None:
        logger.debug("ws disconnect: sid=%s", sid)

    @server.on("state_request", namespace="/ws")
    async def _state_request(sid: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        data = data or {}
        context = data.get("context") or "default"
        # Per the Fable audit the client always sends ``log_from: 0``,
        # so we always return the full snapshot — no delta protocol.
        correlation_id = data.get("correlationId") or ""
        snapshot = store.to_snapshot(context)
        # Ack first (small, fast), then push the full snapshot.
        await _safe_emit_state_push(
            server, context, snapshot,
            correlation_id=correlation_id,
            sid=sid,
            runtime_epoch=store.runtime_epoch,
            seq=store.seq_base,
        )
        return {
            "ok": True,
            "data": {
                "runtime_epoch": store.runtime_epoch,
                "seq": store.seq_base,
            },
            "correlationId": correlation_id,
        }

    @server.on("card_commit", namespace="/ws")
    async def _card_commit(sid: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Commit a proposed action card.

        The lifecycle (status guard → policy re-check → mutation →
        audit → re-emit) lives in :func:`carabiner.runtime.cards.commit`.
        The socket handler is a thin shim that:
          1. locates the card in the snapshot store's notifications
          2. seeds the card into ``cards._REGISTRY`` (since cards.py
             has its own in-memory registry, separate from the
             SnapshotStore's notifications list)
          3. delegates to ``cards.commit`` for the real work
          4. mirrors the committed card back into the snapshot store
             so state_request includes the updated status
        """
        data = data or {}
        card_id = data.get("cardId")
        correlation_id = data.get("correlationId") or ""
        if not card_id:
            return {"ok": False, "error": "missing_cardId", "correlationId": correlation_id}

        context = data.get("context") or "default"
        cs = store.get(context)
        if cs is None:
            return {"ok": False, "error": "context_not_found", "correlationId": correlation_id}

        card = next((n for n in cs.notifications if n.get("id") == card_id), None)
        if card is None:
            return {"ok": False, "error": "card_not_found", "correlationId": correlation_id}

        # ---- idempotency at the socket layer --------------------------
        if card.get("status") == STATUS_COMMITTED:
            return {"ok": True, "idempotent": True, "correlationId": correlation_id}

        # ---- delegate to cards.commit for the real lifecycle ---------
        # cards.py keeps its own _REGISTRY; if this card originated
        # from the MCP surface, it's already there. If it originated
        # via the legacy action_card emit path (python/tools/action_card.py),
        # we seed it here from the snapshot-store notification.
        try:
            from carabiner.runtime import cards as cards_mod
        except ImportError as exc:  # pragma: no cover
            return {"ok": False, "error": "cards_unavailable", "detail": str(exc)}

        existing = cards_mod.get(card_id)
        if existing is None:
            # Seed: convert the notification card into the cards.py
            # shape (add ``_propose_data`` so commit() can find the
            # mutation payload).
            seeded = dict(card)
            seeded.setdefault("_propose_data", card.get("detail_data") or {})
            cards_mod._REGISTRY[card_id] = seeded

        try:
            committed = await cards_mod.commit(card_id, sio=server)
        except KeyError:
            return {"ok": False, "error": "card_not_found", "correlationId": correlation_id}
        except PermissionError as exc:
            return {"ok": False, "error": "policy_denied", "detail": str(exc), "correlationId": correlation_id}
        except Exception as exc:  # noqa: BLE001
            logger.error("commit failed: %s", exc, exc_info=True)
            return {"ok": False, "error": "commit_failed", "detail": str(exc), "correlationId": correlation_id}

        # ---- mirror the result back into the snapshot store -----------
        store.update_notification(context, card_id, status=STATUS_COMMITTED)

        # Re-emit using the cards.py-committed dict (carries the
        # timestamp + status fields from the real lifecycle).
        await emitter.emit_action_card(server, committed, correlation_id=correlation_id, sid=sid)
        return {"ok": True, "status": STATUS_COMMITTED, "correlationId": correlation_id}

    @server.on("card_dismiss", namespace="/ws")
    async def _card_dismiss(sid: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Dismiss a proposed action card.

        Delegates to :func:`carabiner.runtime.cards.dismiss` so the
        audit row is written with the same metadata shape as commit.
        """
        data = data or {}
        card_id = data.get("cardId")
        correlation_id = data.get("correlationId") or ""
        if not card_id:
            return {"ok": False, "error": "missing_cardId", "correlationId": correlation_id}
        context = data.get("context") or "default"
        cs = store.get(context)
        if cs is None:
            return {"ok": False, "error": "context_not_found", "correlationId": correlation_id}
        card = next((n for n in cs.notifications if n.get("id") == card_id), None)
        if card is None:
            return {"ok": False, "error": "card_not_found", "correlationId": correlation_id}

        # Delegate to the cards lifecycle.
        try:
            from carabiner.runtime import cards as cards_mod
        except ImportError as exc:  # pragma: no cover
            return {"ok": False, "error": "cards_unavailable", "detail": str(exc)}

        existing = cards_mod.get(card_id)
        if existing is None:
            seeded = dict(card)
            seeded.setdefault("_propose_data", card.get("detail_data") or {})
            cards_mod._REGISTRY[card_id] = seeded

        try:
            dismissed = await cards_mod.dismiss(card_id, sio=server)
        except KeyError:
            return {"ok": False, "error": "card_not_found", "correlationId": correlation_id}
        except Exception as exc:  # noqa: BLE001
            logger.error("dismiss failed: %s", exc, exc_info=True)
            return {"ok": False, "error": "dismiss_failed", "detail": str(exc), "correlationId": correlation_id}

        store.update_notification(context, card_id, status=STATUS_DISMISSED)
        await emitter.emit_action_card(server, dismissed, correlation_id=correlation_id, sid=sid)
        return {"ok": True, "status": STATUS_DISMISSED, "correlationId": correlation_id}

    @server.on("card_message", namespace="/ws")
    async def _card_message(sid: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        data = data or {}
        card_id = data.get("cardId")
        text = (data.get("text") or "").strip()
        correlation_id = data.get("correlationId") or ""
        if not card_id or not text:
            return {"ok": False, "error": "missing_fields", "correlationId": correlation_id}
        # Echo the reply back; real routing (LLM read of card context
        # → answer text) is added in P6.4.
        await emitter.emit_card_reply(server, card_id, f"echo: {text}", correlation_id=correlation_id, sid=sid)
        return {"ok": True, "correlationId": correlation_id}

    return server


# ---- helpers ---------------------------------------------------------------


async def _safe_emit_state_push(
    server: socketio.AsyncServer,
    context: str,
    snapshot: Dict[str, Any],
    correlation_id: str,
    sid: Optional[str] = None,
    runtime_epoch: Optional[str] = None,
    seq: Optional[int] = None,
) -> str:
    """Emit a state_push with throttle awareness; swallow transient errors."""
    try:
        return await emitter.emit_state_push(
            server,
            context,
            snapshot,
            correlation_id=correlation_id,
            sid=sid,
            runtime_epoch=runtime_epoch,
            seq=seq,
        )
    except Exception as exc:  # pragma: no cover - transport
        logger.warning("state_push emit failed: %s", exc)
        return ""
