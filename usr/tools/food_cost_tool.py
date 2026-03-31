"""Food cost analysis tool — margins, pressure, actions."""

from __future__ import annotations

import json
from helpers.tool import Response, Tool


class FoodCostTool(Tool):
    async def execute(self, **kwargs) -> Response:
        try:
            return await self._run()
        except Exception as e:
            return Response(message=f"Error accessing food cost data: {e}", break_loop=False)

    async def _run(self) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            items = await repo.list_food_cost(location_id)
            if not items:
                return Response(message="No food cost data found.", break_loop=False)
            result = [
                {"item": i.menu_item_name, "pressure": i.pressure,
                 "cost_pct": i.current_cost_pct, "action": i.action, "summary": i.summary}
                for i in items
            ]
            return Response(message=json.dumps(result, indent=2), break_loop=False)

        if method == "analyze":
            items = await repo.list_food_cost(location_id)
            if not items:
                return Response(message="No food cost data to analyze.", break_loop=False)
            costs = [float(i.current_cost_pct.replace("%", "")) for i in items]
            avg = sum(costs) / len(costs) if costs else 0
            above_target = [i for i in items if i.pressure.startswith("+")]
            result = {
                "average_cost_pct": f"{avg:.1f}%",
                "total_items": len(items),
                "above_target": len(above_target),
                "highest_pressure": [
                    {"item": i.menu_item_name, "pressure": i.pressure, "action": i.action}
                    for i in above_target
                ],
            }
            return Response(message=json.dumps(result, indent=2), break_loop=False)

        return Response(message=f"Unknown method: {method}. Use list or analyze.", break_loop=False)
