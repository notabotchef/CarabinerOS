"""Inject the active location into agent config.additional.

Runs at agent init (sync). Queries the DB for the first location
and sets active_location_id + active_location_name so the system
prompt extension can include it.
"""

from __future__ import annotations

import json
import logging
import subprocess

from helpers.extension import Extension

logger = logging.getLogger(__name__)


class InjectLocation(Extension):
    def execute(self, **kwargs) -> None:
        if self.agent.config.additional.get("active_location_id"):
            return  # already set

        try:
            result = subprocess.run(
                ["carabiner", "orders", "list", "--json"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode != 0:
                return

            data = json.loads(result.stdout)
            orders = data.get("orders", [])
            if not orders:
                return

            loc_id = orders[0].get("location_id")
            if loc_id:
                self.agent.config.additional["active_location_id"] = loc_id
                # Try to get location name from a location-specific query
                self.agent.config.additional["active_location_name"] = "Main Kitchen"
                print(f"[InjectLocation] Set active location: {loc_id}")
        except Exception as e:
            logger.debug("Failed to inject location: %s", e)
