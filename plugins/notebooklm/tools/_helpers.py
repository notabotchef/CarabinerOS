"""
Shared helpers for NotebookLM tools.

Provides a single function to get the plugin's StateManager and
RemoteAuthFlow instances, resolving paths relative to the plugin dir.
"""

from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache

import yaml


def _plugin_dir() -> Path:
    return Path(__file__).resolve().parent.parent


@lru_cache(maxsize=1)
def _load_config() -> dict:
    """Load plugin config from default_config.yaml."""
    cfg_path = _plugin_dir() / "default_config.yaml"
    if cfg_path.exists():
        with open(cfg_path, "r") as f:
            return yaml.safe_load(f) or {}
    return {}


def get_data_paths() -> tuple[str, str]:
    """Return (browser_state_dir, chrome_profile_dir) as absolute paths."""
    cfg = _load_config()
    base = _plugin_dir()
    state_dir = str(base / cfg.get("browser_state_dir", "data/browser_state"))
    profile_dir = str(base / cfg.get("chrome_profile_dir", "data/chrome_profile"))
    return state_dir, profile_dir


def get_state_manager():
    """Lazy-build a StateManager."""
    from plugins.notebooklm.auth.state_manager import StateManager

    cfg = _load_config()
    state_dir, profile_dir = get_data_paths()
    return StateManager(
        state_dir=state_dir,
        chrome_profile_dir=profile_dir,
        expiry_hours=cfg.get("auth_expiry_hours", 24),
    )


def get_remote_auth():
    """Lazy-build a RemoteAuthFlow."""
    from plugins.notebooklm.auth.remote_auth import RemoteAuthFlow

    cfg = _load_config()
    sm = get_state_manager()
    return RemoteAuthFlow(
        state_manager=sm,
        remote_debug_port=cfg.get("remote_debug_port", 9222),
    )
