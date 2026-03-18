"""Inject real restaurant context into Agent Zero's system prompt.

Reads active location, organization, and operational priorities from
the agent config and DB to provide context for every agent interaction.
"""

from __future__ import annotations

from typing import Any
from python.helpers.extension import Extension
from agent import LoopData


class RestaurantContext(Extension):
    async def execute(
        self,
        system_prompt: list[str] = [],
        loop_data: LoopData = LoopData(),
        **kwargs: Any,
    ) -> None:
        context_parts = [
            "## Restaurant Operations Context",
            "You are operating within CarabinerOS, a restaurant operations platform.",
        ]

        if hasattr(self.agent, "config") and hasattr(self.agent.config, "additional"):
            additional = self.agent.config.additional
            location = additional.get("active_location_name", "Unknown")
            location_status = additional.get("active_location_status", "")
            org = additional.get("organization_name", "Carabiner Restaurant Group")

            context_parts.append(f"Organization: {org}")
            context_parts.append(f"Active location: {location}")
            if location_status:
                context_parts.append(f"Location status: {location_status}")

            location_id = additional.get("active_location_id")
            if location_id:
                context_parts.append(f"Location ID (for tool calls): {location_id}")

        context_parts.append("")
        context_parts.append("Use the available tools to query real operational data before making recommendations.")
        context_parts.append("Always reference specific numbers, items, and locations in your responses.")

        system_prompt.append("\n".join(context_parts))
