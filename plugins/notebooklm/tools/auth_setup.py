"""
notebooklm_auth_setup — A0 tool that launches the remote auth flow.

When invoked, it:
 1. Starts headless Chromium with --remote-debugging-port inside the container.
 2. Navigates to the Google sign-in page.
 3. Returns instructions + the debug URL for the user to connect.
 4. Polls until login completes or times out (10 min).
 5. Persists browser state to the plugin data dir.

Usage in A0 chat:
    Use the notebooklm_auth_setup tool to authenticate with Google.
"""

from __future__ import annotations

from helpers.tool import Tool, Response
from helpers.print_style import PrintStyle


class NotebookLMAuthSetup(Tool):

    async def execute(self, **kwargs) -> Response:
        from plugins.notebooklm.tools._helpers import get_remote_auth

        auth_flow = get_remote_auth()

        # Print instructions before the long-running flow.
        instructions = auth_flow.get_instructions()
        PrintStyle(font_color="#F39C12", bold=True).print(
            "NotebookLM Remote Auth"
        )
        PrintStyle(font_color="#85C1E9").print(instructions)

        # Run the auth flow (blocks until login or timeout).
        result = await auth_flow.run()

        if result["success"]:
            return Response(
                message=(
                    "Authentication successful.\n"
                    "Google cookies have been saved. You can now use "
                    "notebooklm_ask to query your notebooks."
                ),
                break_loop=False,
            )
        else:
            return Response(
                message=(
                    f"Authentication did not complete.\n"
                    f"{result['message']}\n\n"
                    f"Debug URL: {result.get('debug_url', 'N/A')}\n\n"
                    f"{instructions}"
                ),
                break_loop=False,
            )
