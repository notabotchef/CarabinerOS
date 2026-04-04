"""
Core extraction engine wrapping google/langextract.
Handles model resolution, extraction execution, and result formatting.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, TYPE_CHECKING

import langextract as lx

if TYPE_CHECKING:
    from agent import Agent

from helpers import files
from helpers.print_style import PrintStyle


def _resolve_model_id(agent: Agent, config: dict) -> str:
    """Resolve which model to use for extraction."""
    configured = config.get("model_id", "")
    if configured:
        return configured
    # Fall back to agent's chat model name
    try:
        return agent.config.chat_model.name
    except Exception:
        return "gemini-2.5-flash"


def _needs_fence(model_id: str, config: dict) -> bool:
    """Determine if fence_output is needed (required for OpenAI)."""
    fence = config.get("fence_output")
    if fence is not None:
        return bool(fence)
    return "gpt" in model_id.lower() or "openai" in model_id.lower()


async def extract_structured(
    agent: Agent,
    text: str,
    prompt_description: str,
    examples: list[dict[str, Any]],
    config: dict,
    output_name: str = "extraction",
) -> dict[str, Any]:
    """
    Run langextract on text with given prompt and examples.

    Args:
        agent: The A0 agent instance
        text: Raw text to extract from
        prompt_description: Natural language description of what to extract
        examples: List of few-shot example dicts with 'text' and 'extractions' keys
        config: Plugin config dict
        output_name: Base name for output files

    Returns:
        Dict with 'extractions', 'document_text', 'visualization_path' keys
    """
    model_id = _resolve_model_id(agent, config)
    fence_output = _needs_fence(model_id, config)
    passes = int(config.get("extraction_passes", 1))
    workers = int(config.get("max_workers", 5))
    char_buffer = int(config.get("max_char_buffer", 2000))

    PrintStyle.standard(f"LangExtract: using model={model_id}, passes={passes}, workers={workers}")

    # Build langextract Example objects
    lx_examples = []
    for ex in examples:
        extractions = []
        for ext in ex.get("extractions", []):
            extractions.append(
                lx.data.Extraction(
                    extraction_class=ext.get("extraction_class", "item"),
                    extraction_text=ext.get("extraction_text", ""),
                    attributes=ext.get("attributes", {}),
                )
            )
        lx_examples.append(
            lx.data.ExampleData(
                text=ex.get("text", ""),
                extractions=extractions,
            )
        )

    # Run extraction
    try:
        result = lx.extract(
            text_or_documents=text,
            prompt_description=prompt_description,
            examples=lx_examples,
            model_id=model_id,
            extraction_passes=passes,
            max_workers=workers,
            max_char_buffer=char_buffer,
            fence_output=fence_output,
        )
    except Exception as e:
        raise RuntimeError(f"LangExtract extraction failed: {e}") from e

    # Format extractions into plain dicts
    extractions = []
    if hasattr(result, "extractions"):
        for ext in result.extractions:
            entry = {
                "class": ext.extraction_class,
                "text": ext.extraction_text,
                "attributes": ext.attributes,
            }
            if hasattr(ext, "char_interval") and ext.char_interval is not None:
                entry["char_interval"] = [ext.char_interval.start, ext.char_interval.end]
            else:
                entry["grounded"] = False
            extractions.append(entry)

    # Save outputs
    output_dir = config.get("output_dir", "extractions")
    work_dir = files.get_abs_path("usr", "workdir", output_dir)
    os.makedirs(work_dir, exist_ok=True)

    # Save JSON
    json_path = os.path.join(work_dir, f"{output_name}.json")
    with open(json_path, "w") as f:
        json.dump({"extractions": extractions, "model": model_id, "passes": passes}, f, indent=2)

    # Save visualization
    viz_path = None
    if config.get("save_visualization", True):
        try:
            jsonl_path = os.path.join(work_dir, f"{output_name}.jsonl")
            lx.io.save_annotated_documents([result], output_name=jsonl_path)
            html_content = lx.visualize(jsonl_path)
            viz_path = os.path.join(work_dir, f"{output_name}.html")
            with open(viz_path, "w") as f:
                f.write(html_content)
            PrintStyle.standard(f"LangExtract: visualization saved to {viz_path}")
        except Exception as e:
            PrintStyle.warning(f"LangExtract: visualization failed: {e}")

    return {
        "extractions": extractions,
        "json_path": json_path,
        "visualization_path": viz_path,
        "model": model_id,
        "count": len(extractions),
    }


def format_extractions_for_agent(result: dict[str, Any]) -> str:
    """Format extraction results as readable text for the agent."""
    lines = [f"Extracted {result['count']} items using {result['model']}:"]
    lines.append(f"JSON saved: {result['json_path']}")
    if result.get("visualization_path"):
        lines.append(f"Visualization: {result['visualization_path']}")
    lines.append("")

    for i, ext in enumerate(result["extractions"], 1):
        grounded = ext.get("grounded", True) is not False
        ground_mark = "✓" if grounded else "⚠ ungrounded"
        lines.append(f"  [{i}] {ext['class']}: \"{ext['text']}\" ({ground_mark})")
        if ext.get("attributes"):
            for k, v in ext["attributes"].items():
                lines.append(f"      {k}: {v}")
    return "\n".join(lines)
