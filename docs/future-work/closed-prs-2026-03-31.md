# Closed PRs — 2026-03-31

All PRs below were closed as part of the project restructure. Code concepts will be rebuilt as proper A0 plugins.

---

## PR #1 — feat: Data Pipeline & Onboarding System

- **Branch**: `feature/data-pipeline-onboarding`
- **Status**: Closed — superseded by project restructure

### Description

Backend `carabiner_data_pipeline` plugin with 4 agent tools:
- `invoice_parser` — multi-format document extraction (PDF, OCR, images)
- `catalog_builder` — vendor catalog with dedup and price history
- `pos_scraper` — POS scraping playbooks for Toast, Square, Lightspeed
- `onboarding_orchestrator` — coordinates the full onboarding flow

API routes: `/api/onboarding`, `/api/vendor-catalog`, `/api/invoices/process`

Frontend: `/onboarding` page with 5-step wizard.

### What's Salvageable for Plugin Restructure

- Invoice parsing logic (PDF, OCR, image extraction) — core algorithms are reusable
- Vendor catalog dedup logic and price history tracking
- POS scraping playbook definitions for Toast, Square, Lightspeed
- 5-step onboarding wizard UI components and flow design
- API route patterns for onboarding and vendor catalog

### Codex P1 Findings

1. **Blueprint never registered** — Flask blueprint is defined but never registered on the app, so all routes return 404
2. **Hardcoded location UUID** — location ID is hardcoded instead of being dynamic per tenant
3. **`status="not_started"` blocks wizard entry** — the onboarding status check prevents users from entering the wizard when status is "not_started", which is the initial state

---

## PR #2 — feat: Onboarding completion guard

- **Branch**: `feat/onboarding-guard`
- **Status**: Closed — superseded by project restructure

### Description

Shell component checks onboarding session on mount. Redirects to `/onboarding` if not completed. Guards the main app behind onboarding completion.

### What's Salvageable for Plugin Restructure

- Guard pattern concept — checking onboarding completion before allowing app access
- Redirect logic and shell-level integration point

### Codex P1 Findings

1. **`/api/onboarding/session` endpoint doesn't exist** — the guard calls an endpoint that was never implemented
2. **`/onboarding` page route missing** — the redirect target page does not exist in the frontend routes

---

## PR #3 — ci: GitHub Actions CI pipeline

- **Branch**: `feat/ci-pipeline`
- **Status**: Closed — superseded by project restructure

### Description

GitHub Actions workflow with 4 parallel jobs:
- `lint-python` (ruff)
- `test-python` (pytest)
- `build-frontend` (Next.js)
- `test-frontend` (vitest)

Triggers on push to `main`, `feature/**` branches, and PRs to `main`.

### What's Salvageable for Plugin Restructure

- CI job structure and parallel execution pattern
- Job definitions for pytest, Next.js build, and vitest
- Trigger configuration for branch patterns

### Codex P1 Findings

1. **ruff check scope too broad** — `ruff check .` runs against the entire repo and will fail on existing violations in upstream Agent Zero code and other directories that shouldn't be linted

---

## PR #4 — feat: Auto-parse invoices on upload

- **Branch**: `feat/invoice-auto-parse`
- **Status**: Closed — superseded by project restructure

### Description

Invoice upload triggers the parser automatically after save. Added `parse_status` field to track parsing state. New `/api/invoices/{id}/parse-status` endpoint for polling parse progress.

### What's Salvageable for Plugin Restructure

- Auto-parse-on-upload pattern — triggering background processing after file save
- `parse_status` field concept for tracking async processing state
- Status polling endpoint pattern

### Codex P1 Findings

1. **Missing Alembic migration for new columns** — `parse_status` and related columns are added to the model but no Alembic migration exists, so the DB schema won't match
2. **`asyncio.create_task` gets garbage collected in WSGIMiddleware context** — background tasks created with `asyncio.create_task` are not retained by any reference, so they can be garbage collected before completion when running under WSGIMiddleware (Flask/WSGI context)

---

## PR #5 — test: Data pipeline test infrastructure

- **Branch**: `feat/test-infrastructure`
- **Status**: Closed — superseded by project restructure

### Description

Test files for the data pipeline:
- `test_document_extractor.py`
- `test_catalog_dedup.py`
- `test_onboarding_api.py`

### What's Salvageable for Plugin Restructure

- Test case designs and assertions — the test logic describes expected behavior even if imports are wrong
- Test patterns for document extraction, catalog dedup, and onboarding API

### Codex P1 Findings

1. **All import paths reference non-existent modules** — every test file imports from `usr.plugins.carabiner_data_pipeline.*` which does not exist in the codebase; all tests fail at import time
