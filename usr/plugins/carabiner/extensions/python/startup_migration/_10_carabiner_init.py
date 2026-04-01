"""Initialize CarabinerOS database at A0 startup.

The database is used by the MCP server (carabiner-db) which A0 launches
as a subprocess. This extension pre-initializes the connection pool so
the Flask route layer (if added later) can also use it.

All data flows through A0: frontend ↔ A0 (Socket.IO) ↔ DB (MCP tools).
"""

import asyncio
import os

from helpers.extension import Extension
from helpers.print_style import PrintStyle


class CarabinerInit(Extension):
    def execute(self, **kwargs):
        try:
            db_url = os.environ.get(
                "DATABASE_URL",
                "postgresql+asyncpg://carabiner:carabiner@localhost:5432/carabiner",
            )
            # Ensure carabiner package is importable (PYTHONPATH=/cos in Docker)
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
