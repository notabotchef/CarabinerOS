"""Clean internal agent language from response stream chunks.

Strips tool names, agent references, internal directives, and
Agent Zero artifacts so the operator sees clean output.
"""

from __future__ import annotations

import re
from python.helpers.extension import Extension


class ResponseCleaning(Extension):
    async def execute(self, **kwargs) -> None:
        chunk = kwargs.get("chunk", "")
        if not chunk or not isinstance(chunk, str):
            return

        cleaned = chunk

        # Strip Agent Zero internal directives (§§include, §§ commands)
        cleaned = re.sub(r"§§[^\n]*", "", cleaned)

        # Replace internal tool names with operational language
        cleaned = re.sub(r"\bcode_execution_tool\b", "operational workflow", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bbrowser_agent\b", "vendor workflow", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bdocument_query\b", "document review", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\brestaurant_ops\b", "restaurant ops", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bcall_subordinate\b", "delegating", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\binventory_tool\b", "inventory check", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\border_tool\b", "order management", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bprep_tool\b", "prep planning", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bfood_cost_tool\b", "cost analysis", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bmenu_tool\b", "menu analysis", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bmarketing_tool\b", "marketing review", cleaned, flags=re.IGNORECASE)

        # Remove agent references
        cleaned = re.sub(r"\bAgent\s*[0-9]+\b", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\bA[0-9]\b", "", cleaned)
        cleaned = re.sub(r"\b(subagent|subordinate agent|subordinate|superior agent|superior)\b", "", cleaned, flags=re.IGNORECASE)

        # Remove "from subordinate" / "response from" internal language
        cleaned = re.sub(r"(?:response |order response |result )?from (?:subordinate|sub) ?(?:agent)?:?\s*", "", cleaned, flags=re.IGNORECASE)

        # Clean up artifacts
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)  # max 2 newlines
        cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)   # collapse spaces

        kwargs["chunk"] = cleaned
