"""CSRF issue/verify and socket-auth checks for the bridge.

The frontend contract (``docs/.../carabineros-migration-plan.md`` §3)
requires:

- ``GET /csrf_token`` returns ``{ok, token, runtime_id}`` and sets a
  cookie ``csrf_token_<runtime_id>``. The same token is used as the
  ``X-CSRF-Token`` header on state-changing POSTs.
- The Socket.IO ``connect`` handshake carries
  ``{csrf_token, handlers:["ws_webui"]}``; anything else is refused.

The token format is ``<runtime_id>.<hmac>`` where the HMAC is over
``runtime_id`` (and a per-issue nonce) using ``BRIDGE_SECRET_KEY``.
We use ``hmac.compare_digest`` for constant-time comparison.

Spec source: ``docs/.../carabineros-migration-plan.md`` §3
"Frontend contract the bridge must match exactly".
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from typing import Any, Dict, Optional


# ---- runtime_id derivation ---------------------------------------------------

# A short, *stable* identifier derived from the bridge secret. This
# lets the cookie name ``csrf_token_<runtime_id>`` be the same across
# restarts (so a stale browser cookie still resolves) while still
# being short enough to embed in cookie names and log lines.


def derive_runtime_id(secret: str) -> str:
    """Return a short stable id derived from ``secret``.

    If ``secret`` is empty (echo dev mode, tests) we fall back to a
    process-lifetime random id — still 8 chars, still valid as a
    cookie-name suffix, but not stable across restarts.
    """
    if not secret:
        # 4 bytes hex → 8 chars, plenty for tests
        return secrets.token_hex(4)
    digest = hashlib.sha256(secret.encode("utf-8")).digest()[:4]
    return digest.hex()


# ---- CSRF issue / verify -----------------------------------------------------


def issue_csrf_token(secret: str, runtime_id: str, ttl_seconds: int = 3600) -> str:
    """Issue a CSRF token bound to ``runtime_id``.

    The token is ``<runtime_id>.<nonce>.<hmac>``. We include a nonce so
    repeated calls return distinct tokens (defence against pre-flight
    caching / replay) and a coarse TTL encoded into the HMAC input so
    tampered tokens fail verification.
    """
    nonce = secrets.token_urlsafe(8)
    ts = int(time.time())
    payload = f"{runtime_id}:{nonce}:{ts}"
    sig = _sign(secret, payload)
    return f"{runtime_id}.{nonce}.{ts}.{sig}"


def verify_csrf_token(secret: str, runtime_id: str, token: str, ttl_seconds: int = 3600) -> bool:
    """Constant-time verification of a CSRF token.

    Returns ``True`` only if:
      - the token's ``runtime_id`` segment matches the expected one;
      - the HMAC verifies against ``secret``;
      - the embedded timestamp is within ``ttl_seconds`` of now.
    """
    if not token or not secret or not runtime_id:
        return False
    parts = token.split(".")
    if len(parts) != 4:
        return False
    rid, nonce, ts_str, sig = parts
    if not hmac.compare_digest(rid, runtime_id):
        return False
    try:
        ts = int(ts_str)
    except ValueError:
        return False
    if ts <= 0 or (time.time() - ts) > ttl_seconds:
        return False
    expected = _sign(secret, f"{rid}:{nonce}:{ts}")
    return hmac.compare_digest(sig, expected)


def _sign(secret: str, payload: str) -> str:
    mac = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256)
    return base64.urlsafe_b64encode(mac.digest()).rstrip(b"=").decode("ascii")


# ---- Public helpers used by http_api.py and sockets.py ----------------------


def csrf_token_cookie_name(runtime_id: str) -> str:
    """Return the cookie name the frontend expects."""
    return f"csrf_token_{runtime_id}"


def issue_token_response(secret: str, runtime_id: str) -> Dict[str, Any]:
    """Return the ``{ok, token, runtime_id}`` shape for ``GET /csrf_token``."""
    return {
        "ok": True,
        "token": issue_csrf_token(secret, runtime_id),
        "runtime_id": runtime_id,
    }


def verify_socket_auth(
    secret: str,
    runtime_id: str,
    payload: Optional[Dict[str, Any]],
) -> bool:
    """Validate the Socket.IO connect handshake.

    Expects ``{"csrf_token": "...", "handlers": ["ws_webui", ...]}``.
    The handlers list must include ``"ws_webui"``; the csrf_token
    must verify against ``(secret, runtime_id)``.

    Returns ``True`` for a valid handshake, ``False`` otherwise.
    Never raises — connection handlers must be exception-safe.
    """
    if not isinstance(payload, dict):
        return False
    token = payload.get("csrf_token")
    handlers = payload.get("handlers")
    if not isinstance(token, str) or not isinstance(handlers, list):
        return False
    if "ws_webui" not in handlers:
        return False
    return verify_csrf_token(secret, runtime_id, token)
