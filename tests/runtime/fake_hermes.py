"""Tiny ASGI stub of hermes-agent for tests.

Served on an ephemeral port by ``conftest.py`` so the bridge tests
can drive the hermes path without needing the real gateway.

Endpoints:

- ``GET /v1/models`` — returns a single test model.
- ``POST /v1/chat/completions`` (with ``stream: true``) — emits SSE
  chunks that mirror hermes's actual wire format.
- ``POST /v1/runs`` — minimal stub.
"""

from __future__ import annotations

import json
import time
from typing import AsyncIterator


async def app(scope, receive, send):  # type: ignore[no-untyped-def]
    """ASGI 3 entrypoint — dispatches on ``scope["path"]`` and method."""
    if scope["type"] != "http":
        return

    path = scope["path"]
    method = scope["method"]

    if path == "/v1/models" and method == "GET":
        await _json_response(
            send, 200, {"data": [{"id": "fake-hermes-model", "object": "model"}]}
        )
        return

    if path == "/v1/chat/completions" and method == "POST":
        body = await _read_body(receive)
        try:
            payload = json.loads(body) if body else {}
        except json.JSONDecodeError:
            payload = {}
        stream = bool(payload.get("stream", True))
        text = _extract_user_text(payload)
        if not stream:
            await _json_response(
                send,
                200,
                {
                    "id": "fake-completion",
                    "choices": [{"index": 0, "message": {"role": "assistant", "content": f"echo: {text}"}}],
                },
            )
            return
        await _sse_response(send, f"echo: {text}")
        return

    if path == "/v1/runs" and method == "POST":
        await _json_response(send, 202, {"run_id": "fake-run", "status": "pending"})
        return

    await _json_response(send, 404, {"error": "not_found", "path": path})


def _extract_user_text(payload: dict) -> str:
    """Pull the user's text from an OpenAI-format messages array."""
    for msg in payload.get("messages", []):
        if msg.get("role") == "user":
            return str(msg.get("content", ""))
    return ""


async def _read_body(receive) -> bytes:  # type: ignore[no-untyped-def]
    chunks: list[bytes] = []
    while True:
        msg = await receive()
        if msg["type"] != "http.request":
            continue
        chunks.append(msg.get("body", b""))
        if not msg.get("more_body", False):
            break
    return b"".join(chunks)


async def _json_response(send, status: int, body: dict) -> None:  # type: ignore[no-untyped-def]
    raw = json.dumps(body).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(raw)).encode())],
        }
    )
    await send({"type": "http.response.body", "body": raw, "more_body": False})


async def _sse_response(send, text: str) -> None:  # type: ignore[no-untyped-def]
    """Stream two text chunks then a [DONE] marker — matches hermes's SSE shape."""
    chunks: list[str] = [
        json.dumps(
            {
                "id": "fake-1",
                "choices": [{"index": 0, "delta": {"role": "assistant", "content": "echo: "}}],
            }
        ),
        json.dumps(
            {
                "id": "fake-2",
                "choices": [{"index": 0, "delta": {"content": text}}],
            }
        ),
    ]
    body = ""
    for c in chunks:
        body += f"data: {c}\n\n"
    body += "data: [DONE]\n\n"
    raw = body.encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": 200,
            "headers": [
                (b"content-type", b"text/event-stream"),
                (b"cache-control", b"no-cache"),
                (b"content-length", str(len(raw)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": raw, "more_body": False})


# Convenience async iterator for direct unit tests (not used by the ASGI app).
async def fake_stream(text: str) -> AsyncIterator[tuple[str, str]]:
    yield ("text", "echo: ")
    yield ("text", text)
    yield ("done", "")
    # tiny sleep to mimic real network latency
    await __import__("asyncio").sleep(0)