"""Marketing campaign tool — research, briefs, pipeline."""

from __future__ import annotations

import json
from helpers.tool import Response, Tool


class MarketingTool(Tool):
    async def execute(self, **kwargs) -> Response:
        try:
            return await self._run()
        except Exception as e:
            return Response(message=f"Error accessing marketing data: {e}", break_loop=False)

    async def _run(self) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            campaigns = await repo.list_campaigns(location_id)
            if not campaigns:
                return Response(message="No campaigns found.", break_loop=False)
            result = [
                {"campaign": c.campaign_name, "channel": c.channel, "stage": c.stage,
                 "deliverable": c.deliverable, "summary": c.summary}
                for c in campaigns
            ]
            return Response(message=json.dumps(result, indent=2), break_loop=False)

        if method == "stage_summary":
            campaigns = await repo.list_campaigns(location_id)
            stages = {}
            for c in campaigns:
                if c.stage not in stages:
                    stages[c.stage] = []
                stages[c.stage].append({"campaign": c.campaign_name, "deliverable": c.deliverable})
            return Response(message=json.dumps(stages, indent=2), break_loop=False)

        return Response(message=f"Unknown method: {method}. Use list or stage_summary.", break_loop=False)
