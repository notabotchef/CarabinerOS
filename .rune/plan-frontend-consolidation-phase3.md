# Phase 3 — Native Plugin Management

**Status**: Planned
**Effort**: 1 day
**Depends on**: Phase 2 shipped

## Goal
Replace the Plugins iframe with a native React plugin management page. Operators can enable/disable plugins, view plugin info, and configure plugin settings from within the CarabinerOS shell.

## Data Flow
```
Plugin list → fetch /api/plugins (A0 endpoint)
Plugin toggle → POST /api/plugins/toggle
Plugin settings → fetch /api/plugins/{name}/settings
Plugin execute → POST /api/plugins/{name}/execute
```

## Key Features to Migrate
1. Plugin list with enable/disable toggles
2. Plugin info modal (name, description, version, author)
3. Plugin configs (per-plugin settings forms)
4. Plugin execute modal (run plugin manually)
5. Plugin advanced toggle (show experimental plugins)

## Tasks
- [ ] Audit /api/plugins endpoint response shape
- [ ] Create frontend/src/app/plugins/page.tsx (native, not iframe)
- [ ] Create PluginCard component
- [ ] Create PluginToggle component
- [ ] Create PluginConfigPanel component
- [ ] Create PluginInfoModal component
- [ ] Wire up to /api/plugins endpoints
- [ ] Remove plugins iframe (replace with native)

## Acceptance Criteria
- Plugin list loads from API
- Enable/disable toggles work and persist
- Plugin info modal renders correctly
- Plugin configs render and save
- TypeScript compiles: cd frontend && pnpm build
