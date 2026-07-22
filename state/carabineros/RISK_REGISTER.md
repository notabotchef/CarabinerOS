# Risk Register

| ID | Risk | Category | Likelihood | Impact | Mitigation | Owner |
|----|------|----------|------------|--------|------------|-------|
| R-001 | OOM on concurrent agent execution | Infrastructure | High | Critical | Small-batch unblock (3-4 at a time); monitor memory; max ~10 concurrent workers | DevOps |
| R-002 | Cloudflare tunnel down (origin cert missing) | Infrastructure | High | High | Use SSH port forwarding as reliable access method; investigate authenticated tunnel | DevOps |
| R-003 | Pending action cards lost on bridge restart (in-memory only) | Reliability | Medium | High | RUN-001: persist action cards to database | Runtime |
| R-004 | Silent Echo mode activation on invalid runtime | Security | Low | High | CFG-003: fail closed on invalid runtime selection | Config |
| R-005 | Duplicate API/MCP layers | Architecture | Medium | Medium | P4: select one canonical API and one MCP surface | API |
| R-006 | Migration head ambiguity (multiple 010_* revisions) | Data | Medium | High | DB-001: audit Alembic revision graph; ensure one valid head | DB |
| R-007 | Dashboard cards static (no expand/collapse) | Product | High | Medium | UI-001: restore interactions; UI-003: add tests | Frontend |
| R-008 | Hardcoded dashboard values not reconciling with pages | Product | Medium | Medium | UI-002: unify data sources | Frontend |
| R-009 | Stale Agent Zero terminology in docs/config | Documentation | High | Low | CFG-001: align all references to Hermes beta runtime | Docs |
| R-010 | Workspace models overlap with operational models | Data | Medium | High | DB-006: write DATA_OWNERSHIP.md; DB-007: decide future | DB |
| R-011 | Dispatcher board-resolution bug (wrong board) | Process | High | High | Use `--board` flag explicitly; verify via lock/PPID inspection | DevOps |
| R-012 | Completion-signal bug (tasks done but board red) | Process | High | High | Manual CLI `complete` until dispatcher fix activated; gateway restart required | DevOps |
