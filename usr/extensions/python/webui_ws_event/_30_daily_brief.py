"""Extension that handles ``daily_brief_request`` WebSocket events.

When the frontend (or any Socket.IO client) emits ``daily_brief_request``,
this extension queries the database, builds a deterministic Daily Brief
action card, and pushes it back via the ``action_card`` event.

This bypasses A0 entirely — cOS owns the card construction so the layout,
module tag, and data shape are always correct.
"""

from helpers.extension import Extension

print("[DailyBrief] Extension module loaded")


class DailyBrief(Extension):
    async def execute(
        self,
        instance=None,
        sid: str = "",
        event_type: str = "",
        data: dict | None = None,
        response_data: dict | None = None,
        **kwargs,
    ):
        print(f"[DailyBrief] event_type={event_type}")
        if event_type != "daily_brief_request":
            return
        print("[DailyBrief] Handling daily_brief_request")

        location_id = (data or {}).get("location_id")

        from python.tools.daily_brief_tool import (
            _resolve_location,
            _gather_brief_data,
            build_brief_card,
        )
        from datetime import date

        try:
            loc_id, loc_name = await _resolve_location(location_id)
            brief_data = await _gather_brief_data(loc_id)
            card = build_brief_card(
                location_name=loc_name,
                today=date.today(),
                pending_orders=brief_data["pending_orders"],
                pending_invoices=brief_data["pending_invoices"],
                incomplete_prep=brief_data["incomplete_prep"],
                par_shortfalls=brief_data["par_shortfalls"],
                pl_row=brief_data["pl_row"],
            )

            from helpers.ws_manager import send_data  # type: ignore

            await send_data("action_card", {"card": card})

            if response_data is not None:
                response_data.update({"ok": True, "data": {"card_id": card["id"]}})
        except Exception as exc:
            if response_data is not None:
                response_data.update({"ok": False, "error": {"message": str(exc)}})
