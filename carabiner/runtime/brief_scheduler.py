"""In-process asyncio scheduler that turns fetcher payloads into cards.

Lives inside the bridge process. Started by ``carabiner.runtime.server``
during the composed lifespan, alongside the FastMCP lifespan.

Design choices (per the architect MoA lane):

* Single-flight: exactly one scheduler per bridge process.
* Tick = gather findings → emit cards with dedup.
* No hermes dependency — the bridge's gateway can be down for an hour
  and the kitchen still gets its morning brief.
* Errors are logged and swallowed; a single bad row never kills the
  loop.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

from .brief_config import BriefConfig
from .brief_cards import run_for_payload, _reset_for_testing as _reset_cards
from .brief_fetcher import gather_findings
from .sockets import get_active_server

logger = logging.getLogger(__name__)


class BriefScheduler:
    """Asyncio task that runs the daily-brief sweep on a cadence."""

    def __init__(self, cfg: BriefConfig, locations: Optional[list[tuple[str, str]]] = None) -> None:
        self.cfg = cfg
        # ``locations`` is a list of (id, name) tuples. None means "discover at start".
        self._locations = locations
        self._task: Optional[asyncio.Task] = None
        self._stopping = asyncio.Event()
        self._last_tick_at: Optional[float] = None

    @property
    def enabled(self) -> bool:
        return self.cfg.enabled

    async def _resolve_locations(self) -> list[tuple[str, str]]:
        if self._locations is not None:
            return self._locations
        if self.cfg.locations_filter:
            return [(loc, "") for loc in self.cfg.locations_filter]
        # Discover from DB.
        try:
            from carabiner.db import repositories as repos  # type: ignore

            rows = await repos.list_locations()
            return [(str(r.id), getattr(r, "name", "")) for r in rows]
        except Exception as exc:  # noqa: BLE001
            logger.warning("brief_scheduler: list_locations failed: %s", exc)
            return []

    def _in_business_window(self, now: datetime) -> bool:
        h = now.hour
        return self.cfg.hours_start <= h < self.cfg.hours_end

    async def tick(self, *, now: Optional[datetime] = None, force: bool = False) -> dict:
        """Single pass: gather + emit. Returns a small report dict."""
        report = {
            "started_at": time.time(),
            "locations": 0,
            "findings": 0,
            "emitted": 0,
            "deduped": 0,
            "skipped_no_server": 0,
        }
        now_utc = now or datetime.now(timezone.utc)
        if not force and not self._in_business_window(now_utc):
            report["reason"] = "outside_business_window"
            return report

        sio = get_active_server()
        locations = await self._resolve_locations()
        report["locations"] = len(locations)

        window = int(self.cfg.dedup_window.total_seconds())
        for loc_id, loc_name in locations:
            try:
                payload = await gather_findings(
                    location_id=loc_id,
                    location_name=loc_name,
                    now=now_utc,
                )
            except Exception as exc:  # noqa: BLE001 - per-location isolation
                logger.warning("brief_scheduler: gather failed for %s: %s", loc_id, exc)
                continue
            report["findings"] += len(payload.findings)
            if sio is None:
                report["skipped_no_server"] += 1
            cards = await run_for_payload(
                payload,
                sio=sio,
                now_epoch=int(now_utc.timestamp()),
                window_seconds=window,
                max_findings=self.cfg.max_findings_per_tick,
            )
            report["emitted"] += len(cards)

        self._last_tick_at = time.time()
        report["finished_at"] = self._last_tick_at
        return report

    async def _loop(self) -> None:
        interval = self.cfg.cadence.total_seconds()
        # Drift-free loop: anchor next fire to last tick start, not wall clock.
        next_fire = time.monotonic() + interval
        try:
            while not self._stopping.is_set():
                now_mono = time.monotonic()
                wait = max(0.0, next_fire - now_mono)
                try:
                    await asyncio.wait_for(self._stopping.wait(), timeout=wait)
                except asyncio.TimeoutError:
                    pass
                if self._stopping.is_set():
                    break
                try:
                    await self.tick()
                except Exception as exc:  # noqa: BLE001
                    logger.exception("brief_scheduler: tick failed: %s", exc)
                next_fire = time.monotonic() + interval
        finally:
            logger.info("brief_scheduler: loop exited")

    async def start(self) -> None:
        if not self.cfg.enabled:
            logger.info("brief_scheduler: disabled (BRIEF_ENABLED=false)")
            return
        if self._task is not None and not self._task.done():
            logger.info("brief_scheduler: already running")
            return
        self._stopping.clear()
        self._task = asyncio.create_task(self._loop(), name="brief-scheduler")
        logger.info(
            "brief_scheduler: started (cadence=%ds, dedup=%ds, hours=%d-%d, tz=%s)",
            int(self.cfg.cadence.total_seconds()),
            int(self.cfg.dedup_window.total_seconds()),
            self.cfg.hours_start,
            self.cfg.hours_end,
            self.cfg.tz,
        )

    async def stop(self) -> None:
        if self._task is None:
            return
        self._stopping.set()
        try:
            await asyncio.wait_for(self._task, timeout=5.0)
        except asyncio.TimeoutError:
            self._task.cancel()
        self._task = None
        logger.info("brief_scheduler: stopped")


# ---- singleton -----------------------------------------------------------

_scheduler: Optional[BriefScheduler] = None


def get_scheduler(cfg: Optional[BriefConfig] = None) -> BriefScheduler:
    """Return the process-wide scheduler singleton, building it on first call."""
    global _scheduler
    if _scheduler is None:
        _scheduler = BriefScheduler(cfg or BriefConfig.from_env())
    return _scheduler


def reset_for_testing(cfg: Optional[BriefConfig] = None) -> BriefScheduler:
    """Clear the singleton (tests only) and rebuild with optional new config."""
    global _scheduler
    _scheduler = None
    _reset_cards()
    return get_scheduler(cfg)


__all__ = ["BriefScheduler", "get_scheduler", "reset_for_testing"]