"""Sync tool results to action_log and emit workspace_update events.

Runs after any tool execution. Logs actions to the database and
emits Socket.IO events so the frontend auto-refreshes.
"""

from __future__ import annotations

import logging
from python.helpers.extension import Extension

logger = logging.getLogger(__name__)


class WorkspaceSync(Extension):
    async def execute(self, **kwargs) -> None:
        response = kwargs.get("response")
        if not response or not hasattr(response, "additional") or not response.additional:
            return

        additional = response.additional
        module = additional.get("module")
        action = additional.get("action")

        if not module:
            return

        # Log the action to DB
        try:
            from carabiner.db import repositories as repo
            await repo.create_action_log({
                "action_type": f"{module}_{action}" if action else module,
                "status": "completed",
                "provider_id": additional.get("provider_id"),
            })
        except Exception as e:
            logger.warning("Failed to log action: %s", e)

        # Emit workspace_update via Socket.IO (stored in agent config)
        try:
            sio = self.agent.config.additional.get("sio")
            if not sio:
                return
            await sio.emit("workspace_update", {
                "module": module,
                "action": action or "update",
                "item": additional.get("item", {}),
            })
        except Exception as e:
            logger.warning("Failed to emit workspace_update: %s", e)
