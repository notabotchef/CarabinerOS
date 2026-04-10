"""Inject the action cards system prompt from the co-located markdown file."""

from __future__ import annotations

import os
from typing import Any
from helpers.extension import Extension
from agent import LoopData


class ActionCardsPrompt(Extension):
    async def execute(
        self,
        system_prompt: list[str] = [],
        loop_data: LoopData = LoopData(),
        **kwargs: Any,
    ) -> None:
        md_path = os.path.join(os.path.dirname(__file__), "_action_cards.md")
        try:
            with open(md_path, "r") as f:
                system_prompt.append(f.read())
        except FileNotFoundError:
            pass
