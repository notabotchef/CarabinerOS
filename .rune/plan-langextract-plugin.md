# Plan: LangExtract Plugin for Agent Zero

## Goal
Build `a0-langextract` — an Agent Zero plugin that wraps google/langextract for structured document extraction. Primary use: parsing invoices, recipes, prep lists, and delivery tickets in CarabinerOS.

## Status Tracker

| # | Phase | Status | Branch |
|---|-------|--------|--------|
| 1 | Scaffold + install | ⬚ Pending | feat/langextract-plugin |
| 2 | Core extraction engine | ⬚ Pending | feat/langextract-plugin |
| 3 | A0 Tool + prompts | ⬚ Pending | feat/langextract-plugin |
| 4 | Restaurant schemas | ⬚ Pending | feat/langextract-plugin |
| 5 | Testing | ⬚ Pending | feat/langextract-plugin |
| 6 | GitHub repo + README | ⬚ Pending | main |

## Key Decisions
- Plugin name: `langextract` (dir in usr/plugins/)
- Tool name: `langextract` with methods: `:extract`, `:extract_invoice`, `:extract_recipe`
- Uses agent's existing LLM config via LiteLLM (no separate API key needed for OpenAI/Ollama)
- Falls back to LANGEXTRACT_API_KEY env var for Gemini
- Restaurant schemas ship as built-in few-shot examples
- Output: structured JSON + optional HTML visualization saved to work dir

## Architecture
```
usr/plugins/langextract/
  plugin.yaml
  default_config.yaml
  README.md
  LICENSE
  install.sh / Makefile
  helpers/
    __init__.py
    extractor.py          # Core wrapper around langextract
    schemas.py            # Restaurant-specific extraction schemas
  tools/
    langextract_tool.py   # A0 Tool class
  prompts/
    agent.system.tool.langextract.md
    fw.langextract.extract_ok.md
    fw.langextract.extract_error.md
  webui/
    thumbnail.png
    config.html
  extensions/
    .gitkeep
  tests/
    test_extractor.py
    fixtures/
      sample_invoice.txt
      sample_recipe.txt
```

## Risks
- langextract requires an LLM — cost per extraction. Mitigated: use agent's existing models
- Large documents may be slow. Mitigated: chunking + parallel built into langextract
- Model compatibility varies. Mitigated: support Gemini, OpenAI, Ollama via config

## Outcome Block
**What Was Planned:** Full A0 plugin wrapping google/langextract with restaurant-specific schemas
**Immediate Next Action:** Execute Phase 1 — scaffold plugin directory structure
**How to Measure:**
| Check | Command |
|-------|---------|
| Plugin dir exists | `ls usr/plugins/langextract/plugin.yaml` |
| Tool loads | A0 recognizes `langextract:extract` tool |
| Invoice extraction works | Test with sample invoice text |
