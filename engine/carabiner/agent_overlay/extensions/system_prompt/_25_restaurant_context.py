"""Extension: inject restaurant context into Agent Zero's system prompt.

Priority _25 ensures this runs early in the extension chain.
This is a test extension to verify overlay extension discovery works.
In Phase 5 it will inject real location/priority/connector context.
"""

from __future__ import annotations

from helpers.extension import Extension


class RestaurantContext(Extension):
    async def execute(self, **kwargs) -> None:
        prompt: str = kwargs.get("system_prompt", "")
        agent = kwargs.get("agent")

        restaurant_context = (
            "\n\n## Restaurant Operations Context\n"
            "You are CarabinerOS, a restaurant operations assistant.\n"
            "You help manage orders, inventory, prep, food cost, menu engineering, "
            "and marketing for a multi-location restaurant group.\n"
        )

        if hasattr(agent, "config") and hasattr(agent.config, "additional"):
            location = agent.config.additional.get("active_location", "River North")
            restaurant_context += f"Active location: {location}\n"

        kwargs["system_prompt"] = prompt + restaurant_context
