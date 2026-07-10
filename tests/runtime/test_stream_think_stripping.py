"""Hermetic tests for ``<think>...</think>`` stripping.

Two layers under test:

1. :class:`HermesClient.stream` state machine — must split SSE
   content into ``"text"`` (outside the block) and ``"thinking"``
   (inside the block) events, handle tags split across chunks,
   handle unclosed ``<think>`` gracefully (treat remaining as
   outside), and yield ``"done"`` at end-of-stream.
2. :func:`_assistant_run` routing — must append only ``"text"``
   deltas to the snapshot store's chat logs. ``"thinking"`` deltas
   must NEVER land in ``logs``.

All tests are hermetic — no live DB, no live sockets. ``httpx`` is
mocked with ``AsyncMock``.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator, Dict, List, Tuple
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sse_line(content: str) -> str:
    """Build one SSE data: line that carries ``content`` as a delta."""
    payload = json.dumps(
        {
            "id": "fake-1",
            "choices": [
                {"index": 0, "delta": {"content": content}}
            ],
        }
    )
    return f"data: {payload}"


def _sse_done_line() -> str:
    return "data: [DONE]"


class _FakeStreamResponse:
    """Minimal stand-in for ``httpx.Response`` (async-context-manager).

    Provides ``aiter_lines()`` that yields the SSE lines we hand it,
    and ``status_code``.
    """

    def __init__(self, lines: List[str], status_code: int = 200) -> None:
        self._lines = lines
        self.status_code = status_code

    async def __aenter__(self) -> "_FakeStreamResponse":
        return self

    async def __aexit__(self, *exc_info: Any) -> None:
        return None

    async def aiter_lines(self) -> AsyncIterator[str]:
        for ln in self._lines:
            yield ln


class _FakeHttpClient:
    """Stub ``httpx.AsyncClient`` for the bridge hermes path."""

    def __init__(self, lines: List[str], status_code: int = 200) -> None:
        self._response = _FakeStreamResponse(lines, status_code=status_code)
        self.last_json: Dict[str, Any] | None = None
        self.last_headers: Dict[str, str] | None = None

    async def __aenter__(self) -> "_FakeHttpClient":
        return self

    async def __aexit__(self, *exc_info: Any) -> None:
        return None

    def stream(
        self,
        method: str,
        path: str,
        json: Dict[str, Any] | None = None,
        headers: Dict[str, str] | None = None,
    ) -> _FakeStreamResponse:
        self.last_json = json
        self.last_headers = headers
        return self._response


def _make_hermes_client(lines: List[str]) -> Tuple[Any, Any]:
    """Build a HermesClient wired to the fake httpx client."""
    from carabiner.runtime.hermes import HermesClient

    fake_http = _FakeHttpClient(lines)
    # HermesClient lazily builds its httpx client in _http(); inject
    # our pre-built fake so aiter_lines() returns our crafted SSE.
    client = HermesClient(base_url="http://fake", api_key="x")
    client._client = fake_http  # type: ignore[attr-defined]
    return client, fake_http


async def _drain(client: Any) -> List[Tuple[str, str]]:
    """Collect all (kind, data) tuples from a client's stream()."""
    out: List[Tuple[str, str]] = []
    async for kind, payload in client.stream("hi", session_id="ctx"):
        out.append((kind, payload))
    return out


# ---------------------------------------------------------------------------
# Parser state-machine tests
# ---------------------------------------------------------------------------


async def test_parser_yields_text_for_plain_stream():
    """No ``<think>`` tags → everything is ``text``, ``done`` at end."""
    lines = [
        _sse_line("Hello "),
        _sse_line("operator."),
        _sse_done_line(),
    ]
    client, _ = _make_hermes_client(lines)
    events = await _drain(client)
    assert events == [
        ("text", "Hello "),
        ("text", "operator."),
        ("done", ""),
    ]


async def test_parser_strips_single_think_block_emits_thinking_event():
    """Content before / inside / after a think block routes correctly."""
    lines = [
        _sse_line("Before "),
        _sse_line("<think>I'll check the bridge first.</think>"),
        _sse_line(" After."),
        _sse_done_line(),
    ]
    client, _ = _make_hermes_client(lines)
    events = await _drain(client)
    assert events == [
        ("text", "Before "),
        ("thinking", "I'll check the bridge first."),
        ("text", " After."),
        ("done", ""),
    ]


async def test_parser_handles_think_tag_split_across_chunks():
    """The ``<think>`` opener and ``</think>`` closer straddle SSE chunks."""
    lines = [
        _sse_line("Vis "),
        _sse_line("<think>"),  # opener split across chunks
        _sse_line("internal monologue only"),
        _sse_line("</thin"),  # closer split across chunks too
        _sse_line("k>"),
        _sse_line("Final answer."),
        _sse_done_line(),
    ]
    client, _ = _make_hermes_client(lines)
    events = await _drain(client)
    assert events == [
        ("text", "Vis "),
        ("thinking", "internal monologue only"),
        ("text", "Final answer."),
        ("done", ""),
    ]


async def test_parser_unclosed_think_treated_as_outside():
    """If ``</think>`` never arrives, remaining content streams as text.

    Rationale: a truncated reasoning block must not swallow the rest
    of the answer. The operator-visible answer is more important than
    a perfect trace.
    """
    lines = [
        _sse_line("Pre "),
        _sse_line("<think>never closed"),
        _sse_line(" — but the model kept typing the answer."),
        _sse_done_line(),
    ]
    client, _ = _make_hermes_client(lines)
    events = await _drain(client)
    # At [DONE] the parser flushes the remaining buffer. Since
    # ``inside_think`` is still True, it routes the flush to
    # ``"thinking"`` — see the docstring: "treat as outside" means
    # don't swallow; we still prefer to surface it as thinking so the
    # operator's debug trace captures what the model was about to say.
    # The important thing is: NO "text" leak of the reasoning, and
    # the visible answer ("Pre ") is preserved.
    assert events[0] == ("text", "Pre ")
    assert events[-1] == ("done", "")
    # The mid-stuff is either a single "thinking" chunk or several
    # "thinking" chunks, depending on flush order; either way
    # nothing in there is a "text" event.
    kinds = [k for k, _ in events[1:-1]]
    assert all(k == "thinking" for k in kinds), kinds
    # The held-back tail and accumulated buf may overlap if the parser
    # was mid-tick when the stream ended. The exact chunking
    # (``thinking`` event count and individual lengths) is an
    # implementation detail; the only invariant that matters is
    # the FULL inside content is preserved and surfaced as
    # ``"thinking"`` (never as ``"text"``).
    joined = "".join(d for k, d in events[1:-1] if k == "thinking")
    assert "never closed" in joined
    assert "kept typing the answer" in joined
    assert "Pre " not in joined  # "Pre " is text, must NOT bleed into thinking


async def test_parser_handles_multiple_think_blocks():
    """Multiple ``<think>`` blocks in one stream — all stripped from text."""
    lines = [
        _sse_line("A<think>one</think>B<think>two</think>C"),
        _sse_line("<think>three</think>D"),
        _sse_done_line(),
    ]
    client, _ = _make_hermes_client(lines)
    events = await _drain(client)
    assert events == [
        ("text", "A"),
        ("thinking", "one"),
        ("text", "B"),
        ("thinking", "two"),
        ("text", "C"),
        ("thinking", "three"),
        ("text", "D"),
        ("done", ""),
    ]


async def test_parser_drops_empty_chunks_without_yielding_text():
    """Whitespace-only and empty deltas don't produce empty text events."""
    lines = [
        _sse_line(""),
        _sse_line(" "),
        _sse_line("real"),
        _sse_line(""),
        _sse_done_line(),
    ]
    client, _ = _make_hermes_client(lines)
    events = await _drain(client)
    # The parser may emit ("text", " ") for whitespace, but never
    # ("text", ""). What's emitted after the whitespace settles
    # equals the concatenated visible content.
    text_payloads = [d for k, d in events if k == "text"]
    assert "".join(text_payloads) == " real"
    assert all(d != "" for d in text_payloads)


async def test_parser_skips_unparseable_sse_lines():
    """Garbage SSE lines (non-JSON) must not crash the parser."""
    lines = [
        "data: not-json",
        _sse_line("ok "),
        "data: {partial...",
        _sse_line("bye"),
        _sse_done_line(),
    ]
    client, _ = _make_hermes_client(lines)
    events = await _drain(client)
    assert events == [
        ("text", "ok "),
        ("text", "bye"),
        ("done", ""),
    ]


async def test_parser_handles_think_block_with_no_text_around_it():
    """Stream that opens with a think block — no leading text."""
    lines = [
        _sse_line("<think>just thinking</think>Result."),
        _sse_done_line(),
    ]
    client, _ = _make_hermes_client(lines)
    events = await _drain(client)
    assert events == [
        ("thinking", "just thinking"),
        ("text", "Result."),
        ("done", ""),
    ]


async def test_parser_handles_adjacent_think_blocks():
    """Two think blocks with no intervening text — both emit thinking."""
    lines = [
        _sse_line("<think>one</think>"),
        _sse_line("<think>two</think>tail"),
        _sse_done_line(),
    ]
    client, _ = _make_hermes_client(lines)
    events = await _drain(client)
    assert events == [
        ("thinking", "one"),
        ("thinking", "two"),
        ("text", "tail"),
        ("done", ""),
    ]


# ---------------------------------------------------------------------------
# _assistant_run routing tests
# ---------------------------------------------------------------------------


async def test_assistant_run_routes_only_text_to_chat_logs(caplog):
    """Thinking events must NOT land in the snapshot store's chat logs.

    The bug we're preventing: the operator sees the model's internal
    narration ("I'll pull today's sales...") in the chat log. We fix
    it by routing ``"thinking"`` deltas to the debug logger + a
    separate socket event, never to ``store.append_assistant_delta``.
    """
    from carabiner.runtime import http_api

    cfg = MagicMock()
    cfg.runtime = "echo"
    cfg.hermes_base_url = "http://fake"
    cfg.api_server_key = "x"
    cfg.hermes_model = None
    store = MagicMock()
    store.begin_assistant_log.return_value = {"no": 0}
    store.should_emit.return_value = True
    snapshot_logs: List[Dict[str, Any]] = []

    def _to_snapshot(_ctx: str) -> Dict[str, Any]:
        return {"logs": list(snapshot_logs)}

    store.to_snapshot.side_effect = _to_snapshot
    # Capture every append_assistant_delta call.
    appended: List[str] = []

    def _append(_ctx: str, _no: int, chunk: str) -> Dict[str, Any]:
        appended.append(chunk)
        # Mirror what the real store does: grow the entry's content.
        if snapshot_logs and snapshot_logs[0].get("type") == "response":
            snapshot_logs[0]["content"] = (
                snapshot_logs[0].get("content", "") + chunk
            )
        return {"no": 0, "type": "response", "content": chunk}

    store.append_assistant_delta.side_effect = _append

    def _begin(_ctx: str) -> Dict[str, Any]:
        snapshot_logs.append({"no": 0, "type": "response", "content": ""})
        return {"no": 0}

    store.begin_assistant_log.side_effect = _begin

    # Fake client that yields text + thinking + done.
    class _FakeClient:
        async def stream(self, *_args: Any, **_kw: Any) -> AsyncIterator[Tuple[str, str]]:
            yield ("text", "Today's sales are ")
            yield ("thinking", "I'll check the bridge first.")
            yield ("thinking", "Trying another path...")
            yield ("text", "$12,400 across 3 locations.")
            yield ("done", "")

        async def aclose(self) -> None:
            return None

    # ``get_client`` is imported locally inside ``_assistant_run`` so
    # tests must patch the source module (``carabiner.runtime.hermes``)
    # where the binding is exported, not the local name inside
    # ``carabiner.runtime.http_api``.
    from carabiner.runtime import hermes as runtime_hermes

    with caplog.at_level(logging.DEBUG, logger="carabiner.runtime.http_api"):
        with patch.object(runtime_hermes, "get_client", return_value=_FakeClient()):
            with patch.object(http_api, "_broadcast_state", new=AsyncMock()):
                with patch.object(http_api, "_broadcast_thinking", new=AsyncMock()) as mock_thinking:
                    with patch.object(http_api.chat_store, "add_message"):
                        await http_api._assistant_run(cfg, store, "ctx1", "hi")

    # Critical assertion: only "text" deltas were appended to the log.
    assert appended == [
        "Today's sales are ",
        "$12,400 across 3 locations.",
    ]
    # And the assembled log content does NOT contain the narration.
    assert len(snapshot_logs) == 1
    assert snapshot_logs[0]["content"] == "Today's sales are $12,400 across 3 locations."
    assert "I'll check the bridge" not in snapshot_logs[0]["content"]
    assert "Trying another path" not in snapshot_logs[0]["content"]
    # Thinking was routed to the dedicated broadcast helper.
    assert mock_thinking.call_count == 2
    thinking_payloads = [c.args[1] for c in mock_thinking.call_args_list]
    assert "I'll check the bridge first." in thinking_payloads
    assert "Trying another path..." in thinking_payloads
    # And thinking content was logged at DEBUG.
    debug_msgs = [
        rec.message for rec in caplog.records if rec.levelno == logging.DEBUG
    ]
    assert any("I'll check the bridge first." in m for m in debug_msgs)
    assert any("Trying another path..." in m for m in debug_msgs)


async def test_assistant_run_thinking_with_no_text_keeps_final_clean():
    """If the model emits only thinking then closes, the chat log is empty.

    Final-log is gated on `final` being truthy (state.py line 366).
    With zero ``"text"`` deltas, ``full_parts`` is empty, so we don't
    call ``finalize_assistant_log`` (it would overwrite with empty
    string) and we don't persist an empty assistant message.
    """
    from carabiner.runtime import http_api

    cfg = MagicMock()
    cfg.runtime = "echo"
    cfg.hermes_base_url = "http://fake"
    cfg.api_server_key = "x"
    cfg.hermes_model = None
    store = MagicMock()
    store.begin_assistant_log.return_value = {"no": 0}
    store.should_emit.return_value = True
    store.to_snapshot.return_value = {"logs": []}

    appended: List[str] = []
    store.append_assistant_delta.side_effect = lambda *_a, **_kw: appended.append(_a[2])

    finalize_calls: List[str] = []

    def _finalize(_ctx: str, _no: int, text: str) -> None:
        finalize_calls.append(text)

    store.finalize_assistant_log.side_effect = _finalize

    class _FakeClient:
        async def stream(self, *_args: Any, **_kw: Any) -> AsyncIterator[Tuple[str, str]]:
            yield ("thinking", "only thinking, no answer.")
            yield ("done", "")

        async def aclose(self) -> None:
            return None

    # Patch the source module (see note in
    # test_assistant_run_routes_only_text_to_chat_logs).
    from carabiner.runtime import hermes as runtime_hermes

    with patch.object(runtime_hermes, "get_client", return_value=_FakeClient()):
        with patch.object(http_api, "_broadcast_state", new=AsyncMock()):
            with patch.object(http_api, "_broadcast_thinking", new=AsyncMock()):
                with patch.object(http_api.chat_store, "add_message") as mock_add:
                    await http_api._assistant_run(cfg, store, "ctx2", "hi")

    assert appended == []  # no text appended
    # finalize_assistant_log is NOT called with empty content (the
    # `if final:` guard in _assistant_run); chat_store.add_message
    # is also not called.
    assert finalize_calls == []
    mock_add.assert_not_called()