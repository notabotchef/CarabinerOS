# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This repo contains two directories:
- `AgentCarabinerOS/` — the active production engine (primary codebase)
- `agent-zero-official/` — upstream Agent Zero framework (reference/upstream)

All development work happens in `AgentCarabinerOS/`.

## Commands

From `AgentCarabinerOS/`:

```bash
# Run locally (development)
python run_ui.py

# Run via Docker (preferred for full environment)
docker compose -f docker/run/docker-compose.yml up --build

# Run tests
pytest
pytest -v
pytest -k "test_websocket"        # filter by pattern
pytest --asyncio-mode=auto        # for async tests
```

No linter is configured in the project.

## Architecture

**Entry point:** `run_ui.py` — Flask/Uvicorn ASGI server with python-socketio for WebSocket support.

**Core runtime:**
- `agent.py` — `AgentContext` (session/conversation container) and `Agent` (execution loop). Each Agent has a number; Agent 0 is the primary, can spawn subordinate agents.
- `models.py` — LLM integration via LiteLLM (unified interface across providers).
- `python/tools/` — 27 built-in tools (code execution, browser, memory, search, scheduler, etc.). Tools inherit from a `Tool` base class and are discovered via reflection.
- `python/helpers/` — 80+ helper modules for files, history, memory, WebSocket management, MCP, settings, etc.
- `python/api/` — 76+ REST API endpoints for chat management, file ops, agent control, settings, etc.

**Prompt-driven behavior:**
- `prompts/` — All agent behavior is defined in `.md` prompt files. System prompts, tool guides, and communication templates are all fully customizable here.
- `agents/` — Agent profiles (default, developer, hacker, researcher) with role-specific prompt overrides.

**Frontend:**
- `webui/` — Vanilla JavaScript, no build tools. Served as static files by Flask. Real-time updates via WebSocket.

**Key patterns:**
- Tool extraction: LLM responses contain JSON tool calls that `python/helpers/extract_tools.py` parses (with dirty JSON handling).
- Memory system: Persistent conversation memory with embedding-based semantic search (FAISS + sentence-transformers).
- Project isolation: Each project has its own files, instructions, secrets, memory, and knowledge to prevent context bleed.
- MCP integration: Agent can act as an MCP server and consume external MCP servers as tools (`python/helpers/mcp_handler.py`).
- A2A protocol: Agent-to-agent communication via `python/helpers/fasta2a_client.py` / `fasta2a_server.py`.
- Skills system: SKILL.md-compatible portable capabilities, dynamically loaded based on task relevance.

**Configuration:**
- `usr/` — Runtime data: settings, chats, scheduler state, memory.
- Environment variables with `A0_SET_*` prefix override settings for deployment automation.
- `FLASK_SECRET_KEY` required for session security.

## Carabiner-Specific Additions

Restaurant operations domain logic lives in:
- `python/helpers/carabiner_connectors.py`
- `python/helpers/carabiner_data.py`
- `python/tools/restaurant_ops.py`

## Naming Note

The codebase inherits "Agent Zero" naming in some internal files and docs. This is upstream naming being consolidated. The product is CarabinerOS.
