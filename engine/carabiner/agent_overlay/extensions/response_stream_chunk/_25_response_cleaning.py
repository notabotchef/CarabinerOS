"""Clean internal agent language from response stream chunks.

Strips tool names, agent references, and internal prefixes so the
operator sees clean, restaurant-context output.
"""

from __future__ import annotations

import re
from helpers.extension import Extension


class ResponseCleaning(Extension):
    async def execute(self, **kwargs) -> None:
        chunk = kwargs.get("chunk", "")
        if not chunk or not isinstance(chunk, str):
            return

        cleaned = chunk
        # Replace internal tool names with operational language
        cleaned = re.sub(r"\bcode_execution_tool\b", "operational workflow", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bbrowser_agent\b", "vendor workflow", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bdocument_query\b", "document review", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\brestaurant_ops\b", "restaurant ops", cleaned, flags=re.IGNORECASE)
        # Remove agent references
        cleaned = re.sub(r"\bA[0-9]\b", "", cleaned)
        cleaned = re.sub(r"\b(subagent|subordinate|superior)\b", "", cleaned, flags=re.IGNORECASE)
        # Normalize whitespace
        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

        kwargs["chunk"] = cleaned
