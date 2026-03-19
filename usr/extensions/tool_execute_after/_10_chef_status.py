"""Emit structured 'chef_status' events when a tool finishes.
"""

from __future__ import annotations
import logging
from python.helpers.extension import Extension

logger = logging.getLogger(__name__)

class ChefStatusAfter(Extension):
    async def execute(self, **kwargs) -> None:
        tool_name = kwargs.get("tool_name")
        if not tool_name:
            return

        sio = self.agent.config.additional.get("sio")
        if not sio:
            return

        try:
            await sio.emit("chef_status", {
                "status": "completed",
                "tool": tool_name,
                "text": "Heard.",
                "active": False
            }, namespace="/state_sync")
        except Exception as e:
            logger.warning("Failed to emit chef_status: %s", e)
