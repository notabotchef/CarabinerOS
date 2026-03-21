# Progress

## [2026-03-21 17:45] Session Summary

**Completed:**
- [x] Markdown table styling for CarabinerOS chat (remark-gfm + CSS)
- [x] Next.js API proxy rewrite for `/api/*` routes
- [x] MCP carabiner_db connection fix (python path + DB host)
- [x] Structural gaps fix (pinned deps, portable MCP config, settings.local.json pattern)
- [x] Action Cards v0.1 backend wiring (card_commit, card_dismiss, card_message handlers)
- [x] Git cleanup (8 stale branches deleted, main consolidated)
- [x] Docker rebuild with all changes

**In Progress:**
- [ ] Action Cards end-to-end testing — backend handlers stubbed, need real A0 routing for card_message
- [ ] CarabinerOS chat not loading A0 conversations (sidebar shows "No conversations yet" in dev mode; untested in Docker)

**Blocked:**
- [ ] None currently

**Next Session Should:**
- Verify action cards work end-to-end on Docker (port 8080)
- Test CarabinerOS chat conversation loading on Docker
- Verify markdown tables render in CarabinerOS chat (send a query that returns tabular data)
- If card_message needs real A0 routing (not just stub reply), implement that
