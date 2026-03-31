"""Inventory management tool — check levels, flag variances."""

from __future__ import annotations

import json
from helpers.tool import Response, Tool


class InventoryTool(Tool):
    async def execute(self, **kwargs) -> Response:
        try:
            return await self._run()
        except Exception as e:
            return Response(message=f"Error accessing inventory data: {e}", break_loop=False)

    async def _run(self) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            items = await repo.list_inventory(location_id)
            if not items:
                return Response(message="No inventory items found.", break_loop=False)
            result = [
                {"item": i.item_name, "on_hand": i.on_hand, "par": i.par,
                 "variance": i.variance, "summary": i.summary}
                for i in items
            ]
            return Response(message=json.dumps(result, indent=2), break_loop=False)

        if method == "check_variances":
            items = await repo.list_inventory(location_id)
            below_par = [i for i in items if i.variance.startswith("-")]
            if not below_par:
                return Response(message="All items are at or above par.", break_loop=False)
            result = [
                {"item": i.item_name, "on_hand": i.on_hand, "par": i.par,
                 "variance": i.variance, "summary": i.summary}
                for i in below_par
            ]
            return Response(
                message=f"{len(below_par)} items below par:\n{json.dumps(result, indent=2)}",
                break_loop=False,
                additional={"module": "inventory", "action": "check"},
            )

        return Response(message=f"Unknown method: {method}. Use list or check_variances.", break_loop=False)
