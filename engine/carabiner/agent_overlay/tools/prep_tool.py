"""Prep management tool — plans, readiness, shortages."""

from __future__ import annotations

import json
from helpers.tool import Response, Tool


class PrepTool(Tool):
    async def execute(self, **kwargs) -> Response:
        try:
            return await self._run()
        except Exception as e:
            return Response(message=f"Error accessing prep data: {e}", break_loop=False)

    async def _run(self) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            tasks = await repo.list_prep(location_id)
            if not tasks:
                return Response(message="No prep tasks found.", break_loop=False)
            lanes = {}
            for t in tasks:
                lane = t.service_lane
                if lane not in lanes:
                    lanes[lane] = []
                lanes[lane].append({
                    "task": t.task, "station": t.station,
                    "readiness": t.readiness, "shortage": t.shortage,
                })
            return Response(message=json.dumps(lanes, indent=2), break_loop=False)

        if method == "check_readiness":
            tasks = await repo.list_prep(location_id)
            blocked = [t for t in tasks if t.readiness.lower() == "blocked"]
            at_risk = [t for t in tasks if t.readiness.lower() == "at risk"]
            ready = [t for t in tasks if t.readiness.lower() == "ready"]
            summary = f"Ready: {len(ready)}, At risk: {len(at_risk)}, Blocked: {len(blocked)}"
            details = []
            for t in blocked + at_risk:
                details.append(f"- {t.task} ({t.service_lane}): {t.readiness} — {t.shortage or 'no shortage noted'}")
            msg = f"{summary}\n\n" + "\n".join(details) if details else summary
            return Response(message=msg, break_loop=False)

        return Response(message=f"Unknown method: {method}. Use list or check_readiness.", break_loop=False)
