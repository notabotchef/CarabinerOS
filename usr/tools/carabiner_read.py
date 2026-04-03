"""carabiner_read — read-only access to CarabinerOS database.

Usage:
  carabiner_read(resource="orders", verb="list", args="--status Drafting")
  carabiner_read(resource="inventory", verb="get", args="<uuid>")

Allowed verbs: list, get, query, summary
Always appends --json so output is machine-readable.
"""

from __future__ import annotations

import subprocess
import json
import shlex

from helpers.tool import Tool, Response


_ALLOWED_VERBS = {"list", "get", "query", "summary", "counts", "par-levels"}

_RESOURCES = {
    "orders", "inventory", "recipes", "menu", "invoices",
    "prep", "food-cost", "vendors", "campaigns",
}


class CarabinerRead(Tool):
    async def execute(self, **kwargs) -> Response:
        resource = (self.args.get("resource") or "").strip().lower()
        verb = (self.args.get("verb") or "list").strip().lower()
        extra_args = (self.args.get("args") or "").strip()

        if not resource:
            return Response(
                message="carabiner_read requires a 'resource' argument (e.g. orders, inventory).",
                break_loop=False,
            )

        if resource not in _RESOURCES:
            return Response(
                message=f"Unknown resource '{resource}'. Valid: {', '.join(sorted(_RESOURCES))}",
                break_loop=False,
            )

        if verb not in _ALLOWED_VERBS:
            return Response(
                message=(
                    f"Verb '{verb}' is not a read verb. "
                    f"Use carabiner_write for create/update/delete. "
                    f"Allowed read verbs: {', '.join(sorted(_ALLOWED_VERBS))}"
                ),
                break_loop=False,
            )

        # Build command — always include --json
        parts = ["carabiner", resource, verb]
        if extra_args:
            try:
                parts += shlex.split(extra_args)
            except ValueError:
                parts += extra_args.split()
        if "--json" not in parts:
            parts.append("--json")

        try:
            result = subprocess.run(
                parts,
                capture_output=True,
                text=True,
                timeout=30,
            )
            output = result.stdout.strip()
            if result.returncode != 0:
                err = result.stderr.strip() or output
                return Response(message=f"carabiner error (exit {result.returncode}): {err}", break_loop=False)
            return Response(message=output or "(no output)", break_loop=False)
        except subprocess.TimeoutExpired:
            return Response(message="carabiner_read timed out after 30s", break_loop=False)
        except FileNotFoundError:
            return Response(message="carabiner CLI not found in PATH", break_loop=False)
        except Exception as e:
            return Response(message=f"carabiner_read failed: {e}", break_loop=False)
