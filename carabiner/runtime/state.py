"""In-memory snapshot store for the bridge.

Owns the per-context log buffers, the assistant progress flag, and the
throttle that batches successive state_push emits.

KEY INVARIANTS (spec: carabineros-migration-plan.md §3, "Frontend
contract the bridge must match exactly"):

1. ``log_progress_active`` is set to ``True`` at the start of every
   ``message_async`` and reset to ``False`` in a ``finally`` block
   no matter what. If we skip the reset the spinner / client queue
   stalls forever.
2. The streaming assistant response is **a single log entry** with one
   ``no``. Content grows across pushes in place; the frontend dedups
   by ``no-{no}``.
3. User messages get ``{type: "user"}`` log entries.
4. ``to_snapshot(context)`` returns a dict that contains every field
   the frontend reads: ``deselect_chat, context, contexts[], tasks:[],
   logs, log_guid, log_version, log_progress, log_progress_active,
   paused, notifications, notifications_guid, notifications_version``.

Persistence is delegated to ``carabiner.chat_store`` (the
``FallbackChatStore`` singleton); the snapshot store is the in-memory
mirror that drives the live socket protocol.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

# chat_store is the existing FallbackChatStore singleton from
# carabiner/chat_store.py:173. The bridge adds messages through it
# and reads them back via ``chat_store.get(ctxid).get_messages()``.
from carabiner import chat_store as _chat_store_module  # type: ignore
from carabiner.chat_store import chat_store  # type: ignore


logger = logging.getLogger(__name__)


# Monotonic counter used to build a fresh ``log_guid`` whenever the
# log set for a context changes. The frontend uses this to detect
# "the log buffer has been reset / replaced" (e.g. on chat load).
def _new_guid() -> str:
    return uuid.uuid4().hex


def _now() -> int:
    return int(time.time())


@dataclass
class ContextState:
    """Per-context in-memory state."""

    context: str
    # Ordered list of log entries. Each entry is a dict with at least
    # ``no`` (0-based within this context) and ``type``.
    logs: List[Dict[str, Any]] = field(default_factory=list)
    # notifications are a separate buffer (the action-card list) and
    # keep their own guid/version so the UI can detect reloads
    # independently of the chat log.
    notifications: List[Dict[str, Any]] = field(default_factory=list)
    notifications_guid: str = field(default_factory=_new_guid)
    notifications_version: int = 0
    log_guid: str = field(default_factory=_new_guid)
    log_version: int = 0
    # Assistant progress flag (the spinner). Always reset in finally.
    log_progress: bool = False
    log_progress_active: bool = False
    paused: bool = False
    # Throttle bookkeeping: timestamp of the last emitted push.
    last_emit_ts: float = 0.0
    # Pending broadcast (used by SnapshotStore.push() to coalesce).
    dirty: bool = False


class SnapshotStore:
    """Process-wide in-memory snapshot store.

    The store is keyed by chat context id. Each context has its own
    log buffer, progress flag, and notification buffer. The store is
    safe to call from the FastAPI threadpool *and* from the
    python-socketio async loop — all mutations go through an asyncio
    lock (we accept that the lock is in-loop; the underlying lists
    are private and the lock is held for the duration of any mutating
    operation).
    """

    PUSH_THROTTLE_S = 0.2  # ~200ms per spec

    def __init__(self) -> None:
        self._contexts: Dict[str, ContextState] = {}
        self._lock = threading.RLock()
        # runtime_epoch is bumped on process restart; seq_base is
        # always 0 (no delta protocol — every state_push is a full
        # snapshot per the Fable audit).
        self._runtime_epoch = _new_guid()
        self._seq_base = 0
        # Per-context push tasks (used to throttle broadcasts).
        self._pending_tasks: Dict[str, asyncio.Task] = {}

    # ---- accessors ---------------------------------------------------------

    def get_or_create(self, context: str) -> ContextState:
        with self._lock:
            cs = self._contexts.get(context)
            if cs is None:
                cs = ContextState(context=context)
                self._contexts[context] = cs
            return cs

    def get(self, context: str) -> Optional[ContextState]:
        with self._lock:
            return self._contexts.get(context)

    @property
    def runtime_epoch(self) -> str:
        return self._runtime_epoch

    @property
    def seq_base(self) -> int:
        return self._seq_base

    # ---- log mutations -----------------------------------------------------

    def append_user_log(self, context: str, content: str) -> Dict[str, Any]:
        """Append a user message log; persist via FallbackChatStore."""
        with self._lock:
            cs = self.get_or_create(context)
            entry = {
                "no": len(cs.logs),
                "type": "user",
                "content": content,
                "timestamp": _now(),
            }
            cs.logs.append(entry)
            cs.log_version += 1
            cs.dirty = True
        # Persist outside the lock.
        try:
            chat_store.add_message(context, "user", content)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to persist user message for %s: %s", context, exc)
        return entry

    def begin_assistant_log(self, context: str) -> Dict[str, Any]:
        """Create the (single) assistant response log; returns it.

        Subsequent ``append_assistant_delta`` calls update this entry
        in place — same ``no``, growing ``content`` — so the frontend
        can dedup by ``no-{no}``.
        """
        with self._lock:
            cs = self.get_or_create(context)
            entry = {
                "no": len(cs.logs),
                "type": "response",
                "agentno": 0,
                "content": "",
                "timestamp": _now(),
            }
            cs.logs.append(entry)
            cs.log_version += 1
            cs.dirty = True
        return entry

    def append_assistant_delta(self, context: str, no: int, chunk: str) -> Dict[str, Any]:
        """Append ``chunk`` to the assistant log identified by ``no``."""
        with self._lock:
            cs = self.get_or_create(context)
            if 0 <= no < len(cs.logs):
                existing = cs.logs[no]
                if existing.get("type") == "response":
                    existing["content"] = (existing.get("content") or "") + chunk
                    existing["timestamp"] = _now()
                    cs.dirty = True
                    return existing
        # If the no is gone (e.g. snapshot was reset) we silently
        # drop the delta — the next full snapshot will be the source
        # of truth.
        return {"no": no, "type": "response", "content": chunk, "timestamp": _now()}

    def finalize_assistant_log(self, context: str, no: int, full_text: str) -> None:
        """Replace the assistant log's content with ``full_text`` (final)."""
        with self._lock:
            cs = self.get_or_create(context)
            if 0 <= no < len(cs.logs):
                entry = cs.logs[no]
                if entry.get("type") == "response":
                    entry["content"] = full_text
                    entry["timestamp"] = _now()
                    cs.dirty = True

    def append_tool_log(
        self,
        context: str,
        heading: str,
        content: str = "",
        tool_name: str = "",
    ) -> Dict[str, Any]:
        """Append a ``{type:"tool"}`` log entry (in-bridge MCP tools)."""
        with self._lock:
            cs = self.get_or_create(context)
            entry = {
                "no": len(cs.logs),
                "type": "tool",
                "heading": heading,
                "content": content,
                "tool_name": tool_name,
                "timestamp": _now(),
            }
            cs.logs.append(entry)
            cs.log_version += 1
            cs.dirty = True
        return entry

    # ---- progress flag (the always-finally gate) ---------------------------

    def set_progress(self, context: str, active: bool) -> None:
        """Set the progress flag. **Always call from a try/finally.**"""
        with self._lock:
            cs = self.get_or_create(context)
            cs.log_progress = active
            cs.log_progress_active = active
            cs.dirty = True

    # ---- notifications (action-card mirror) --------------------------------

    def add_notification(self, context: str, card: Dict[str, Any]) -> None:
        with self._lock:
            cs = self.get_or_create(context)
            cs.notifications.append(card)
            cs.notifications_version += 1
            cs.notifications_guid = _new_guid()
            cs.dirty = True

    def update_notification(self, context: str, card_id: str, **patch: Any) -> Optional[Dict[str, Any]]:
        with self._lock:
            cs = self.get_or_create(context)
            for n in cs.notifications:
                if n.get("id") == card_id:
                    n.update(patch)
                    cs.notifications_version += 1
                    cs.notifications_guid = _new_guid()
                    cs.dirty = True
                    return n
        return None

    def remove_notification(self, context: str, card_id: str) -> bool:
        with self._lock:
            cs = self.get_or_create(context)
            for i, n in enumerate(cs.notifications):
                if n.get("id") == card_id:
                    cs.notifications.pop(i)
                    cs.notifications_version += 1
                    cs.notifications_guid = _new_guid()
                    cs.dirty = True
                    return True
        return False

    # ---- snapshot ----------------------------------------------------------

    def to_snapshot(self, context: str) -> Dict[str, Any]:
        """Build the full snapshot dict for ``context``.

        Includes **every** field the Fable audit §3 frontend-contract
        spec calls out. Frontend-side dedup is by ``no-{no}``; we just
        return the raw ``logs`` list.
        """
        with self._lock:
            cs = self.get_or_create(context)
            # Sidebar list (the contexts[] array) — snapshot of all
            # known contexts sorted by last_message desc.
            contexts_summary = self._contexts_summary()
            return {
                "deselect_chat": False,
                "context": context,
                "contexts": contexts_summary,
                "tasks": [],
                "logs": list(cs.logs),
                "log_guid": cs.log_guid,
                "log_version": cs.log_version,
                "log_progress": cs.log_progress,
                "log_progress_active": cs.log_progress_active,
                "paused": cs.paused,
                "notifications": list(cs.notifications),
                "notifications_guid": cs.notifications_guid,
                "notifications_version": cs.notifications_version,
            }

    def _contexts_summary(self) -> List[Dict[str, Any]]:
        """Build the sidebar list from the in-memory store + persistent store.

        The persistent store (FallbackChatStore) is the source of
        truth for the sidebar; the in-memory mirror only knows about
        contexts that have ever streamed a log. We merge both and
        dedup by id, preferring the persistent summary.
        """
        out: Dict[str, Dict[str, Any]] = {}
        try:
            for ctx in chat_store.all():
                out[ctx.id] = {
                    "id": ctx.id,
                    "name": ctx.name,
                    "last_message": (
                        ctx.last_message.isoformat() if ctx.last_message else None
                    ),
                    "log_version": self._contexts.get(ctx.id, ContextState(ctx.id)).log_version,
                }
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("chat_store.all() failed: %s", exc)
        for cid, cs in self._contexts.items():
            if cid not in out:
                out[cid] = {
                    "id": cid,
                    "name": None,
                    "last_message": None,
                    "log_version": cs.log_version,
                }
        # Sort by last_message desc (None goes last).
        def _sort_key(item: Dict[str, Any]) -> str:
            return item.get("last_message") or ""
        return sorted(out.values(), key=_sort_key, reverse=True)

    # ---- throttled broadcast ----------------------------------------------

    def mark_dirty(self, context: str) -> None:
        with self._lock:
            cs = self.get_or_create(context)
            cs.dirty = True

    def should_emit(self, context: str) -> bool:
        """Return True if enough time has passed since the last push.

        Coalesces bursts of state mutations into ~200ms-paced pushes
        so the frontend isn't flooded. Callers that want to bypass
        the throttle (e.g. final emits after a run completes) can
        simply call ``emit_state_push`` directly instead of going
        through the throttler.
        """
        with self._lock:
            cs = self.get_or_create(context)
            now = time.monotonic()
            if (now - cs.last_emit_ts) >= self.PUSH_THROTTLE_S:
                cs.last_emit_ts = now
                cs.dirty = False
                return True
            return False

    def reset(self) -> None:
        """Test helper — drop all per-context state."""
        with self._lock:
            self._contexts.clear()
            self._runtime_epoch = _new_guid()


# ---- process-wide singleton -------------------------------------------------


_store_singleton: Optional[SnapshotStore] = None


def get_store() -> SnapshotStore:
    """Return the process-wide ``SnapshotStore`` (lazy-initialised)."""
    global _store_singleton
    if _store_singleton is None:
        _store_singleton = SnapshotStore()
    return _store_singleton


def reset_store() -> None:
    """Test helper — drop the singleton so a fresh one is built next call."""
    global _store_singleton
    _store_singleton = None
