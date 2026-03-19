"""Emit structured 'chef_status' events when a tool starts.

Part of the Expo Station v3+ architecture.
"""

from __future__ import annotations
import random
import logging
from python.helpers.extension import Extension

logger = logging.getLogger(__name__)

QUIRKY_MESSAGES = {
    "food_cost_tool": [
        "Crunching the numbers on that produce order...",
        "Checking if the avocado market crashed yet...",
    ],
    "inventory_tool": [
        "Checking the walk-in...",
        "Counting what's left after brunch service...",
    ],
    "prep_tool": [
        "Asking the sous chef about tomorrow's prep...",
        "Making sure mise en place is actually en place...",
    ],
    "order_tool": [
        "Drafting that PO, hang tight...",
        "Negotiating with the vendor rep...",
    ],
    "recipe_tool": [
        "Pulling up the recipe book...",
        "Cross-referencing Chef's secret notes...",
    ],
    "reporting_tool": [
        "Pulling last week's covers from the reservation book...",
        "Running the numbers for the morning briefing...",
    ],
    "invoice_tool": [
        "Scanning that invoice...",
        "Making sure they didn't overcharge us again...",
    ],
    "marketing_tool": [
        "Drafting something Instagram-worthy...",
        "Thinking about what would make foodies stop scrolling...",
    ],
    "menu_tool": [
        "Checking the menu matrix...",
        "Looking at what's selling and what's sitting...",
    ],
    "default": [
        "Working on it...",
        "One moment...",
        "On it, Chef...",
    ],
}

class ChefStatusBefore(Extension):
    async def execute(self, **kwargs) -> None:
        tool_name = kwargs.get("tool_name")
        if not tool_name:
            return

        sio = self.agent.config.additional.get("sio")
        if not sio:
            return

        messages = QUIRKY_MESSAGES.get(tool_name, QUIRKY_MESSAGES["default"])
        msg = random.choice(messages)

        try:
            await sio.emit("chef_status", {
                "status": "working",
                "tool": tool_name,
                "text": msg,
                "active": True
            }, namespace="/state_sync")
        except Exception as e:
            logger.warning("Failed to emit chef_status: %s", e)
