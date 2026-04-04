# Operations Documentation

## Overview

Multi-agent organization structure, deployment guides, and operational procedures for CarabinerOS platform management.

## Contents

### 🤖 [Agents](agents/)

#### Paperclip Organization Structure
**CEO (Opus) → CTO (Sonnet) → Hermes Engineer (coding agent)**

Multi-agent organization running at localhost:3100 with the following roles:

- **[CEO Agent](agents/paperclip-company/agents/ceo/)** — Strategic oversight and decision making
- **[CTO Agent](agents/paperclip-company/agents/cto/)** — Technical architecture and system design  
- **[Content Producer Agent](agents/paperclip-company/agents/content-producer/)** — Daily content pipeline for X and Threads
- **[Market Researcher Agent](agents/paperclip-company/agents/market-researcher/)** — Beta restaurant list and market analysis
- **[Hermes Engineer Agent](agents/paperclip-company/agents/hermes-engineer/)** — Primary coding agent for implementation

#### Agent Components
- **[AGENTS.components.md](agents/AGENTS.components.md)** — UI component specifications
- **[AGENTS.modals.md](agents/AGENTS.modals.md)** — Modal dialog specifications  
- **[AGENTS.plugins.md](agents/AGENTS.plugins.md)** — Plugin architecture for agents

### 🚀 [Deployment](deployment/)
*Content to be organized here*

### 🛠️ [Troubleshooting](troubleshooting.md)
*To be created*

## Current Operations Status

**✅ Active Agents:**
- Hermes Engineer: End-to-end chat (A0 calling CLI)
- Content Producer: Daily posting pipeline (X and Threads, food science content)
- Market Researcher: Beta restaurant list compilation

**📋 Agent Priorities:**
1. **Hermes Engineer** — End-to-end chat integration
2. **Content Producer** — Daily content posting automation
3. **Market Researcher** — NYC beta restaurant targeting
4. **Next:** Toast integration, onboarding flow, personalized demo generator

## Paperclip Configuration

**Location:** `~/Projects/carabiner-os/docs/05-operations/agents/paperclip-company/`
**Config File:** `.paperclip.yaml`
**Access:** localhost:3100

**Key Context for All Agents:**
- Codebase: ~/Projects/carabiner-os
- Stack: Next.js 16 + Python/Flask + PostgreSQL + Agent Zero
- Always read CLAUDE.md and DESIGN_TOKENS.md before code work
- Read docs/MiroShark/ and docs/simulations/ for market intelligence
- Check .rune/progress.md for current build status

## Content Pipeline Operations

**Content Producer Agent** manages:
- Daily posts to X and Threads
- Food science content focus
- NotebookLM MCP CLI integration at ~/.local/share/uv/tools/notebooklm-mcp-cli/
- OPERATIONS.md reference: /Users/estebannunez/Documents/carabinerOS/OPERATIONS.md

## Model Configuration

**Local Models:** 
- Ollama localhost:11434 (qwen3.5:4b, qwen3.5:9b, qwen3:14b)
- llama-server at /opt/homebrew/bin/llama-server
- Qwen3.5-27B Q4_K_M at ~/Models/Qwen3.5-27B.Q4_K_M.gguf

**Personality Insights:**
- Claude = mechanics-driven (long checklists, step-by-step)
- GPT = principle-driven (concise goals, XML structure)  
- Qwen3.5 (local) behaves Claude-like — use detailed instruction prompts