# Phase 5 — Archive webui/

**Status**: Planned
**Effort**: 0.5 day
**Depends on**: Phases 2, 3, 4 shipped and validated in production

## Goal
Remove the webui/ Alpine.js application from the active stack. The nginx /a0/ route is retired. CarabinerOS has one unified frontend.

## Tasks
- [ ] Verify all webui/ features are covered by native Next.js pages
- [ ] Remove /a0/ location block from nginx.dev.conf
- [ ] Update docker-compose.dev.yml if webui has dedicated volume mounts
- [ ] Move webui/ to webui/_archived/ or delete entirely (git history preserves it)
- [ ] Update CLAUDE.md to remove webui/ references
- [ ] Update nginx.dev.conf to remove /a0/ block
- [ ] Run full QA pass on all features

## Acceptance Criteria
- No user-facing feature regression vs. webui/ functionality
- nginx.dev.conf has no /a0/ block
- CarabinerOS serves exclusively from Next.js on /
- Docker build completes without errors
- TypeScript compiles: cd frontend && pnpm build

## Risks
- Some webui/ features may have undocumented API contracts — discover in Phase 2-4
- Agent Zero upstream updates may change webui/ features — track upstream changelog
- Archiving too early loses the reference — keep webui/ until Phase 4 is QA'd
