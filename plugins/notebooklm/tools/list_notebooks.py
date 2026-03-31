"""
notebooklm_list_notebooks — List notebooks available in the MCP server's library.

Stub implementation. Once the MCP server is running, this calls
the list_notebooks tool.
"""

from __future__ import annotations

from helpers.tool import Tool, Response


class NotebookLMListNotebooks(Tool):

    async def execute(self, **kwargs) -> Response:
        # This is a stub. Full implementation would call the MCP server's
        # list_notebooks tool the same way ask.py calls ask_question.
        return Response(
            message=(
                "notebooklm_list_notebooks is not yet implemented.\n"
                "To list notebooks, configure them in the NotebookLM web UI at "
                "https://notebooklm.google.com and pass notebook_url directly to "
                "notebooklm_ask."
            ),
            break_loop=False,
        )
