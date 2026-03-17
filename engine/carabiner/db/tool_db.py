"""Database access helpers for Agent Zero overlay tools.

All functions use SQLAlchemy statements (never raw SQL strings)
to enforce parameterized queries and prevent injection.
"""

from __future__ import annotations

from typing import Any, Sequence

from sqlalchemy import Row, Select
from sqlalchemy.ext.asyncio import AsyncSession

from carabiner.db.engine import get_session


async def execute_query(stmt: Select) -> Sequence[Row[Any]]:
    """Execute a SELECT statement and return all rows."""
    async with get_session() as session:
        result = await session.execute(stmt)
        return result.all()


async def execute_write(stmt: Any) -> None:
    """Execute a write statement (INSERT/UPDATE/DELETE) and commit."""
    async with get_session() as session:
        await session.execute(stmt)
        await session.commit()


async def execute_returning(stmt: Any) -> Row[Any]:
    """Execute an INSERT...RETURNING and return the single row."""
    async with get_session() as session:
        result = await session.execute(stmt)
        await session.commit()
        return result.one()


async def execute_scalars(stmt: Select) -> Sequence[Any]:
    """Execute a SELECT and return scalar results (first column of each row)."""
    async with get_session() as session:
        result = await session.scalars(stmt)
        return result.all()


async def get_scoped_session() -> AsyncSession:
    """Return a raw session for complex multi-statement transactions.

    Caller is responsible for committing/rolling back.
    """
    from carabiner.db.engine import _session_factory

    if _session_factory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _session_factory()
