"""
Agent Zero tool for structured document extraction via langextract.

Methods:
  langextract:extract        — General extraction with custom prompt + examples
  langextract:extract_invoice — Invoice/delivery ticket extraction (built-in schema)
  langextract:extract_recipe  — Recipe extraction (built-in schema)
  langextract:extract_prep    — Prep list extraction (built-in schema)
  langextract:schemas         — List available built-in schemas
"""

from __future__ import annotations

import json
from typing import Any

from helpers.tool import Tool, Response
from helpers import plugins

from usr.plugins.langextract.helpers.extractor import (
    extract_structured,
    format_extractions_for_agent,
)
from usr.plugins.langextract.helpers.schemas import (
    get_schema,
    list_schemas,
    SCHEMAS,
)


def _get_config(agent) -> dict:
    """Load plugin config with defaults."""
    return plugins.get_plugin_config("langextract", agent=agent) or {}


class LangExtract(Tool):

    async def execute(self, **kwargs) -> Response:
        method = self.method or "extract"

        if method == "extract":
            return await self._extract(**kwargs)
        elif method == "extract_invoice":
            return await self._extract_schema("invoice", **kwargs)
        elif method == "extract_recipe":
            return await self._extract_schema("recipe", **kwargs)
        elif method == "extract_prep":
            return await self._extract_schema("prep_list", **kwargs)
        elif method == "schemas":
            return await self._list_schemas(**kwargs)
        else:
            return Response(
                message=f"Unknown method 'langextract:{method}'. "
                        f"Available: extract, extract_invoice, extract_recipe, extract_prep, schemas",
                break_loop=False,
            )

    # ──────────────────────────────────────────────────────────
    # GENERAL EXTRACTION
    # ──────────────────────────────────────────────────────────
    async def _extract(
        self,
        text: str = "",
        prompt: str = "",
        examples: list[dict[str, Any]] | str = "",
        output_name: str = "extraction",
        **kwargs,
    ) -> Response:
        if not text:
            return self._error("text is required")
        if not prompt:
            return self._error("prompt is required (describe what to extract)")

        # Parse examples if passed as JSON string
        if isinstance(examples, str):
            if examples.strip():
                try:
                    examples = json.loads(examples)
                except json.JSONDecodeError:
                    return self._error("examples must be valid JSON array")
            else:
                examples = []

        config = _get_config(self.agent)

        try:
            result = await extract_structured(
                agent=self.agent,
                text=text,
                prompt_description=prompt,
                examples=examples,
                config=config,
                output_name=output_name,
            )
        except Exception as e:
            return self._error(str(e))

        msg = self.agent.read_prompt(
            "fw.langextract.extract_ok.md",
            result=format_extractions_for_agent(result),
            json_path=result["json_path"],
        )
        return Response(message=msg, break_loop=False)

    # ──────────────────────────────────────────────────────────
    # SCHEMA-BASED EXTRACTION (invoice, recipe, prep)
    # ──────────────────────────────────────────────────────────
    async def _extract_schema(
        self,
        schema_name: str,
        text: str = "",
        output_name: str = "",
        **kwargs,
    ) -> Response:
        if not text:
            return self._error("text is required")

        schema = get_schema(schema_name)
        if not schema:
            return self._error(f"Unknown schema '{schema_name}'. Available: {list_schemas()}")

        config = _get_config(self.agent)
        output_name = output_name or f"{schema_name}_extraction"

        try:
            result = await extract_structured(
                agent=self.agent,
                text=text,
                prompt_description=schema["prompt"],
                examples=schema["examples"],
                config=config,
                output_name=output_name,
            )
        except Exception as e:
            return self._error(str(e))

        msg = self.agent.read_prompt(
            "fw.langextract.extract_ok.md",
            result=format_extractions_for_agent(result),
            json_path=result["json_path"],
        )
        return Response(message=msg, break_loop=False)

    # ──────────────────────────────────────────────────────────
    # LIST SCHEMAS
    # ──────────────────────────────────────────────────────────
    async def _list_schemas(self, **kwargs) -> Response:
        lines = ["Available extraction schemas:"]
        for name, schema in SCHEMAS.items():
            lines.append(f"  • {name}: {schema['prompt'][:80]}...")
        lines.append("")
        lines.append("Use langextract:extract_invoice, langextract:extract_recipe, or langextract:extract_prep")
        return Response(message="\n".join(lines), break_loop=False)

    # ──────────────────────────────────────────────────────────
    # ERROR HELPER
    # ──────────────────────────────────────────────────────────
    def _error(self, error: str) -> Response:
        msg = self.agent.read_prompt(
            "fw.langextract.extract_error.md",
            error=error,
        )
        return Response(message=msg, break_loop=False)
