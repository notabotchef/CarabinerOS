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
