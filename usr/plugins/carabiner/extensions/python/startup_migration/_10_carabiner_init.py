"""Register CarabinerOS Flask blueprint and initialize the database.

Hooks into A0's startup_migration (runs at server startup, before
register_api_route). Registers our Flask blueprint on the A0 webapp
so CarabinerOS API routes are available at /api/*.

Zero patches to A0 core — we import the module-level webapp and register on it.
"""

import asyncio
import os
import sys

from helpers.extension import Extension
from helpers.print_style import PrintStyle


def _ensure_carabiner_importable():
    """Ensure carabiner.* imports work by adding the right path to sys.path.

    In Docker: PYTHONPATH=/cos is set, carabiner/ is at /cos/carabiner/.
    In local dev: carabiner/ is at the repo root (parent of engine/agent-zero/).
    """
    try:
        import carabiner  # noqa: F401
        return  # already importable (PYTHONPATH set in Docker)
    except ImportError:
        pass

    # Local dev: walk up from this file to find the repo root
    current = os.path.dirname(os.path.abspath(__file__))
    for _ in range(10):
        candidate = os.path.dirname(current)
        if os.path.isdir(os.path.join(candidate, "carabiner")):
            if candidate not in sys.path:
                sys.path.insert(0, candidate)
            return
        current = candidate


class CarabinerInit(Extension):
    def execute(self, **kwargs):
        _ensure_carabiner_importable()

        # Register Flask blueprint
        try:
            from run_ui import webapp
            from carabiner.api.flask_blueprint import blueprint
            webapp.register_blueprint(blueprint)
            PrintStyle(
                background_color="#D97706", font_color="white", padding=True
            ).print("CarabinerOS API routes registered")
        except Exception as e:
            PrintStyle(
                background_color="red", font_color="white", padding=True
            ).print(f"CarabinerOS API route registration failed: {e}")
            import traceback
            traceback.print_exc()

        # Initialize database
        try:
            db_url = os.environ.get(
                "DATABASE_URL",
                "postgresql+asyncpg://carabiner:carabiner@localhost:5432/carabiner",
            )
            from carabiner.db.engine import init_db
            loop = asyncio.new_event_loop()
            loop.run_until_complete(init_db(db_url))
            loop.close()
            PrintStyle(
                background_color="#059669", font_color="white", padding=True
            ).print("CarabinerOS database connected")
        except Exception as e:
            PrintStyle(
                background_color="red", font_color="white", padding=True
            ).print(f"CarabinerOS DB init failed (non-fatal): {e}")
