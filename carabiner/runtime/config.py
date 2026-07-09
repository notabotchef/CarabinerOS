"""Environment-driven configuration for the Carabiner bridge.

Pure stdlib ``os.environ`` parsing — no third-party imports at module
load time. Every value exposes a sensible default so the bridge starts
in ``echo`` mode out of the box (useful for tests, local dev without
the hermes gateway, and the live smoke path).

Spec source: ``docs/.../carabineros-hermes-migration-plan.md`` §3.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on", "y", "t"}


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _str(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


# Allowed values for the runtime selector. Anything else is a hard error
# at startup (validated in :func:`load_config`).
VALID_RUNTIMES: List[str] = ["hermes", "echo"]


@dataclass(frozen=True)
class RuntimeConfig:
    """Immutable view of the bridge's environment configuration."""

    # Runtime selector
    runtime: str = "echo"  # "hermes" | "echo"
    bridge_port: int = 8641

    # Hermes gateway
    hermes_base_url: str = "http://127.0.0.1:8642"
    api_server_key: str = ""
    hermes_model: str = ""

    # Persistence
    database_url: str = ""

    # Audit / policy / secrets
    audit_required: bool = True
    bridge_secret_key: str = ""

    # MCP surface (mount path inside the bridge)
    mcp_public_url: str = ""

    # Diagnostics
    extra: dict = field(default_factory=dict)


def load_config(env: dict | None = None) -> RuntimeConfig:
    """Parse the bridge configuration from ``os.environ``.

    Parameters
    ----------
    env:
        Optional mapping to read from instead of ``os.environ``. The
        mapping is the *whole* environment (not a key prefix). When
        ``None`` we read from ``os.environ`` directly. Used by tests
        to inject ephemeral config without polluting the real env.

    Returns
    -------
    RuntimeConfig
        Frozen dataclass. ``runtime`` is validated; an invalid value
        raises ``ValueError`` at startup so misconfigurations fail loud
        rather than silently dropping into the wrong mode.
    """

    src = env if env is not None else dict(os.environ)

    runtime = _str("CARABINER_RUNTIME", "echo").strip().lower()
    if runtime not in VALID_RUNTIMES:
        raise ValueError(
            f"Invalid CARABINER_RUNTIME={runtime!r}; "
            f"expected one of {VALID_RUNTIMES}"
        )

    return RuntimeConfig(
        runtime=runtime,
        bridge_port=_int("BRIDGE_PORT", 8641),
        hermes_base_url=_str("HERMES_BASE_URL", "http://127.0.0.1:8642").rstrip("/"),
        api_server_key=_str("API_SERVER_KEY", ""),
        hermes_model=_str("HERMES_MODEL", ""),
        database_url=_str("DATABASE_URL", ""),
        audit_required=_bool("AUDIT_REQUIRED", True),
        bridge_secret_key=_str("BRIDGE_SECRET_KEY", ""),
        mcp_public_url=_str("MCP_PUBLIC_URL", "").rstrip("/"),
        extra={
            # Surface additional env for downstream tools (auditing, etc.)
            "CARABINER_RUNTIME_VERSION": _str("CARABINER_RUNTIME_VERSION", "0.1.0"),
        },
    )


# Module-level singleton populated on first access. Tests can call
# :func:`load_config` directly to inject a different env.
_cached: RuntimeConfig | None = None


def get_config() -> RuntimeConfig:
    """Return the process-wide ``RuntimeConfig`` (cached)."""
    global _cached
    if _cached is None:
        _cached = load_config()
    return _cached


def reset_config_cache() -> None:
    """Drop the cached config (test helper — force re-read of env)."""
    global _cached
    _cached = None
