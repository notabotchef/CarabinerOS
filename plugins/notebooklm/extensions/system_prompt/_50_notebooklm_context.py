"""
NotebookLM System Prompt Extension.

Injects tool descriptions for NotebookLM into the A0 system prompt so
the agent knows these tools exist and when to use them.
"""

from __future__ import annotations

from typing import Any

try:
    from helpers.extension import Extension
except ImportError:
    from helpers.extension import Extension

from agent import LoopData


class NotebookLMContext(Extension):
    async def execute(
        self,
        system_prompt: list[str] = [],
        loop_data: LoopData = LoopData(),
        **kwargs: Any,
    ) -> None:
        context_parts = [
            "",
            "## NotebookLM Integration",
            "You have access to Google NotebookLM for deep research grounded in "
            "uploaded sources (PDFs, docs, websites). NotebookLM uses Gemini to "
            "answer questions with source citations.",
            "",
            "Available tools:",
            "- **notebooklm_auth_setup** — Launch the remote browser auth flow. "
            "  The user connects to the container's Chromium via their host browser "
            "  and logs into Google. Use this FIRST before any queries.",
            "- **notebooklm_auth_status** — Check if Google auth is still valid.",
            "- **notebooklm_ask** — Ask a question to a NotebookLM notebook. "
            "  Params: question (required), notebook_url (optional), session_id "
            "  (optional, for follow-up questions in the same session).",
            "- **notebooklm_list_notebooks** — List available notebooks (stub).",
            "",
            "Workflow:",
            "1. If the user wants to query NotebookLM, first check auth with "
            "   notebooklm_auth_status.",
            "2. If not authenticated, run notebooklm_auth_setup and give the user "
            "   the remote debug URL (http://localhost:9222).",
            "3. Once authenticated, use notebooklm_ask with the notebook URL.",
            "4. For follow-up questions, reuse the session_id from the first call.",
        ]

        system_prompt.append("\n".join(context_parts))
