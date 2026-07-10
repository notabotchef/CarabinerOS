"""Scoped 2-tool MCP surface for the bridge.

This is **not** the 63-tool legacy MCP server. The bridge exposes
exactly two tools to hermes, mounted at ``/mcp`` via FastMCP's
``streamable_http_app()``:

- :func:`carabiner_read` — read across the 8 modules
  (``orders, inventory, prep, food_cost, menu, recipes, invoices,
  campaigns``). Delegates to ``carabiner.mcp.server`` helpers
  (``_MODULE_REGISTRY``, ``_serialise``, ``_slim``).
- :func:`carabiner_propose_write` — propose a mutation. Runs the
  host-side policy gate, writes an ``ActionLog(status="proposed")``
  row, and emits an ``action_card`` for the operator. **Never
  mutates.** Returns ``{"status":"awaiting_approval","card":...}``
  on success or ``{"status":"denied","reason":...}`` on policy denial.

Hermes discovers these via ``mcp_servers.carabiner.url`` in its
config (set to ``http://bridge:8641/mcp`` for local dev).

Tool invocations are recorded in :data:`active_run_registry` so the
bridge's HTTP layer can append ``{type:"tool"}`` log entries with
non-empty ``heading`` when hermes invokes these — the frontend
streams them as part of the assistant response.
"""

from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from typing import Any, Mapping

logger = logging.getLogger(__name__)


# Cross-run tool invocation registry. The bridge's HTTP layer reads
# from this when hermes invokes a tool mid-run, so the frontend sees
# a tool-call log entry alongside the streaming text.
#
# Shape: {run_id: [{"tool": str, "args": dict, "ts": int, "result_kind": str}]}
active_run_registry: dict[str, list[dict[str, Any]]] = {}
_RUN_LOCK = threading.Lock()


def record_tool_invocation(run_id: str, tool: str, args: Mapping[str, Any], result_kind: str) -> None:
    """Append a tool invocation to the active-run registry."""
    with _RUN_LOCK:
        active_run_registry.setdefault(run_id, []).append(
            {
                "tool": tool,
                "args": dict(args),
                "ts": int(time.time()),
                "result_kind": result_kind,
            }
        )


def drain_run_registry(run_id: str) -> list[dict[str, Any]]:
    """Pop all tool invocations for a run (used by the bridge after run end)."""
    with _RUN_LOCK:
        return active_run_registry.pop(run_id, [])


# The FastMCP instance is built lazily so the module loads cleanly
# even if ``mcp`` is not yet installed in the active venv.
_mcp_instance: Any | None = None


def get_mcp() -> Any:
    """Return the FastMCP instance, building it on first call.

    ``streamable_http_path="/"`` makes the inner Starlette app route at
    root, which is what we need for ``Mount("/mcp/", ...)`` to forward
    correctly: Starlette strips the ``/mcp/`` prefix when forwarding
    into the sub-app, and the inner route matches at ``/``.
    """
    global _mcp_instance
    if _mcp_instance is None:
        from mcp.server.fastmcp import FastMCP

        _mcp_instance = FastMCP(
            "carabiner_bridge",
            json_response=True,
            streamable_http_path="/",
            # Disable the StreamableHTTPSessionManager task group. When
            # the FastMCP app is mounted inside another ASGI app (our
            # FastAPI), the outer uvicorn does not run FastMCP's
            # lifespan, so the task group is never initialised.
            # stateless_http=True makes the manager dispatch to
            # _handle_stateless_request, which does not require the
            # task group. Suitable for our read+propose MCP surface.
            stateless_http=True,
        )
        _register_tools(_mcp_instance)
    return _mcp_instance


def _register_tools(mcp: Any) -> None:
    """Register the two scoped tools on the FastMCP instance."""

    @mcp.tool()
    async def carabiner_read(
        resource: str,
        id: str | None = None,
        filters: str | None = None,
        run_id: str | None = None,
    ) -> str:
        """Read restaurant data. Delegates to ``carabiner.mcp.server``.

        ``resource``: one of ``orders, inventory, prep, food_cost, menu,
        recipes, invoices, campaigns``.
        ``id``: optional UUID — fetch a single record by primary key.
        ``filters``: optional JSON string with filter fields
        (``{"location_id": "uuid", ...}``).
        ``run_id``: optional active-run id; if provided, the invocation
        is recorded so the bridge can emit a ``{type:"tool"}`` log entry.
        """
        from carabiner.mcp import server as mcp_server

        parsed_filters: dict[str, Any] = {}
        if filters:
            try:
                parsed_filters = json.loads(filters)
            except json.JSONDecodeError as exc:
                record_tool_invocation(
                    run_id or "orphan", "carabiner_read", {"resource": resource}, "error"
                )
                return json.dumps({"error": "invalid_filters", "message": str(exc)})

        if id:
            parsed_filters = {"id": id, **parsed_filters}

        try:
            await mcp_server._ensure_db()
            registry = mcp_server._MODULE_REGISTRY
            if resource not in registry:
                return json.dumps(
                    {
                        "error": "invalid_resource",
                        "message": f"Unknown resource {resource!r}. Valid: {sorted(registry.keys())}",
                    }
                )
            fn_name = registry[resource]["get" if id else "list"]
            fn = getattr(__import__("carabiner.db.repositories", fromlist=[fn_name]), fn_name)
            rows = await fn(**{k: v for k, v in parsed_filters.items() if k != "id"}) if not id else await fn(parsed_filters["id"])
            if isinstance(rows, list):
                payload = mcp_server._slim([mcp_server._serialise(r) for r in rows])
            else:
                payload = mcp_server._slim([mcp_server._serialise(rows)]) if rows else []
            result = {"data": payload, "count": len(payload)}
        except Exception as exc:  # noqa: BLE001
            record_tool_invocation(
                run_id or "orphan", "carabiner_read", {"resource": resource}, "error"
            )
            return json.dumps({"error": "read_failed", "message": str(exc)})

        if run_id:
            record_tool_invocation(
                run_id,
                "carabiner_read",
                {"resource": resource, "id": id, "filters": parsed_filters},
                "ok",
            )
        return json.dumps(result)

    @mcp.tool()
    async def carabiner_propose_write(
        resource: str,
        verb: str,
        data: str,
        reason: str,
        chat_id: str | None = None,
        run_id: str | None = None,
    ) -> str:
        """Propose a write mutation. **Never mutates.**

        Runs the host-side policy gate (see :mod:`policy`). If allowed:
        writes ``ActionLog(status="proposed")`` + emits an
        ``action_card`` for the operator. The mutation only runs when
        the operator clicks commit in the dashboard.
        """
        from . import cards, policy

        try:
            parsed = json.loads(data) if isinstance(data, str) else data
        except json.JSONDecodeError as exc:
            record_tool_invocation(
                run_id or "orphan", "carabiner_propose_write", {"resource": resource, "verb": verb}, "error"
            )
            return json.dumps({"error": "invalid_data", "message": str(exc)})

        decision = policy.check_propose(resource, verb, parsed)
        if not decision.allowed:
            record_tool_invocation(
                run_id or "orphan",
                "carabiner_propose_write",
                {"resource": resource, "verb": verb},
                f"denied:{decision.reason}",
            )
            return json.dumps(
                {"status": "denied", "reason": decision.reason, "resource": resource, "verb": verb}
            )

        try:
            card = cards.propose(
                resource=resource,
                verb=verb,
                data=parsed,
                reason=reason or "no reason provided",
                chat_id=chat_id,
            )
        except PermissionError as exc:
            record_tool_invocation(
                run_id or "orphan",
                "carabiner_propose_write",
                {"resource": resource, "verb": verb},
                f"denied:{exc}",
            )
            return json.dumps({"status": "denied", "reason": str(exc)})

        # ``cards.propose()`` is sync and its audit writer refuses to
        # nest event loops. We are *inside* a running loop (this MCP
        # handler is async). Write the audit row here directly via the
        # async path so AUDIT_REQUIRED=true actually fails closed.
        try:
            from . import audit as audit_mod

            await audit_mod.create_action_log(
                action_type=verb,
                status="proposed",
                card_id=card["id"],
                extra={
                    "resource": resource,
                    "data": {k: v for k, v in dict(parsed).items() if k != "id"},
                    "reason": reason or "no reason provided",
                    "source": "hermes-bridge",
                },
            )
        except Exception as exc:  # noqa: BLE001
            # AUDIT_REQUIRED=true (default) — refuse to return success
            # if the audit row couldn't be written.
            logger.error("audit write failed: %s", exc)
            return json.dumps(
                {
                    "status": "error",
                    "reason": f"audit_required_and_failed: {exc}",
                    "card": card,
                }
            )

        record_tool_invocation(
            run_id or "orphan",
            "carabiner_propose_write",
            {"resource": resource, "verb": verb, "card_id": card["id"]},
            "awaiting_approval",
        )
        return json.dumps({"status": "awaiting_approval", "card": card})


def streamable_http_app() -> Any:
    """Mount the FastMCP streamable-http ASGI app for the bridge.

    Use as::

        app.mount("/mcp", mcp_surface.streamable_http_app())

    Hermes connects via ``mcp_servers.carabiner.url = "http://bridge:8641/mcp"``.
    """
    return get_mcp().streamable_http_app()


def sse_app(mount_path: str | None = None) -> Any:
    """Fallback SSE-MCP app (older transport)."""
    return get_mcp().sse_app(mount_path)