"""
Remote Browser Authentication Flow for NotebookLM.

The problem: A0 runs inside Docker. Google login requires a real browser
with interactive 2FA, CAPTCHA, etc.  We cannot pop up a GUI window.

The solution:
 1. Launch Chromium inside the container with --remote-debugging-port=9222.
 2. Expose port 9222 to the host (via docker-compose).
 3. The user opens chrome://inspect or http://localhost:9222 on their host
    machine, connects to the remote Chromium, and logs into Google there.
 4. Once the URL reaches notebooklm.google.com, we capture state and close.

This file owns the entire lifecycle of that flow.
"""

from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path

logger = logging.getLogger("notebooklm.remote_auth")

NOTEBOOKLM_AUTH_URL = (
    "https://accounts.google.com/v3/signin/identifier"
    "?continue=https%3A%2F%2Fnotebooklm.google.com%2F"
    "&flowName=GlifWebSignIn&flowEntry=ServiceLogin"
)

# How long to wait for the user to complete login (seconds).
LOGIN_TIMEOUT_SECONDS = 600  # 10 minutes


class RemoteAuthFlow:
    """Launches a headless Chromium with remote debugging and waits for
    the user to complete Google sign-in from their host browser."""

    def __init__(
        self,
        state_manager,  # auth.state_manager.StateManager
        remote_debug_port: int = 9222,
        chrome_profile_dir: str | None = None,
    ):
        self.state_manager = state_manager
        self.port = remote_debug_port
        self.chrome_profile_dir = chrome_profile_dir or str(
            state_manager.chrome_profile_dir
        )

    async def run(self) -> dict:
        """Execute the full remote auth flow.

        Returns a dict with keys:
            success: bool
            message: str
            debug_url: str | None   (the URL the user should open)
        """
        try:
            from patchright.async_api import async_playwright
        except ImportError:
            return {
                "success": False,
                "message": (
                    "patchright is not installed. "
                    "Run the plugin execute.py first or `pip install patchright`."
                ),
                "debug_url": None,
            }

        # Clear old state so we get a clean login.
        await self.state_manager.clear_all()

        async with async_playwright() as pw:
            context = await pw.chromium.launch_persistent_context(
                self.chrome_profile_dir,
                headless=True,
                args=[
                    f"--remote-debugging-port={self.port}",
                    "--remote-debugging-address=0.0.0.0",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
                viewport={"width": 1024, "height": 768},
                locale="en-US",
            )

            page = context.pages[0] if context.pages else await context.new_page()

            debug_url = f"http://localhost:{self.port}"
            logger.info(
                "Remote debugging active on %s — waiting for user login ...",
                debug_url,
            )

            # Navigate to Google sign-in (which redirects to NotebookLM after auth).
            try:
                await page.goto(NOTEBOOKLM_AUTH_URL, timeout=60_000)
            except Exception as exc:
                logger.warning("Initial navigation error (continuing): %s", exc)

            # Poll until the URL reaches notebooklm.google.com or timeout.
            success = await self._wait_for_login(page, LOGIN_TIMEOUT_SECONDS)

            if success:
                await self.state_manager.save_browser_state(context, page)
                message = "Authentication successful. Browser state saved."
            else:
                message = (
                    "Login timed out after "
                    f"{LOGIN_TIMEOUT_SECONDS // 60} minutes. "
                    "Try again with notebooklm_auth_setup."
                )

            await context.close()

        return {
            "success": success,
            "message": message,
            "debug_url": debug_url if not success else None,
        }

    # ------------------------------------------------------------------

    async def _wait_for_login(self, page, timeout_s: int) -> bool:
        """Poll page.url() until it starts with the NotebookLM domain."""
        deadline = time.monotonic() + timeout_s
        check_interval = 1.0  # seconds
        last_log = 0.0

        while time.monotonic() < deadline:
            try:
                url = page.url
                if url.startswith("https://notebooklm.google.com/"):
                    logger.info("Login detected — URL: %s", url[:100])
                    # Short stabilisation wait
                    await asyncio.sleep(2)
                    return True
            except Exception:
                pass

            elapsed = time.monotonic() - (deadline - timeout_s)
            if elapsed - last_log >= 30:
                last_log = elapsed
                logger.info(
                    "Still waiting for login ... (%.0fs elapsed)", elapsed
                )

            await asyncio.sleep(check_interval)

        return False

    # ------------------------------------------------------------------

    def get_instructions(self) -> str:
        """Return user-facing instructions for the remote auth flow."""
        return (
            "To authenticate with Google NotebookLM:\n"
            "\n"
            f"1. Open http://localhost:{self.port} in Chrome on your host machine.\n"
            "2. Click the first link under 'Inspectable pages'.\n"
            "3. You will see the Google sign-in page rendered inside the container.\n"
            "4. Log in with your Google account (2FA etc. all work normally).\n"
            "5. Once you reach the NotebookLM dashboard, authentication is saved\n"
            "   automatically and the remote browser closes.\n"
            "\n"
            "Note: Port 9222 must be exposed in your docker-compose.yml:\n"
            "  ports:\n"
            f'    - "{self.port}:{self.port}"\n'
        )
