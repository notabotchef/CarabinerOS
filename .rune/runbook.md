# .rune/runbook.md

## Goal
Add voice recognition (STT) and text-to-speech (TTS) to the main chat UI. Frontend-only + enabling preload. Phase 3 (mobile PWA) is planned but not executed.

## Plan
plan-voice-chat.md

## Quality Rules
- max_severity: MEDIUM
- require_new_tests: false  # frontend hooks — manual testing per plan
- coverage_floor: none
- e2e_on_complete: false  # manual integration test per plan

## Escalation
- on_blocked: pause
- warn_threshold: 3
- max_retries_per_phase: 2

## Session Strategy
- phases_per_session: 2  # Phase 1 + Phase 2 (Phase 3 is future TODO)
- commit_per_phase: true

## Completion Criteria
- all_phases_complete: true  # Phase 1 + 2 only (Phase 3 is deferred)
- e2e_pass: false  # manual
- final_review_clean: true

## Pre-existing Issues
- Lint error: chat-composer.tsx:118 setState in effect (pre-existing, not introduced by this work)
- 11 lint warnings (pre-existing)
- Python venv not available for pytest
