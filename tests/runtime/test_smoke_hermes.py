"""Live hermes smoke tests — skipped unless ``HERMES_SMOKE=1``.

These run against the *real* local hermes install at
``HERMES_BASE_URL``. Set ``HERMES_SMOKE=1`` in the env to opt in.
"""

from __future__ import annotations

import os

import pytest


pytestmark = pytest.mark.skipif(
    os.environ.get("HERMES_SMOKE") != "1",
    reason="HERMES_SMOKE != 1; live hermes tests are skipped by default",
)


@pytest.mark.asyncio
async def test_real_hermes_v1_models_non_empty() -> None:
    """``GET /v1/models`` should return a non-empty data list."""
    import httpx

    base = os.environ.get("HERMES_BASE_URL", "http://127.0.0.1:8642")
    key = os.environ.get("API_SERVER_KEY", "")
    async with httpx.AsyncClient(headers={"Authorization": f"Bearer {key}"}) as client:
        r = await client.get(f"{base}/v1/models")
    assert r.status_code == 200
    data = r.json().get("data", [])
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_real_hermes_chat_stream_returns_deltas() -> None:
    """``POST /v1/chat/completions`` with stream=true returns text deltas."""
    import httpx

    from carabiner.runtime.hermes import HermesClient

    base = os.environ.get("HERMES_BASE_URL", "http://127.0.0.1:8642")
    key = os.environ.get("API_SERVER_KEY", "")
    client = HermesClient(base_url=base, api_key=key)
    deltas: list[str] = []
    try:
        async for kind, payload in client.stream("ping", session_id="smoke-1"):
            if kind == "text":
                deltas.append(payload)
            if kind == "done":
                break
    finally:
        await client.aclose()
    assert deltas, "expected at least one text delta from real hermes"