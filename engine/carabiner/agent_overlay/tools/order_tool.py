"""Order management tool — list, draft, review vendor orders."""

from __future__ import annotations

import json
from helpers.tool import Response, Tool


class OrderTool(Tool):
    async def execute(self, **kwargs) -> Response:
        try:
            return await self._run()
        except Exception as e:
            return Response(message=f"Error accessing order data: {e}", break_loop=False)

    async def _run(self) -> Response:
        from carabiner.db import repositories as repo

        method = self.args.get("method", "list")
        location_id = self.args.get("location_id")

        if method == "list":
            orders = await repo.list_orders(location_id)
            if not orders:
                return Response(message="No orders found for this location.", break_loop=False)
            result = [
                {"id": str(o.id), "vendor": o.vendor, "channel": o.channel,
                 "status": o.status, "total": o.total, "eta": o.eta, "summary": o.summary}
                for o in orders
            ]
            return Response(
                message=json.dumps(result, indent=2), break_loop=False,
                additional={"module": "orders", "action": "list"},
            )

        if method == "get":
            order_id = self.args.get("order_id")
            if not order_id:
                return Response(message="Error: order_id is required.", break_loop=False)
            order = await repo.get_order(order_id)
            if not order:
                return Response(message=f"Order {order_id} not found.", break_loop=False)
            return Response(
                message=json.dumps({
                    "id": str(order.id), "vendor": order.vendor, "channel": order.channel,
                    "status": order.status, "total": order.total, "eta": order.eta,
                    "summary": order.summary, "detail_points": order.detail_points,
                }, indent=2), break_loop=False,
            )

        if method == "update":
            order_id = self.args.get("order_id")
            updates = {f: self.args[f] for f in ["status", "total", "eta", "summary"] if f in self.args}
            order = await repo.update_order(order_id, updates)
            if not order:
                return Response(message=f"Order {order_id} not found.", break_loop=False)
            return Response(
                message=f"Order updated: {order.vendor} is now {order.status}.",
                break_loop=False,
                additional={"module": "orders", "action": "update", "item_id": str(order.id)},
            )

        return Response(message=f"Unknown method: {method}. Use list, get, or update.", break_loop=False)
