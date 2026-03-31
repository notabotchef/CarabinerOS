# Frontend Consolidation — Master Plan

**Goal**: Merge webui/ (Alpine.js) features into frontend/ (Next.js) so CarabinerOS has one UI shell.
**Status**: Phase 1 (quick wins) in progress.

## Gap Matrix

| Feature | webui/ | frontend/ | Priority |
|---------|--------|-----------|----------|
| Chat UI | Yes (Alpine, full) | Yes (React, native) | Overlap — keep Next.js |
| Settings (agent/model/workdir) | Yes | No | Phase 2 |
| Settings (MCP, A2A, skills) | Yes | No | Phase 2 |
| Settings (backup/restore, secrets, tunnel) | Yes | No | Phase 2 |
| Settings (developer console) | Yes | No | Phase 4 |
| Plugins (list, toggle, execute, configs) | Yes | No | Phase 3 |
| Projects (create, edit, list) | Yes | No | Post-MVP |
| Notifications (toast, modal) | Yes | Yes (action cards) | Overlap — keep Next.js |
| Sync status | Yes | Partial (socket) | Post-MVP |
| Restaurant modules (orders, inventory…) | No | Yes (10 modules) | Next.js only |
| Action cards / KDS | No | Yes | Next.js only |

## Phases

| Phase | Deliverable | Effort |
|-------|-------------|--------|
| 1 | iframe bridge pages for Settings + Plugins | 0.5 day |
| 2 | Native Next.js Settings page | 2 days |
| 3 | Native Next.js Plugin management | 1 day |
| 4 | Onboarding + model config migration | 2 days |
| 5 | Archive webui/ | 0.5 day |

## Key Constraints
- DO NOT modify webui/ files — bridge only
- DO NOT touch frontend/package.json, frontend/vitest.config.ts, frontend/src/__tests__/
- iframe must respect Shell layout (sidebar + TopBar stay visible)
- /a0/ nginx route already proxies to agent-zero:5000 — iframe src = /a0/
