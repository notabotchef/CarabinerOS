# Phase 5 Debug Notes — First E2E Test

## What Works
- GM receives user message and correctly identifies which specialist to delegate to
- GM calls `call_subordinate("agm")` with a detailed task description
- AGM agent spawns with correct profile and tool access
- AGM reasons through the problem, calls `inventory_tool`, reads from PostgreSQL
- Response flows back through the full pipeline to the frontend chat
- Conversation persists in agent-zero/usr/chats/
- Delete button clears agent context

## Issues Found

### 1. Agent Names in UI
- Agent 1 shows as "A1" instead of role name (AGM, Sous Chef, etc.)
- Need to map agent numbers to profile names in the response cleaning

### 2. Status Pill
- Stuck on "Analyzing your request" during most of the processing
- Reasoning stream chunks (extended thinking) not forwarded to status pill
- Need to capture `reasoning_stream_chunk` log entries and emit status updates

### 3. Response Speed
- 9B model takes long on multi-step reasoning prompts
- Extended thinking produces many tokens before the agent acts
- Consider: shorter system prompts, limit reasoning tokens, or faster model

### 4. Health Check Log Noise
- Docker healthcheck every 10s floods the logs
- Fixed: suppressed uvicorn.access logs (committed but needs container restart)

### 5. Memory Consolidation Errors
- "Memory consolidation timeout for area fragments" appears periodically
- Memory disabled in settings.json for now
- Need to properly configure or handle gracefully

### 6. Response Not Streaming
- Response arrives as one block then fake-streams word-by-word
- Log polling captures status updates but not the response stream itself
- Need to hook into `response_stream_chunk` extension or find streaming attribute

### 7. Tool Prompt Files Missing
- AGM doesn't know exact tool signatures (methods, args)
- Need tool prompt files: `agent.system.tool.order_tool.md`, etc.
- These tell the LLM how to call each tool with correct arguments

### 8. Markdown Formatting
- Bullet lists sometimes render without proper spacing
- Newlines from agent response may need normalization
