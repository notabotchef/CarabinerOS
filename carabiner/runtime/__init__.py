"""Carabiner runtime bridge package.

The bridge is the in-repo HTTP+Socket.IO service that owns the frontend
contract verbatim and delegates intelligence to either the pinned hermes
gateway (``CARABINER_RUNTIME=hermes``) or a canned responder
(``CARABINER_RUNTIME=echo``). See ``carabiner.runtime.server`` for the
ASGI entrypoint.
"""

__all__ = [
    "config",
    "security",
    "state",
    "emitter",
    "http_api",
    "sockets",
    "server",
]
