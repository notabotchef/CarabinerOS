# Phase 4 — Onboarding + Model Config Migration

**Status**: Planned
**Effort**: 2 days
**Depends on**: Phase 3 shipped

## Goal
Migrate the onboarding (welcome screen) and model configuration flows into Next.js. New users get a native onboarding experience without seeing the raw Agent Zero UI.

## Data Flow
```
Onboarding → check /api/onboarding/status → redirect to /onboarding if incomplete
Model config → /api/settings/models (GET + POST)
Provider config → /api/settings/providers
```

## Key Features to Migrate
1. Welcome screen (first-run setup wizard)
2. Model provider selection (OpenAI, Anthropic, Ollama, LiteLLM, etc.)
3. Chat model configuration (model name, API key, context length)
4. Utility model configuration
5. Browser model configuration
6. Embed model configuration
7. Speech model configuration

## Tasks
- [ ] Create frontend/src/app/onboarding/page.tsx (multi-step wizard)
- [ ] Create ModelProviderSelector component
- [ ] Create ModelConfigForm component (shared, reusable per model type)
- [ ] Create onboarding middleware to detect first-run state
- [ ] Wire model config forms into /settings/models (Phase 2 page)
- [ ] Test full onboarding flow with fresh state

## Acceptance Criteria
- New user lands on /onboarding on first run
- Model selection + API key entry works end-to-end
- User can skip onboarding and configure models later from /settings
- Existing users skip onboarding (status check)
- TypeScript compiles: cd frontend && pnpm build
