"""Async DB helper for the CLI — bridges sync Typer commands to async DB calls."""

from __future__ import annotations

import asyncio
import os
import sys
from typing import Any, Coroutine, TypeVar

T = TypeVar("T")

# Exit codes
EXIT_OK = 0
EXIT_DB_ERROR = 1
EXIT_NOT_FOUND = 2
EXIT_VALIDATION = 3
EXIT_INTERNAL = 5


def run_async(coro: Coroutine[Any, Any, T]) -> T:
    """Run an async coroutine from sync Typer command context."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def ensure_db() -> None:
    """Initialize the DB engine if not already done.

    Reads DATABASE_URL from the environment. Falls back to a local default
    if the variable is not set.
    """
    from carabiner.db.engine import _engine, init_db

    if _engine is not None:
        return

    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://carabiner:carabiner@localhost:5432/carabiner",
    )
    await init_db(db_url)


async def cleanup_db() -> None:
    """Dispose the DB engine."""
    from carabiner.db.engine import close_db

    await close_db()


def db_call(coro_fn, *args, **kwargs) -> Any:
    """Convenience: init DB, run an async repo function, clean up.

    Usage:
        result = db_call(repositories.list_orders, location_id=loc)
    """

    async def _run():
        await ensure_db()
        try:
            return await coro_fn(*args, **kwargs)
        finally:
            await cleanup_db()

    return run_async(_run())
