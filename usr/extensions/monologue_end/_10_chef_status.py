"""Emit 'chef_status' event when the agent completes its task.
"""

from __future__ import annotations
import random
import logging
from python.helpers.extension import Extension

logger = logging.getLogger(__name__)

COMPLETION_MESSAGES = [
    "Heard.",
    "Service.",
    "All set.",
    "Done, Chef.",
]

class ChefStatusComplete(Extension):
    async def execute(self, **kwargs) -> None:
        sio = self.agent.config.additional.get("sio")
        if not sio:
            return

        msg = random.choice(COMPLETION_MESSAGES)

        try:
            await sio.emit("chef_status", {
                "status": "completed",
                "text": msg,
                "active": False
            }, namespace="/state_sync")
        except Exception as e:
            logger.warning("Failed to emit chef_status: %s", e)
