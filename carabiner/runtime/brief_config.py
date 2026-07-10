"""Hermetic env-var parsing for the brief scheduler.

Isolated from :class:`carabiner.runtime.config.RuntimeConfig` so a missing
or malformed brief config never blocks bridge startup. The scheduler
itself reads this module at lifespan startup and falls back to defaults
when env vars are absent.

All durations are kept as ``timedelta`` so the scheduler does not have
to do its own minute-vs-second arithmetic.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Optional


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on", "y", "t"}


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw.strip())
    except ValueError as exc:
        raise ValueError(f"brief_config: {name} must be int, got {raw!r}") from exc


def _str(name: str, default: str) -> str:
    raw = os.environ.get(name)
    return default if raw is None else raw


def _locations_filter(env_value: Optional[str]) -> list[str]:
    if not env_value:
        return []
    return [s.strip() for s in env_value.split(",") if s.strip()]


@dataclass(frozen=True)
class BriefConfig:
    """Configuration for the bridge-native daily-brief scheduler."""

    enabled: bool = True
    cadence: timedelta = timedelta(minutes=60)
    hours_start: int = 7
    hours_end: int = 22
    tz: str = "America/Los_Angeles"
    dedup_window: timedelta = timedelta(minutes=30)
    locations_filter: tuple[str, ...] = ()
    audit_outcome: str = "info"
    max_findings_per_tick: int = 20

    @classmethod
    def from_env(cls, env: Optional[dict] = None) -> "BriefConfig":
        src = env if env is not None else dict(os.environ)
        # ``enabled`` defaults to True; opt-out is explicit.
        enabled = _bool("BRIEF_ENABLED", True) if "BRIEF_ENABLED" in src else True
        # Honor a CARABINER_RUNTIME=echo default-off so dev doesn't run the loop.
        if "BRIEF_ENABLED" not in src and src.get("CARABINER_RUNTIME") == "echo":
            enabled = False
        cadence_min = _int("BRIEF_CADENCE_MINUTES", 60)
        dedup_min = _int("BRIEF_DEDUP_WINDOW_MINUTES", 30)
        max_findings = _int("BRIEF_MAX_FINDINGS_PER_TICK", 20)
        locs = tuple(_locations_filter(src.get("BRIEF_LOCATIONS")))
        return cls(
            enabled=enabled,
            cadence=timedelta(minutes=cadence_min),
            hours_start=_int("BRIEF_HOURS_START", 7),
            hours_end=_int("BRIEF_HOURS_END", 22),
            tz=_str("BRIEF_TZ", "America/Los_Angeles"),
            dedup_window=timedelta(minutes=dedup_min),
            locations_filter=locs,
            audit_outcome=_str("BRIEF_AUDIT_OUTCOME", "info"),
            max_findings_per_tick=max_findings,
        )


__all__ = ["BriefConfig"]