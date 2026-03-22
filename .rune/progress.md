# Progress

## [2026-03-21 22:00] Session 5 Summary — First Real Trial of CarabinerOS v3

**Completed:**
- [x] Hydration mismatch + script tag warnings fixed
- [x] Chat conversation loading confirmed working
- [x] Table data cards — briefing-style standalone cards outside chat bubbles
- [x] "Daily Briefing" → "Daily Brief"
- [x] Full system test (5 prompts) with live Docker log monitoring
- [x] Bug report: 16 bugs identified, cross-referenced with backend logs
- [x] **C1**: MCP carabiner_db tools available in Docker (env inheritance)
- [x] **C2**: Action card emission pipeline (sio injection + JSON extraction + Expo prompt)
- [x] **C3**: invoice_tool schema fix (Alembic migration 008)
- [x] **C4**: Homepage always creates fresh chat context
- [x] **H2**: Expo whispering streams steps in real-time
- [x] **H4**: ipython installed in Docker for code_execution_tool
- [x] **M2**: Duplicate message guard (sendingRef + 2s dedup)
- [x] Grey bar removed from expo ticket
- [x] MCP location_id auto-resolve for all create tools
- [x] Codex proxy plugin installed — GPT-5.3 brain for A0
- [x] Rune kit framework research — full capability documented
- [x] Architectural decision: notify_user → action cards bridge

**Stress Test Results (5 concurrent prompts with GPT-5.3 Codex):**
- [x] Frontend handled all 5 sessions — 43 requests, all 200s, 18-26ms
- [x] GPT-5.3 processes prompts in true parallel (interleaved streaming)
- [x] A0 self-healed database (started PostgreSQL when down)
- [x] Proper delegation: GM → Executive Chef with structured 7-point brief
- [x] Data-first: Executive Chef ran 3 tools before answering (food_cost, menu, reporting)
- [x] Read tools all work (inventory_list, orders_list, invoices_list, food_cost, menu, reporting)
- [ ] Write tools ALL FAILED — two bugs:
  - Type serialization: MCP binds all values as VARCHAR (breaks NUMERIC/INTEGER columns)
  - UUID double-wrapping: db_mutate wraps location_id as `UUID('...')` string repr
  - Esteban suspects the Codex proxy response normalization is mangling types
- [ ] No action cards emitted (writes must succeed first)
- [ ] Duplicate API fetches: each dashboard page fires 2x same requests (React StrictMode?)

**A0 27B vs GPT-5.3 Comparison:**
- 27B: 27+ LLM calls, installed PostgreSQL from scratch, took 30+ minutes, never completed order
- GPT-5.3: 6 LLM turns, proper delegation, data-grounded response, completed in seconds
- GPT-5.3 composed structured subordinate briefs without prompting
- GPT-5.3 tried 3 different write paths when first failed (create → mutate → batch)

**In Progress:**
- [ ] MCP write tools broken (type serialization + UUID wrapping)
- [ ] Codex patch not persisted in Dockerfile (lost on container restart)
- [ ] Migration 009 not yet run (fixed version on worktree branch)

**Blocked:**
- [ ] Action cards — blocked by write tools not working
- [ ] Expo filtering — design ready (log analysis complete), implementation not started

**Next Session Should:**
1. Fix MCP write serialization (may be Codex proxy response normalization issue)
2. Bake Codex patch + chpasswd fix into Dockerfile.agent-zero
3. Run migration 009 — cOS Test Kitchen single-location seed data
4. Build notify_user → action cards bridge extension
5. Implement expo filtering (add "mcp" to TICKET_LOG_TYPES, filter "Calling LLM...", kitchen-language tool names)
