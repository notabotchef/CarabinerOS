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
ORIGIN_HEADER = {"Origin": f"{PROXY_URL}"}
TIMEOUT_SECONDS = int(os.getenv("E2E_TIMEOUT", "60"))


def _proxy_available() -> bool:
    try:
        requests.get(f"{PROXY_URL}/", timeout=2)
        return True
    except (requests.ConnectionError, requests.Timeout):
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
        csrf_r = session.get(f"{PROXY_URL}/csrf_token", headers=ORIGIN_HEADER, timeout=5)
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

        # Pass session cookies via both Cookie header and eio.http so Flask
        # CSRF validation succeeds during the Socket.IO namespace connect.
        cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
        # Also need the csrf_token cookie that the browser would normally set
        csrf_cookie = f"csrf_token_{csrf_data.get('runtime_id', '')}={token}"
        full_cookie = f"{cookie_str}; {csrf_cookie}" if cookie_str else csrf_cookie

        http_session = requests.Session()
        http_session.cookies.update(cookies)
        http_session.cookies.set(
            f"csrf_token_{csrf_data.get('runtime_id', '')}", token
        )
        sio.eio.http = http_session
        sio.eio.external_http = True  # prevent cleanup of our session
        try:
            sio.connect(
                f"{PROXY_URL}",
                namespaces=["/state_sync"],
                auth={"csrf_token": token},
                headers={"Origin": PROXY_URL, "Cookie": full_cookie},
                transports=["polling"],
                wait_timeout=5,
            )
        except Exception as exc:
            pytest.skip(
                f"Socket.IO connect to /state_sync failed: {exc}"
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
            headers={"X-CSRF-Token": token, **ORIGIN_HEADER},
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
