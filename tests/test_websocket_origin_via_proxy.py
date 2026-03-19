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
