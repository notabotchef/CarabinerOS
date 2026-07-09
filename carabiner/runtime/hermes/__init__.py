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

SSE parser: text deltas only. Tool calls happen in the bridge's
in-process MCP surface (``carabiner.runtime.mcp_surface``), not
relayed from hermes; hermes never sees raw tool-chunk events
because it discovers the tools via the MCP registry.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, AsyncIterator, Tuple

logger = logging.getLogger(__name__)


class HermesUnavailable(Exception):
    """Raised when the hermes gateway is unreachable or returns non-2xx."""


class BaseClient:
    """Common interface — returns an async iterator of ``(kind, data)``.

    ``kind`` is one of ``"text"`` (delta string) or ``"done"``.
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
                async for raw_line in response.aiter_lines():
                    if not raw_line or not raw_line.startswith("data:"):
                        continue
                    payload = raw_line[len("data:"):].strip()
                    if payload == "[DONE]":
                        yield ("done", "")
                        return
                    try:
                        chunk = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    for choice in chunk.get("choices", []):
                        delta = choice.get("delta") or {}
                        content = delta.get("content")
                        if content:
                            yield ("text", content)
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