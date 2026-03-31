"""
Browser state persistence for the NotebookLM plugin.

Manages saving/loading Patchright browser state (cookies, localStorage,
sessionStorage) to disk so that auth survives container restarts when
the plugin data dir is volume-mounted.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import time
from pathlib import Path

logger = logging.getLogger("notebooklm.state")

# Google cookies that MUST be present for a valid session.
CRITICAL_COOKIE_NAMES = [
    "SID", "HSID", "SSID",
    "APISID", "SAPISID",
    "OSID", "__Secure-OSID",
    "__Secure-1PSID", "__Secure-3PSID",
]


class StateManager:
    """Persist and validate Patchright browser state for Google auth."""

    def __init__(self, state_dir: str, chrome_profile_dir: str, expiry_hours: float = 24.0):
        self.state_dir = Path(state_dir)
        self.chrome_profile_dir = Path(chrome_profile_dir)
        self.expiry_hours = expiry_hours

        self.state_file = self.state_dir / "state.json"
        self.session_file = self.state_dir / "session.json"

        # Ensure dirs exist
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.chrome_profile_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Save
    # ------------------------------------------------------------------

    async def save_browser_state(self, context, page=None) -> bool:
        """Save cookies + localStorage from a Patchright BrowserContext.

        Args:
            context: patchright BrowserContext
            page: optional patchright Page (for sessionStorage)
        """
        try:
            await context.storage_state(path=str(self.state_file))

            if page:
                try:
                    session_data: str = await page.evaluate("""() => {
                        const s = {};
                        for (let i = 0; i < sessionStorage.length; i++) {
                            const k = sessionStorage.key(i);
                            if (k) s[k] = sessionStorage.getItem(k) || '';
                        }
                        return JSON.stringify(s);
                    }""")
                    self.session_file.write_text(session_data, encoding="utf-8")
                except Exception as exc:
                    logger.warning("sessionStorage save failed: %s", exc)

            logger.info("Browser state saved to %s", self.state_file)
            return True
        except Exception as exc:
            logger.error("Failed to save browser state: %s", exc)
            return False

    # ------------------------------------------------------------------
    # Load / check
    # ------------------------------------------------------------------

    def has_saved_state(self) -> bool:
        return self.state_file.exists()

    def get_state_path(self) -> str | None:
        if self.state_file.exists():
            return str(self.state_file)
        return None

    def is_state_expired(self) -> bool:
        if not self.state_file.exists():
            return True
        age_seconds = time.time() - self.state_file.stat().st_mtime
        return age_seconds > (self.expiry_hours * 3600)

    def get_valid_state_path(self) -> str | None:
        path = self.get_state_path()
        if path is None:
            return None
        if self.is_state_expired():
            logger.warning("Saved state is expired (>%.0fh old)", self.expiry_hours)
            return None
        return path

    async def validate_cookies(self, context) -> bool:
        """Check that critical Google auth cookies exist and are not expired."""
        try:
            cookies = await context.cookies()
            if not cookies:
                return False

            google = [c for c in cookies if "google.com" in c.get("domain", "")]
            if not google:
                return False

            now = time.time()
            critical = [c for c in google if c["name"] in CRITICAL_COOKIE_NAMES]
            if not critical:
                return False

            for c in critical:
                exp = c.get("expires", -1)
                if exp != -1 and exp < now:
                    logger.warning("Cookie %s expired", c["name"])
                    return False

            return True
        except Exception as exc:
            logger.warning("Cookie validation failed: %s", exc)
            return False

    # ------------------------------------------------------------------
    # Clear
    # ------------------------------------------------------------------

    async def clear_all(self) -> None:
        """Delete all persisted auth data (state files + chrome profile)."""
        for f in [self.state_file, self.session_file]:
            try:
                f.unlink(missing_ok=True)
            except OSError:
                pass

        if self.chrome_profile_dir.exists():
            shutil.rmtree(self.chrome_profile_dir, ignore_errors=True)
            self.chrome_profile_dir.mkdir(parents=True, exist_ok=True)

        logger.info("All auth data cleared.")

    # ------------------------------------------------------------------
    # Status summary
    # ------------------------------------------------------------------

    def status_dict(self) -> dict:
        """Return a JSON-serialisable status summary."""
        has_state = self.has_saved_state()
        expired = self.is_state_expired() if has_state else None
        age_h = None
        if has_state:
            age_h = round((time.time() - self.state_file.stat().st_mtime) / 3600, 1)

        return {
            "has_saved_state": has_state,
            "expired": expired,
            "state_age_hours": age_h,
            "state_file": str(self.state_file),
            "chrome_profile": str(self.chrome_profile_dir),
        }
