"""Menu engineering tool — performance analysis, pricing."""

from __future__ import annotations

import json
from helpers.tool import Response, Tool


class MenuTool(Tool):
    async def execute(self, **kwargs) -> Response:
        try:
            return await self._run()
        except Exception as e:
            return Response(message=f"Error accessing menu data: {e}", break_loop=False)

    async def _run(self) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            items = await repo.list_menu(location_id)
            if not items:
                return Response(message="No menu items found.", break_loop=False)
            result = [
                {"item": i.item_name, "category": i.category, "performance": i.performance,
                 "margin": i.margin_pct, "recommendation": i.recommendation}
                for i in items
            ]
            return Response(message=json.dumps(result, indent=2), break_loop=False)

        if method == "engineering_report":
            items = await repo.list_menu(location_id)
            categories = {"Star": [], "Puzzle": [], "Plowhorse": [], "Dog": []}
            for i in items:
                perf = i.performance.capitalize()
                if perf in categories:
                    categories[perf].append({
                        "item": i.item_name, "margin": i.margin_pct,
                        "recommendation": i.recommendation,
                    })
            return Response(message=json.dumps(categories, indent=2), break_loop=False)

        return Response(message=f"Unknown method: {method}. Use list or engineering_report.", break_loop=False)
