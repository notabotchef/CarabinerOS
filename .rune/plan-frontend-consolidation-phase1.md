# Phase 1 — Quick Wins: iframe Bridge Pages

**Status**: In progress
**Effort**: 0.5 day

## Goal
Expose Settings and Plugins to users via the Next.js shell without rewriting anything. The webui/ at /a0/ becomes an embedded panel.

## Data Flow
```
User clicks "Settings" in sidebar
  → Next.js router pushes /settings
  → page.tsx renders <iframe src="/a0/" />
  → nginx proxies /a0/ → agent-zero:5000/
  → webui loads inside iframe
```

## Tasks
- [x] Create frontend/src/app/settings/page.tsx (iframe bridge)
- [x] Create frontend/src/app/plugins/page.tsx (iframe bridge)
- [x] Add Settings + Plugins nav items to app-sidebar.tsx
- [ ] Verify nginx X-Frame-Options allows same-origin iframe (check headers)
- [x] Create .rune/plan-frontend-consolidation.md (master plan)
- [x] Create phase plan files (this file + phases 2-5)

## Acceptance Criteria
- /settings renders the webui inside the shell without white flash
- /plugins renders the webui inside the shell
- Sidebar shows Settings + Plugins links with correct active state
- TypeScript compiles: cd frontend && pnpm build
- No modifications to webui/ files

## nginx X-Frame-Options Note
The /a0/ block in nginx.dev.conf does not set X-Frame-Options. Agent Zero's
Flask app may set it. If iframe shows blank, add to nginx /a0/ block:
  proxy_hide_header X-Frame-Options;
  add_header X-Frame-Options "SAMEORIGIN";
