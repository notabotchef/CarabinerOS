"""Async database engine and session management."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


async def init_db(database_url: str) -> None:
    """Create the async engine and session factory.

    Call once at application startup.
    """
    global _engine, _session_factory

    _engine = create_async_engine(
        database_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False)


async def close_db() -> None:
    """Dispose the engine. Call at application shutdown."""
    global _engine, _session_factory

    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async session, committing on success and rolling back on error.

    If called from a different event loop (e.g., Agent Zero's DeferredTask thread),
    creates a fresh engine to avoid asyncpg cross-loop errors.
    """
    import asyncio
    import os

    # Check if we're on a different event loop than the one that created the engine
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _session_factory is not None and _engine is not None:
        # Try using the existing factory
        try:
            async with _session_factory() as session:
                try:
                    yield session
                except Exception:
                    await session.rollback()
                    raise
            return
        except Exception as e:
            if "unknown protocol state" not in str(e) and "different event loop" not in str(e).lower():
                raise
            # Fall through to create a fresh engine for this loop

    # Create a fresh engine for this event loop (cross-loop scenario)
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://carabiner:carabiner@localhost:5432/carabiner",
    )
    temp_engine = create_async_engine(db_url, pool_size=2, max_overflow=5)
    temp_factory = async_sessionmaker(temp_engine, expire_on_commit=False)

    async with temp_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await temp_engine.dispose()
