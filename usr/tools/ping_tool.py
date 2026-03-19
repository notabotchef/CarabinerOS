"""Test tool to verify Agent Zero discovers overlay tools.

This tool responds to the 'ping' tool call with a simple acknowledgement.
It validates that the overlay directory registration works correctly.
"""

from __future__ import annotations

import json

from python.helpers.tool import Response, Tool


class PingTool(Tool):
    async def execute(self, **kwargs) -> Response:
        payload = self.args.get("payload", "pong")
        result = {
            "source": "carabiner-overlay",
            "tool": "ping",
            "response": payload,
        }
        return Response(
            message=json.dumps(result, indent=2),
            break_loop=False,
        )
