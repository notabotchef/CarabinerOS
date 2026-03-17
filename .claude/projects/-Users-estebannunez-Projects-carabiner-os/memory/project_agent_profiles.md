---
name: CarabinerOS Expert Agent Profiles
description: Five expert agent profiles created in AgentCarabinerOS/agents/ - memory_expert, tools_expert, orchestrator, infrastructure, product_lead
type: project
---

Created 5 new agent profiles in `AgentCarabinerOS/agents/`:

1. **memory_expert** - Memory & Knowledge Architect (FAISS, embeddings, semantic search, knowledge lifecycle)
2. **tools_expert** - Execution Specialist (code execution, browser automation, search, document queries)
3. **orchestrator** - Operations Orchestrator (multi-agent coordination, task decomposition, scheduling, cross-location)
4. **infrastructure** - Infrastructure Engineer (MCP, A2A, REST APIs, WebSocket, Docker, LiteLLM)
5. **product_lead** - Product Lead (restaurant domain expert translating operator pain into product strategy)

**Why:** User needed specialized agents covering Agent Zero core functionalities + a restaurant-native Product Lead for CarabinerOS.

**How to apply:** These profiles are auto-discovered by `python/helpers/subagents.py` scanning `agents/` subdirectories for `agent.json`. They're selectable via the `profile` arg in `call_subordinate` tool.
