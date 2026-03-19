# Agent Zero ↔ Frontend Streaming Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the WebSocket origin mismatch so Agent Zero responses stream to the Next.js frontend chat UI.

**Architecture:** An nginx reverse proxy (already configured in `nginx.dev.conf`) unifies `localhost:3000` (Next.js) and `localhost:5000` (Agent Zero) under `localhost:8080`, making `validate_ws_origin()` accept the WebSocket handshake without modifying any Agent Zero core files.

**Tech Stack:** nginx, Docker Compose, Python (pytest), Socket.IO, Flask, Next.js

**Spec:** `docs/specs/2026-03-19-a0-frontend-streaming-fix-design.md`

---

## Pre-existing Infrastructure

The following files already exist and are correctly configured:
- `nginx.dev.conf` — Full proxy config with Socket.IO WebSocket upgrade, CSRF, REST routes
- `docker-compose.dev.yml` — nginx service on port 8080, depends on frontend + agent-zero
- `frontend/src/lib/socket-client.ts` — Defaults to same-origin (`""`) which is correct through proxy
- `frontend/src/lib/csrf.ts` — CSRF token fetch works via proxy
- `frontend/src/hooks/use-socket.ts` — Listens for `state_push` events
- `frontend/src/hooks/use-chat.ts` — Filters logs for `type === "response"`

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `tests/test_websocket_origin_via_proxy.py` | Create | Unit test: `validate_ws_origin` accepts proxied origin |
| `tests/test_nginx_proxy_routing.py` | Create | Integration test: nginx routes to correct backends |
| `tests/test_e2e_chat_streaming.py` | Create | E2E test: message → response streams to frontend |
| `nginx.dev.conf` | Verify | Already correct — no changes needed |
| `docker-compose.dev.yml` | Verify | Already has nginx service — no changes needed |

---

## Task 1: Create Branch and Verify Docker Stack Starts

**Files:**
- Verify: `docker-compose.dev.yml`
- Verify: `nginx.dev.conf`

- [ ] **Step 1: Create the feature branch**

```bash
git checkout -b fix/a0-frontend-streaming
```

- [ ] **Step 2: Verify Docker stack starts cleanly**

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
```

Expected: postgres, agent-zero, frontend, nginx all running/healthy.

- [ ] **Step 3: Verify nginx is listening on port 8080**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080
```

Expected: `200` (Next.js homepage served through nginx)

- [ ] **Step 4: Verify Socket.IO endpoint is proxied**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/socket.io/?EIO=4&transport=polling
```

Expected: `200` or `400` (Socket.IO responds, meaning nginx forwarded correctly)

- [ ] **Step 5: Verify CSRF endpoint is proxied**

```bash
curl -s http://localhost:8080/csrf_token | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('ok') else 'FAIL')"
```

Expected: `ok`

- [ ] **Step 6: Commit branch creation**

```bash
git add -A && git commit -m "chore: create fix/a0-frontend-streaming branch"
```

---

## Task 2: Unit Test — `validate_ws_origin` Accepts Proxied Origin (Parallel-safe)

**Files:**
- Create: `tests/test_websocket_origin_via_proxy.py`
- Read: `python/helpers/websocket.py`

- [ ] **Step 1: Write the failing test**

```python
"""Test that validate_ws_origin accepts connections through the nginx proxy.

The proxy sets X-Forwarded-Host: localhost:8080 and the browser sends
Origin: http://localhost:8080, so origin and forwarded host match.
"""
import pytest
from python.helpers.websocket import validate_ws_origin


def _make_environ(origin: str, host: str, forwarded_host: str | None = None) -> dict:
    """Build a minimal WSGI environ dict for validate_ws_origin."""
    env = {
        "HTTP_ORIGIN": origin,
        "HTTP_HOST": host,
        "SERVER_NAME": host.split(":")[0],
        "SERVER_PORT": host.split(":")[-1] if ":" in host else "80",
    }
    if forwarded_host:
        env["HTTP_X_FORWARDED_HOST"] = forwarded_host
    return env


class TestProxiedOriginValidation:
    def test_same_origin_direct_connection_accepted(self):
        """Baseline: same host+port is accepted."""
        env = _make_environ("http://localhost:5000", "localhost:5000")
        ok, reason = validate_ws_origin(env)
        assert ok is True, f"Expected accept, got reject: {reason}"

    def test_cross_origin_rejected_without_proxy(self):
        """Without proxy headers, cross-origin is rejected."""
        env = _make_environ("http://localhost:3000", "localhost:5000")
        ok, reason = validate_ws_origin(env)
        assert ok is False, "Expected reject for cross-origin without proxy"

    def test_proxied_origin_accepted_via_forwarded_host(self):
        """Nginx sets X-Forwarded-Host: localhost:8080, browser Origin matches."""
        env = _make_environ(
            origin="http://localhost:8080",
            host="localhost:5000",  # actual backend host
            forwarded_host="localhost:8080",
        )
        ok, reason = validate_ws_origin(env)
        assert ok is True, f"Expected accept via X-Forwarded-Host, got reject: {reason}"

    def test_proxied_origin_rejected_when_mismatch(self):
        """Forwarded host doesn't match origin — reject."""
        env = _make_environ(
            origin="http://evil.com",
            host="localhost:5000",
            forwarded_host="localhost:8080",
        )
        ok, reason = validate_ws_origin(env)
        assert ok is False, "Expected reject for mismatched forwarded origin"

    def test_proxied_origin_missing_origin_header(self):
        """No Origin header at all — reject."""
        env = {
            "HTTP_HOST": "localhost:5000",
            "HTTP_X_FORWARDED_HOST": "localhost:8080",
            "SERVER_NAME": "localhost",
            "SERVER_PORT": "5000",
        }
        ok, reason = validate_ws_origin(env)
        assert ok is False, "Expected reject for missing origin"
```

- [ ] **Step 2: Run test to verify it fails (or passes — these test existing behavior)**

```bash
python -m pytest tests/test_websocket_origin_via_proxy.py -v
```

Expected: All 5 tests PASS (we're validating that the existing `validate_ws_origin` function already supports the proxy pattern correctly).

- [ ] **Step 3: Commit**

```bash
git add tests/test_websocket_origin_via_proxy.py
git commit -m "test: validate_ws_origin accepts proxied origin via X-Forwarded-Host"
```

---

## Task 3: Integration Test — Nginx Routes Correctly (Parallel-safe)

**Files:**
- Create: `tests/test_nginx_proxy_routing.py`

- [ ] **Step 1: Write the integration test**

```python
"""Integration tests for nginx dev proxy routing.

Requires Docker stack running: docker compose -f docker-compose.dev.yml up -d
These tests verify that nginx on :8080 routes to the correct backends.
"""
import os
import pytest
import requests

PROXY_URL = os.getenv("PROXY_URL", "http://localhost:8080")

# Skip if docker stack isn't running
def _proxy_available() -> bool:
    try:
        requests.get(f"{PROXY_URL}/", timeout=2)
        return True
    except requests.ConnectionError:
        return False

pytestmark = pytest.mark.skipif(
    not _proxy_available(),
    reason="Nginx proxy not available — start Docker stack first",
)


class TestNginxRouting:
    def test_root_serves_nextjs(self):
        """/ should serve the Next.js frontend."""
        r = requests.get(f"{PROXY_URL}/", timeout=5)
        assert r.status_code == 200
        # Next.js serves HTML with __next
        assert "__next" in r.text or "<!DOCTYPE" in r.text.upper()

    def test_csrf_token_proxied_to_agent_zero(self):
        """/csrf_token should reach Agent Zero and return a token."""
        r = requests.get(f"{PROXY_URL}/csrf_token", timeout=5)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert "token" in data

    def test_socketio_polling_proxied(self):
        """/socket.io/ polling transport should reach Agent Zero."""
        r = requests.get(
            f"{PROXY_URL}/socket.io/",
            params={"EIO": "4", "transport": "polling"},
            timeout=5,
        )
        # Socket.IO returns 200 with session info or 400 for bad handshake
        assert r.status_code in (200, 400)

    def test_api_workspace_proxied(self):
        """/api/ routes should reach Agent Zero's Flask API."""
        r = requests.get(f"{PROXY_URL}/api/workspaces", timeout=5)
        # 200 if workspace API exists, 404 if route exists but no data
        assert r.status_code in (200, 404, 401)

    def test_chats_proxied(self):
        """/chats should reach Agent Zero."""
        session = requests.Session()
        # Get CSRF first to establish session
        csrf_r = session.get(f"{PROXY_URL}/csrf_token", timeout=5)
        token = csrf_r.json().get("token", "")
        r = session.get(
            f"{PROXY_URL}/chats",
            headers={"X-CSRF-Token": token},
            timeout=5,
        )
        assert r.status_code in (200, 401, 403)
```

- [ ] **Step 2: Run test (requires Docker stack)**

```bash
python -m pytest tests/test_nginx_proxy_routing.py -v
```

Expected: All tests PASS if Docker stack is running, SKIP if not.

- [ ] **Step 3: Commit**

```bash
git add tests/test_nginx_proxy_routing.py
git commit -m "test: nginx proxy routing integration tests"
```

---

## Task 4: E2E Test — Chat Message Round-Trip (Sequential — depends on Tasks 1-3)

**Files:**
- Create: `tests/test_e2e_chat_streaming.py`

- [ ] **Step 1: Write the E2E test**

```python
"""End-to-end test: send a message via the proxy, verify response streams back.

Requires:
- Docker stack running (docker compose -f docker-compose.dev.yml up -d)
- Ollama running with qwen2.5:9b model
- Agent Zero configured with ollama_chat provider

This test exercises the full pipeline:
  Browser → nginx → /message_async → Agent Zero → LLM → state_push → Browser
"""
import os
import time
import pytest
import requests
import socketio

PROXY_URL = os.getenv("PROXY_URL", "http://localhost:8080")
TIMEOUT_SECONDS = int(os.getenv("E2E_TIMEOUT", "60"))


def _proxy_available() -> bool:
    try:
        requests.get(f"{PROXY_URL}/", timeout=2)
        return True
    except requests.ConnectionError:
        return False


pytestmark = pytest.mark.skipif(
    not _proxy_available(),
    reason="Nginx proxy not available — start Docker stack first",
)


class TestChatStreaming:
    def test_message_produces_response_in_state_push(self):
        """Send a message and verify a response-type log arrives via state_push."""
        session = requests.Session()

        # Step 1: Get CSRF token (establishes Flask session)
        csrf_r = session.get(f"{PROXY_URL}/csrf_token", timeout=5)
        assert csrf_r.status_code == 200
        csrf_data = csrf_r.json()
        assert csrf_data.get("ok"), f"CSRF failed: {csrf_data}"
        token = csrf_data["token"]
        runtime_id = csrf_data.get("runtime_id", "")

        # Step 2: Connect Socket.IO through the proxy
        cookies = session.cookies.get_dict()
        sio = socketio.Client(logger=False)
        response_received = {"value": False, "content": ""}

        @sio.on("state_push", namespace="/state_sync")
        def on_state_push(data):
            snapshot = (data.get("data") or {}).get("snapshot", {})
            logs = snapshot.get("logs", [])
            for log in logs:
                if log.get("type") == "response" and log.get("content", "").strip():
                    response_received["value"] = True
                    response_received["content"] = log["content"]

        sio.connect(
            f"{PROXY_URL}",
            namespaces=["/state_sync"],
            auth={"csrf_token": token},
            headers={"Cookie": "; ".join(f"{k}={v}" for k, v in cookies.items())},
            transports=["websocket"],
        )

        # Step 3: Subscribe to state updates
        sio.emit(
            "state_request",
            {
                "context": None,
                "log_from": 0,
                "notifications_from": 0,
                "timezone": "UTC",
                "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "correlationId": "e2e-test-001",
            },
            namespace="/state_sync",
        )
        time.sleep(1)

        # Step 4: Send a simple message
        msg_r = session.post(
            f"{PROXY_URL}/message_async",
            json={"text": "Say hello", "context": ""},
            headers={"X-CSRF-Token": token},
            timeout=10,
        )
        assert msg_r.status_code == 200, f"message_async failed: {msg_r.text}"

        # Step 5: Wait for response via state_push
        deadline = time.time() + TIMEOUT_SECONDS
        while not response_received["value"] and time.time() < deadline:
            time.sleep(0.5)

        sio.disconnect()

        assert response_received["value"], (
            f"No response-type log received via state_push within {TIMEOUT_SECONDS}s. "
            "Agent Zero may not be streaming responses through the WebSocket."
        )
        assert len(response_received["content"]) > 0, "Response content was empty"
```

- [ ] **Step 2: Run test (requires full stack + ollama)**

```bash
python -m pytest tests/test_e2e_chat_streaming.py -v --timeout=120
```

Expected: PASS — response arrives via `state_push` within timeout.

- [ ] **Step 3: Commit**

```bash
git add tests/test_e2e_chat_streaming.py
git commit -m "test: e2e chat streaming round-trip through nginx proxy"
```

---

## Task 5: Manual Smoke Test and Final Verification

- [ ] **Step 1: Open browser to `http://localhost:8080`**

Verify the CarabinerOS homepage loads.

- [ ] **Step 2: Open browser DevTools → Network → WS tab**

Verify a WebSocket connection to `/socket.io/` is established and shows `state_push` frames.

- [ ] **Step 3: Send a message in the chat**

Type "What needs my attention today?" and press Enter.

- [ ] **Step 4: Verify response streams into the chat UI**

The assistant response should appear incrementally as Agent Zero generates it.

- [ ] **Step 5: Check Agent Zero docker logs**

```bash
docker compose -f docker-compose.dev.yml logs agent-zero --tail=50
```

Verify the response was generated and no origin validation errors appear.

- [ ] **Step 6: Run full test suite**

```bash
python -m pytest tests/test_websocket_origin_via_proxy.py tests/test_nginx_proxy_routing.py tests/test_e2e_chat_streaming.py -v
```

Expected: All tests pass.

- [ ] **Step 7: Final commit**

```bash
git add -A && git commit -m "fix: A0 ↔ frontend streaming via nginx dev proxy

Adds tests verifying the nginx reverse proxy correctly unifies
localhost:3000 (Next.js) and localhost:5000 (Agent Zero) under
localhost:8080, resolving the WebSocket origin mismatch that
prevented response streaming to the frontend chat UI."
```

---

## Parallel Execution Strategy (ruflo swarm)

Tasks 2 and 3 are **independent** and can be executed by parallel agents:
- **Agent A (unit-tester):** Task 2 — write and run `test_websocket_origin_via_proxy.py`
- **Agent B (integration-tester):** Task 3 — write and run `test_nginx_proxy_routing.py`

Task 1 must complete first (branch creation + Docker verification).
Task 4 depends on Tasks 1-3 completing.
Task 5 is manual verification after all automated tests pass.

```
Task 1 (branch + docker) ──┬──→ Task 2 (unit tests)     ──┐
                            └──→ Task 3 (integration tests) ┤──→ Task 4 (e2e) ──→ Task 5 (smoke)
```
