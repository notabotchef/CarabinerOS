"""Fallback in-memory chat store for when Agent Zero is not available.

Provides lightweight chat persistence that the REST API and Socket.IO
handlers can use regardless of whether Agent Zero successfully initializes.
This ensures the frontend chat experience works end-to-end even when
Agent Zero dependencies are missing or its initialization fails.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Persist chats to a JSON file in the engine directory
_PERSIST_DIR = Path(__file__).resolve().parent.parent / "data" / "chats"


@dataclass
class ChatMessage:
    role: str  # "user" or "assistant"
    content: str
    timestamp: float = field(default_factory=lambda: datetime.now(timezone.utc).timestamp())


@dataclass
class ChatContext:
    id: str
    name: Optional[str] = None
    messages: List[ChatMessage] = field(default_factory=list)
    created_at: Optional[datetime] = field(default_factory=lambda: datetime.now(timezone.utc))
    last_message: Optional[datetime] = field(default_factory=lambda: datetime.now(timezone.utc))
    chat_type: str = "user"
    running: bool = False

    def to_summary(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_message": self.last_message.isoformat() if self.last_message else None,
            "type": self.chat_type,
            "running": self.running,
        }

    def get_messages(self) -> List[dict]:
        return [{"role": m.role, "content": m.content} for m in self.messages]

    def add_message(self, role: str, content: str) -> None:
        self.messages.append(ChatMessage(role=role, content=content))
        self.last_message = datetime.now(timezone.utc)


class FallbackChatStore:
    """Thread-safe in-memory chat store with optional disk persistence."""

    def __init__(self) -> None:
        self._chats: Dict[str, ChatContext] = {}
        self._lock = threading.RLock()
        self._load_from_disk()

    def create(self, chat_id: Optional[str] = None) -> ChatContext:
        with self._lock:
            cid = chat_id or str(uuid.uuid4())[:8]
            ctx = ChatContext(id=cid)
            self._chats[cid] = ctx
            self._save_to_disk()
            return ctx

    def get(self, chat_id: str) -> Optional[ChatContext]:
        with self._lock:
            return self._chats.get(chat_id)

    def get_or_create(self, chat_id: str) -> ChatContext:
        with self._lock:
            if chat_id not in self._chats:
                self._chats[chat_id] = ChatContext(id=chat_id)
            return self._chats[chat_id]

    def all(self) -> List[ChatContext]:
        with self._lock:
            return sorted(
                self._chats.values(),
                key=lambda c: c.last_message or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )

    def add_message(self, chat_id: str, role: str, content: str) -> None:
        with self._lock:
            ctx = self.get_or_create(chat_id)
            ctx.add_message(role, content)
            # Auto-name from first user message
            if ctx.name is None and role == "user":
                ctx.name = content[:40].strip()
            self._save_to_disk()

    def remove(self, chat_id: str) -> bool:
        with self._lock:
            if chat_id in self._chats:
                del self._chats[chat_id]
                self._save_to_disk()
                return True
            return False

    def _save_to_disk(self) -> None:
        """Persist all chats to a JSON file."""
        try:
            _PERSIST_DIR.mkdir(parents=True, exist_ok=True)
            path = _PERSIST_DIR / "chats.json"
            data = {}
            for cid, ctx in self._chats.items():
                data[cid] = {
                    "id": ctx.id,
                    "name": ctx.name,
                    "created_at": ctx.created_at.isoformat() if ctx.created_at else None,
                    "last_message": ctx.last_message.isoformat() if ctx.last_message else None,
                    "type": ctx.chat_type,
                    "messages": [
                        {"role": m.role, "content": m.content, "timestamp": m.timestamp}
                        for m in ctx.messages
                    ],
                }
            path.write_text(json.dumps(data, indent=2))
        except Exception as e:
            logger.debug("Failed to save fallback chats to disk: %s", e)

    def _load_from_disk(self) -> None:
        """Load chats from disk on startup."""
        try:
            path = _PERSIST_DIR / "chats.json"
            if not path.exists():
                return
            data = json.loads(path.read_text())
            for cid, chat_data in data.items():
                ctx = ChatContext(
                    id=cid,
                    name=chat_data.get("name"),
                    created_at=(
                        datetime.fromisoformat(chat_data["created_at"])
                        if chat_data.get("created_at")
                        else None
                    ),
                    last_message=(
                        datetime.fromisoformat(chat_data["last_message"])
                        if chat_data.get("last_message")
                        else None
                    ),
                    chat_type=chat_data.get("type", "user"),
                    messages=[
                        ChatMessage(
                            role=m["role"],
                            content=m["content"],
                            timestamp=m.get("timestamp", 0),
                        )
                        for m in chat_data.get("messages", [])
                    ],
                )
                self._chats[cid] = ctx
            logger.info("Loaded %d fallback chats from disk", len(self._chats))
        except Exception as e:
            logger.debug("Failed to load fallback chats from disk: %s", e)


# Module-level singleton
chat_store = FallbackChatStore()
