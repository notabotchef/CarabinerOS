# Progress

## [2026-03-21 19:30] Session Summary

**Completed This Session:**
- [x] Hydration mismatch + script tag warnings fixed (chat-composer, theme-script)
- [x] Chat conversation loading confirmed working
- [x] Table data cards — tables render as standalone briefing-style cards outside chat bubbles
- [x] "Daily Briefing" renamed to "Daily Brief"
- [x] Full system test (5 prompts) with live Docker log monitoring
- [x] Bug report cross-referenced with backend logs — 16 bugs identified and prioritized
- [x] **C1**: MCP carabiner_db tools now available in Docker (env inheritance fix)
- [x] **C2**: Action card emission pipeline fixed (sio injection + JSON extraction + Expo prompt)
- [x] **C3**: invoice_tool schema mismatch fixed (Alembic migration 008)
- [x] **C4**: Homepage always creates fresh chat context
- [x] **H2**: Expo whispering streams steps in real-time
- [x] **H4**: ipython installed in Docker for code_execution_tool
- [x] **M2**: Duplicate message guard (sendingRef + 2s dedup)

**In Progress:**
- [ ] Docker rebuild with all fixes — building now
- [ ] Retest all 5 prompts on Docker after rebuild

**Remaining Bugs (not yet fixed):**
- H1: 5-min delay on first message (VectorDB init — needs profiling)
- H3: Table data cards need Docker rebuild to take effect (in progress)
- H5: Closing pgAdmin stopped cOS streaming (Docker network investigation)
- H6: Ollama stalls under concurrent load (inference config)
- M1: Tool-not-found dumps 750+ line catalog (A0 core — overlay pattern)
- M3: Quirky loading notes while A0 thinks (frontend UX)
- M4: Sparse seed data — only 5 inventory items

**Next:**
- Verify all fixes on Docker (port 8080)
- Rerun the 5 test prompts
- Verify action cards appear in notification panel
- Verify whispering shows A0 steps in real-time
- Verify table data cards break out of chat bubble
