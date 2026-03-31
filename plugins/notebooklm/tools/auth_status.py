"""
notebooklm_auth_status — Check whether Google auth is valid.

Returns a JSON summary: has state, expired or not, state age, paths.
"""

from __future__ import annotations

import json
from helpers.tool import Tool, Response


class NotebookLMAuthStatus(Tool):

    async def execute(self, **kwargs) -> Response:
        from plugins.notebooklm.tools._helpers import get_state_manager

        sm = get_state_manager()
        status = sm.status_dict()

        if status["has_saved_state"] and not status["expired"]:
            summary = (
                f"Auth state is VALID (age: {status['state_age_hours']}h, "
                f"expires after 24h)."
            )
        elif status["has_saved_state"] and status["expired"]:
            summary = (
                f"Auth state EXISTS but is EXPIRED "
                f"({status['state_age_hours']}h old). "
                "Run notebooklm_auth_setup to re-authenticate."
            )
        else:
            summary = (
                "No auth state found. "
                "Run notebooklm_auth_setup to authenticate."
            )

        return Response(
            message=f"{summary}\n\nDetails:\n```json\n{json.dumps(status, indent=2)}\n```",
            break_loop=False,
        )
