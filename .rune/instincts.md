# Instincts

## [2026-04-01] Instinct: A0 self_update_manager hardcodes port 80

**Trigger:** Setting WEB_UI_PORT or WEB_UI_HOST env vars for A0 in Docker
**Action:** Don't bother — self_update_manager passes `--port=80 --host=0.0.0.0` which overrides env vars. Map to port 80 in compose.
**Confidence:** 0.9
**Evidence:** Discovered when compose mapped 5050:5000 but A0 was unreachable. Traced through self_update_manager.py line 694.

## [2026-04-01] Instinct: A0 setup_venv.sh uses bash source, not sh

**Trigger:** Running `RUN . /ins/setup_venv.sh` in a Dockerfile
**Action:** Use `RUN bash -c 'source /opt/venv-a0/bin/activate && ...'` instead. Docker RUN uses /bin/sh which doesn't support `source`.
**Confidence:** 0.8
**Evidence:** Build failed with "source: not found" until switched to explicit bash -c.

## [2026-04-01] Instinct: Never init_db() on a different event loop

**Trigger:** Creating a global async DB engine in a startup extension or background thread
**Action:** Don't store a global engine. Let per-request fallback create engines. Different event loops = "attached to a different loop" RuntimeError.
**Confidence:** 0.9
**Evidence:** Intermittent 500s on API endpoints. Some requests worked (hit fallback), others failed (hit stale global engine). Removing init_db() from startup fixed all.

## [2026-04-01] Instinct: Blame the prompt, not the model

**Trigger:** A capable LLM produces malformed tool calls or ignores instructions
**Action:** Check the system prompt and agent config FIRST. Don't suggest switching models. Diagnose: are the prompts referencing stale tools? Wrong format examples? Missing instructions? The model follows what it's told.
**Confidence:** 0.9
**Evidence:** Qwen3 was blamed for bad tool calls. Real cause: agent prompts still referenced 63 deleted MCP tools. Once prompts were updated with correct CLI examples, tool calling worked. Would have sent user to pay for unnecessary API calls.

## [2026-04-01] Instinct: A0 API dispatch caches handler classes

**Trigger:** Modifying handler code in volume-mounted files and expecting changes to take effect
**Action:** Restart the A0 container. A0 caches loaded ApiHandler classes in memory.
**Confidence:** 0.7
**Evidence:** Changed RecipeOut→RecipeDetailOut in _a0_handlers.py but recipe detail still returned 0 components until restart.
