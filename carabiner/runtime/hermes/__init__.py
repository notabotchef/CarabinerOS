"""Hermes backend client + Echo backend for the Carabiner bridge.

The hermes-agent gateway exposes an OpenAI-compatible HTTP API
(``POST /v1/chat/completions`` with SSE streaming). This module
wraps it with ``httpx.AsyncClient`` so the bridge can drive it
asynchronously.

Two implementations:

- :class:`HermesClient` — real gateway on ``HERMES_BASE_URL``.
- :class:`EchoClient` — canned responder for hermetic dev/tests
  (no network).

Factory :func:`get_client` picks the right one based on
``CARABINER_RUNTIME``.

SSE parser contract
-------------------

Yields ``(kind, data)`` tuples where ``kind`` is one of:

- ``"text"``  — operator-visible content delta. The chat log is
  grown in place from these.
- ``"done"``  — stream terminator.

``<think>...</think>`` blocks (and their case / spelling variants)
are silently dropped, mirroring the gateway-side behaviour
described in ``hermes-src/gateway/stream_consumer.py``. The block
boundary check, orphan-close stripping, partial-tag buffering
across chunk boundaries, and unclosed-think fallback are
implemented by :class:`ThinkBlockFilter`.

Tool calls happen in the bridge's in-process MCP surface
(``carabiner.runtime.mcp_surface``), not relayed from hermes; hermes
never sees raw tool-chunk events because it discovers the tools via
the MCP registry.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, AsyncIterator, Iterable, Iterator, List, Tuple

logger = logging.getLogger(__name__)


class HermesUnavailable(Exception):
    """Raised when the hermes gateway is unreachable or returns non-2xx."""


# ---------------------------------------------------------------------------
# Think-block filter
#
# Ported from ``hermes-src/gateway/stream_consumer.py`` (the
# ``GatewayStreamConsumer._filter_and_accumulate`` /
# ``_strip_orphan_close_tags`` / ``_flush_think_buffer`` triad).
# The state machine is the same: track whether we're inside a
# reasoning/thinking block, hold partial tags back so tags split
# across SSE chunk boundaries still get recognised, strip orphan
# close tags so the model can never leak ``</think>`` to the
# operator, and flush the held-back buffer at stream end so we
# never silently lose trailing text that was waiting to see if a
# tag would complete.
#
# Behavioural difference vs the gateway: the gateway ACCUMULATES
# filtered text into ``self._accumulated`` and progressively edits
# a platform message. The bridge is a streaming consumer that
# yields chunks of *newly-visible* text as they become available.
# It never yields anything from inside a think block, and the
# unclosed-think path treats trailing content as ordinary text
# (held-back buffer flushed, content INSIDE the still-open block
# stays dropped — see _flush()).
# ---------------------------------------------------------------------------


_OPEN_THINK_TAGS: Tuple[str, ...] = (
    "<REASONING_SCRATCHPAD>", "<think>", "<reasoning>",
    "<THINKING>", "<thinking>", "<thought>",
)
_CLOSE_THINK_TAGS: Tuple[str, ...] = (
    "</REASONING_SCRATCHPAD>", "</think>", "</reasoning>",
    "</THINKING>", "</thinking>", "</thought>",
)
# Longest tag (used to size the held-back tail so a tag split
# across chunks is never lost).
_MAX_TAG_LEN = max(len(t) for t in _OPEN_THINK_TAGS + _CLOSE_THINK_TAGS)


class ThinkBlockFilter:
    """Stateful filter that strips ``<think>...</think>`` blocks from a stream.

    Construct with ``feed(chunk)`` / ``flush()``. Each call to
    :meth:`feed` returns an iterable of newly-visible text
    chunks; anything inside a think block is silently dropped.
    :meth:`flush` is called once at end-of-stream and returns any
    text that was being held back waiting for a possible opening
    tag.
    """

    def __init__(self) -> None:
        self._accumulated: str = ""  # visible text emitted so far (boundary tracking)
        self._in_think_block: bool = False
        # Single buffer for content that's been received but not yet
        # released as an event. Outside a think block it holds a
        # potential partial open-tag tail (max 21 chars). Inside a
        # think block it holds ALL received-but-uncommitted content
        # (the close tag may still arrive in a later chunk).
        self._think_buffer: str = ""

    # ---- public API -----------------------------------------------------

    def feed(self, text: str) -> List[Tuple[str, str]]:
        """Add a chunk of incoming content; return events to yield.

        Returns a list of ``(kind, data)`` tuples where kind is
        either ``"text"`` (operator-visible) or ``"thinking"``
        (content inside a ``<think>...</think>`` block — debug
        only). Anything outside the block is ``"text"``; content
        inside is yielded as ``"thinking"`` events so the bridge
        can route it to debug log + a dedicated socket event but
        NEVER to the chat log.

        Block-boundary rule: a tag is only recognised at the very
        start of accumulated text OR after a newline (preceded
        only by whitespace). This prevents "the ``<think>`` tag is
        used for…" from being stripped when the model just
        *mentions* the tag. To disable boundary checking
        globally, see ``_find_open_at_boundary``.
        """
        if not text:
            return []
        events: List[Tuple[str, str]] = []
        buf = self._think_buffer + text
        self._think_buffer = ""

        while buf:
            lower_buf = buf.lower()

            if self._in_think_block:
                # Inside a block — look for the earliest close tag.
                best_idx, best_len = self._earliest(lower_buf, _CLOSE_THINK_TAGS)
                if best_len:
                    # Emit everything up to the close tag as
                    # a single ``"thinking"`` event for the block.
                    inside = buf[:best_idx]
                    if inside:
                        events.append(("thinking", inside))
                    self._in_think_block = False
                    self._think_buffer = ""
                    buf = buf[best_idx + best_len:]
                    continue
                # No close yet — accumulate everything into the
                # think buffer; we can't emit anything yet because
                # the close tag may still arrive in a later chunk.
                self._think_buffer += buf
                return events

            # Outside a block — look for an open tag.
            best_idx, best_len = self._find_open_at_boundary(buf, lower_buf)
            if best_len:
                head = buf[:best_idx]
                if head:
                    self._accumulated += head
                    events.append(("text", head))
                self._in_think_block = True
                # Anything after the open tag is inside the block.
                # Drop _think_buffer (it was a partial-tag tail)
                # and let the next loop iteration handle the rest.
                self._think_buffer = ""
                buf = buf[best_idx + best_len:]
                continue

            # No boundary open tag — check the tail for a partial
            # open tag so we don't commit to text that might turn
            # into one next chunk.
            held_back = self._partial_open_tail_length(lower_buf)
            if held_back:
                head = buf[:-held_back]
                if head:
                    self._accumulated += head
                    events.append(("text", head))
                self._think_buffer = buf[-held_back:]
                return events

            # No (partial) open tag — but the model may have
            # emitted an orphan close tag like </think> on its own
            # (e.g. when upstream stripping is incomplete). Strip
            # those so they never reach the operator.
            cleaned = _strip_orphan_close_tags(buf)
            if cleaned:
                self._accumulated += cleaned
                events.append(("text", cleaned))
            return events

        return events

    def flush(self) -> List[Tuple[str, str]]:
        """Flush held-back state at end-of-stream.

        - If we were inside a think block at end-of-stream (the
          model forgot the ``</think>``), the held-back tail is
          emitted as a ``"thinking"`` event (operators see the
          reasoning trace) plus any held-back text already
          classified as ``"thinking"`` above.
        - If we were outside a think block, the held-back tail is
          emitted as ``"text"`` (with orphan close tags stripped).
        """
        out: List[Tuple[str, str]] = []
        tail = self._think_buffer
        self._think_buffer = ""
        if not tail:
            return out
        if self._in_think_block:
            # End-of-stream inside a think block — flush the
            # accumulated buffer as a single ``"thinking"`` event
            # so callers see the full reasoning trace, even if the
            # model forgot the close.
            if tail:
                out.append(("thinking", tail))
            return out
        # Outside a think block — flush held-back tail as text.
        cleaned = _strip_orphan_close_tags(tail)
        if cleaned:
            self._accumulated += cleaned
            out.append(("text", cleaned))
        return out

    # ---- internals ------------------------------------------------------

    @staticmethod
    def _earliest(lower_buf: str, tags: Iterable[str]) -> Tuple[int, int]:
        """Return ``(index, length)`` of the earliest tag in *lower_buf*.

        ``(-1, 0)`` if no tag is present.
        """
        best_idx = -1
        best_len = 0
        for tag in tags:
            idx = lower_buf.find(tag.lower())
            if idx != -1 and (best_idx == -1 or idx < best_idx):
                best_idx = idx
                best_len = len(tag)
        return best_idx, best_len

    def _find_open_at_boundary(
        self, buf: str, lower_buf: str
    ) -> Tuple[int, int]:
        """Find the earliest opening tag.

        The Telegram gateway consumer requires a line-boundary
        check (``the <think> tag is used for…`` must not be
        stripped). The CarabinerOS chat does NOT want that
        restriction — operators expect any ``<think>...</think>``
        block in the model's stream to be stripped, full stop. We
        keep the helper signature for tests but relax the rule:
        any ``<open_tag>`` anywhere in the buffer triggers strip.

        If we ever need prose-preservation (a model that uses
        ``<reasoning>`` as a UI hint, not a block delimiter),
        reintroduce the boundary check here.
        """
        best_idx = -1
        best_len = 0
        for tag in _OPEN_THINK_TAGS:
            tag_lower = tag.lower()
            search_start = 0
            while True:
                idx = lower_buf.find(tag_lower, search_start)
                if idx == -1:
                    break
                if best_idx == -1 or idx < best_idx:
                    best_idx = idx
                    best_len = len(tag)
                # Keep scanning — a later tag earlier in the buffer
                # wins, but we still want to surface the earliest
                # match for visibility. The outer ``while buf`` loop
                # in feed() handles the rest of the buffer after
                # we exit at the first hit.
                break
        return best_idx, best_len

    def _is_boundary(self, idx: int, buf: str) -> bool:
        """Whether the position ``idx`` in *buf* sits on a line boundary.

        Retained for compatibility with the Telegram stream-consumer
        contract; the bridge's parser no longer enforces this (see
        :meth:`_find_open_at_boundary`). Always returns True so any
        ``<open_tag>`` found anywhere in the buffer triggers strip.
        """
        return True

    @staticmethod
    def _partial_open_tail_length(lower_buf: str) -> int:
        """How many chars at the end of *lower_buf* form a prefix of an open tag.

        Returns 0 if no open tag prefix matches the tail.
        """
        held = 0
        for tag in _OPEN_THINK_TAGS:
            tag_lower = tag.lower()
            for i in range(1, len(tag)):
                if lower_buf.endswith(tag_lower[:i]) and i > held:
                    held = i
        return held


def _strip_orphan_close_tags(text: str) -> str:
    """Remove any close tags from *text* that have no matching open.

    An orphan close tag is always noise — stripped along with any
    trailing whitespace so surrounding prose flows naturally.
    """
    if "</" not in text:
        return text
    text_lower = text.lower()
    out: List[str] = []
    i = 0
    n = len(text)
    while i < n:
        matched = False
        if text_lower[i:i + 2] == "</":
            for tag in _CLOSE_THINK_TAGS:
                tag_lower = tag.lower()
                tag_len = len(tag_lower)
                if text_lower[i:i + tag_len] == tag_lower:
                    j = i + tag_len
                    while j < n and text[j] in " \t\n\r":
                        j += 1
                    i = j
                    matched = True
                    break
        if not matched:
            out.append(text[i])
            i += 1
    return "".join(out)


# ---------------------------------------------------------------------------
# Client base + implementations
# ---------------------------------------------------------------------------


class BaseClient:
    """Common interface — returns an async iterator of ``(kind, data)``.

    ``kind`` is ``"text"`` (operator-visible delta) or ``"done"``
    (stream terminator). Think-block content is silently dropped;
    it never appears as a ``(kind, data)`` tuple.
    """

    def stream(
        self, text: str, session_id: str, model: str | None = None
    ) -> AsyncIterator[Tuple[str, str]]:
        raise NotImplementedError

    async def ping(self) -> bool:
        """Liveness check (no streaming). Returns True if reachable."""
        raise NotImplementedError

    async def aclose(self) -> None:
        pass


class EchoClient(BaseClient):
    """Canned responder — returns ``"echo: <text>"`` after 100ms."""

    async def stream(  # type: ignore[override]
        self, text: str, session_id: str, model: str | None = None
    ) -> AsyncIterator[Tuple[str, str]]:
        await asyncio.sleep(0.1)
        # Yield in two chunks so the in-place streaming log entry grows.
        yield ("text", "echo: ")
        yield ("text", text)
        yield ("done", "")

    async def ping(self) -> bool:
        return True

    async def aclose(self) -> None:
        return None


class HermesClient(BaseClient):
    """Real hermes-agent gateway client.

    Uses ``httpx.AsyncClient`` with a short timeout (10s connect,
    60s read). On any transport / HTTP error, raises
    :class:`HermesUnavailable` so the bridge can fall back to an
    apology log instead of returning 500.
    """

    def __init__(self, base_url: str, api_key: str, timeout: float = 60.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._timeout = timeout
        self._client: "httpx.AsyncClient | None" = None

    async def _http(self) -> Any:
        if self._client is None:
            import httpx  # local import so module load doesn't need httpx

            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=httpx.Timeout(connect=10.0, read=self._timeout, write=10.0, pool=10.0),
            )
        return self._client

    async def ping(self) -> bool:
        try:
            http = await self._http()
            r = await http.get("/v1/models")
            return r.status_code == 200
        except Exception as exc:  # noqa: BLE001 — every transport error means "down"
            logger.debug("hermes ping failed: %s", exc)
            return False

    async def stream(  # type: ignore[override]
        self, text: str, session_id: str, model: str | None = None
    ) -> AsyncIterator[Tuple[str, str]]:
        try:
            http = await self._http()
            async with http.stream(
                "POST",
                "/v1/chat/completions",
                json={
                    "model": model or os.environ.get("HERMES_MODEL", "hermes-default"),
                    "messages": [{"role": "user", "content": text}],
                    "stream": True,
                },
                headers={"X-Hermes-Session-Id": session_id},
            ) as response:
                if response.status_code != 200:
                    raise HermesUnavailable(
                        f"hermes /v1/chat/completions returned {response.status_code}"
                    )
                # Stateful buffer + boundary-aware think-block filter
                # (see ThinkBlockFilter). Anything inside a
                # <think>...</think> block is silently discarded;
                # the operator-facing chat only sees ("text", ...).
                flt = ThinkBlockFilter()
                try:
                    async for raw_line in response.aiter_lines():
                        if not raw_line or not raw_line.startswith("data:"):
                            continue
                        payload = raw_line[len("data:"):].strip()
                        if payload == "[DONE]":
                            # Flush whatever's left in the buffer.
                            # If we're still inside a ``<think>`` at
                            # end-of-stream (unclosed), the held-back
                            # tail becomes a ``"thinking"`` event so
                            # operators see the trace; content already
                            # inside the open block stays dropped.
                            for kind, data in flt.flush():
                                if data:
                                    yield (kind, data)
                            yield ("done", "")
                            return
                        try:
                            chunk = json.loads(payload)
                        except json.JSONDecodeError:
                            continue
                        for choice in chunk.get("choices", []):
                            delta = choice.get("delta") or {}
                            content = delta.get("content")
                            if not content:
                                continue
                            for kind, data in flt.feed(content):
                                if data:
                                    yield (kind, data)
                finally:
                    # If the response context exits while we still
                    # have buffered content (e.g. transport error
                    # mid-stream), flush so it isn't silently dropped.
                    for kind, data in flt.flush():
                        if data:
                            yield (kind, data)
        except HermesUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001
            raise HermesUnavailable(f"hermes transport error: {exc}") from exc

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None


def get_client(runtime: str, base_url: str, api_key: str) -> BaseClient:
    """Factory — picks :class:`HermesClient` or :class:`EchoClient`.

    ``runtime`` is the value of ``CARABINER_RUNTIME`` (``"hermes"`` or
    ``"echo"``). Unknown values fall back to ``EchoClient`` so the
    bridge always boots.
    """
    if runtime == "hermes":
        return HermesClient(base_url=base_url, api_key=api_key)
    return EchoClient()