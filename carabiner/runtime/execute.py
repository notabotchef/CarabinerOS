"""Mutation runner — single place where the bridge actually mutates DB state.

Reuses the helpers in ``carabiner/mcp/server.py``
(``_resolve_repo_fn``, ``_prepare_data``, ``_serialise``, ``_slim``)
so the wire format and coercion logic are identical to the legacy
MCP server. The only difference is the surface — the bridge calls
this directly from ``CardRegistry.commit`` rather than exposing
every verb through the MCP tool.
"""

from __future__ import annotations

from typing import Any, Mapping


async def execute_mutation(
    resource: str, verb: str, data: Mapping[str, Any]
) -> dict[str, Any]:
    """Run a single CRUD mutation through the repository layer.

    The repository functions in ``carabiner.db.repositories`` are
    async; this coroutine awaits them and returns the serialised
    result via ``_serialise`` + ``_slim`` so heavy JSONB/Text columns
    don't blow up the MCP response.

    Raises whatever the underlying repository raises — the caller
    (``CardRegistry.commit``) is responsible for translating to a
    card status update and emitting a follow-up audit row.
    """
    from carabiner.mcp.server import _prepare_data, _resolve_repo_fn, _serialise, _slim

    if verb not in {"create", "update", "delete"}:
        raise ValueError(f"unsupported verb: {verb!r}")

    fn = await _resolve_repo_fn(resource, verb)
    prepared = _prepare_data(resource, dict(data))

    if verb == "create":
        result = await fn(prepared)
    elif verb == "update":
        if "id" not in prepared:
            raise ValueError("update requires an 'id' in data")
        result = await fn(prepared["id"], prepared)
    else:  # delete
        if "id" not in prepared:
            raise ValueError("delete requires an 'id' in data")
        result = await fn(prepared["id"])

    return _slim([_serialise(result)])[0] if result is not None else {}