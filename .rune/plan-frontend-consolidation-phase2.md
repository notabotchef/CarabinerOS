# Phase 2 — Native Next.js Settings Page

**Status**: Planned
**Effort**: 2 days
**Depends on**: Phase 1 shipped and validated

## Goal
Replace the Settings iframe with a native React settings page. Users get full keyboard navigation, theme consistency, and deep linking within the CarabinerOS shell.

## Data Flow
```
Settings form → fetch /api/settings (A0 endpoint) → agent-zero:5000
Model config → fetch /api/settings/models → agent-zero:5000
Backup → fetch /api/backup → agent-zero:5000
```

## Key Sections to Migrate
1. Agent config (working directory, agent settings)
2. Model config (chat model, utility model, browser model, embed model)
3. Speech settings (microphone)
4. MCP client (server list, tool inspection, logs)
5. MCP server config
6. A2A connection + server
7. Skills list + import
8. Backup / restore / self-update
9. External API keys, LiteLLM, Secrets, Auth, Tunnel
10. Developer console (WebSocket tester + event console)

## Tasks
- [ ] Audit /api/settings endpoint response shape
- [ ] Create frontend/src/app/settings/ directory with sub-pages
- [ ] Create frontend/src/app/settings/agent/page.tsx
- [ ] Create frontend/src/app/settings/models/page.tsx
- [ ] Create frontend/src/app/settings/mcp/page.tsx
- [ ] Create frontend/src/app/settings/backup/page.tsx
- [ ] Create frontend/src/app/settings/external/page.tsx
- [ ] Create shared SettingsSidebar component for settings sub-nav
- [ ] Remove settings iframe page (replace with native)

## Acceptance Criteria
- All settings sections render and save correctly
- No regression in webui/ functionality (webui/ still works at /a0/)
- Theme (dark/light) consistent with CarabinerOS design tokens
- TypeScript compiles: cd frontend && pnpm build
