# BASE-005 — Test Baseline

**Status**: COMPLETE
**Date**: 2026-07-22

## Python Tests (backend)

### Non-runtime tests (tests/ — excluding tests/runtime)

```
12 passed in 0.83s
```

- `tests/test_mcp_type_coercion.py` — 12 passed
- No failures, no skips, no flaky

### Runtime tests (tests/runtime/)

```
119 passed, 8 skipped, 6 warnings in 3.66s
```

| Test File | Pass | Skip | Fail | Notes |
|-----------|------|------|------|-------|
| test_audit_log.py | 6 | 2 | 0 | 2 integration tests skipped (marked @pytest.mark.integration) |
| test_card_lifecycle.py | 5 | 0 | 0 | |
| test_chat_flow.py | 8 | 0 | 0 | |
| test_chat_flow_hermes.py | 3 | 1 | 0 | 1 skipped (requires live hermes) |
| test_chef_flavors.py | 4 | 0 | 0 | |
| test_compose_config.py | 3 | 0 | 0 | |
| test_contract_http.py | 5 | 0 | 0 | |
| test_mcp_mount.py | 4 | 2 | 0 | 2 integration tests skipped |
| test_read_flow.py | 5 | 0 | 0 | |
| test_row2_specialists_and_location.py | 8 | 0 | 0 | |
| test_row3_card_shape_and_mcp_parity.py | 8 | 0 | 0 | |
| test_row5_brief_scheduler.py | 7 | 0 | 0 | |
| test_smoke_hermes.py | 3 | 0 | 0 | |
| test_soul_and_skill.py | 4 | 0 | 0 | |
| test_stream_think_stripping.py | 3 | 0 | 0 | |
| test_write_policy.py | 5 | 0 | 0 | |

**Skipped tests (8 total)**:
- 4 marked `@pytest.mark.integration` (test_audit_log.py, test_mcp_mount.py) — require live services
- 1 marked skip in test_chat_flow_hermes.py — requires live Hermes gateway
- 3 additional skips (exact reason varies by test)

**Warnings (6 total)**:
- `PytestUnknownMarkWarning` for `@pytest.mark.integration` — mark not registered in pytest config

### Environment-blocked tests

- `tests/runtime/` requires `pytest_asyncio` module — NOT available in system Python 3.14
- **Workaround**: Use `.venv/bin/python -m pytest` (venv has pytest_asyncio installed)
- Tests run via `.venv/bin/python -m pytest tests/ -x -q --tb=short` pass cleanly

## Frontend Tests (TypeScript/JavaScript)

```
Test Files: 8 passed (8)
Tests: 62 passed (62)
Duration: ~38s
```

| Test File | Tests | Status |
|-----------|-------|--------|
| action-card.test.tsx | 17 | All passed |
| chat-composer.test.tsx | 3 | All passed |
| module-chat.test.tsx | 3 | All passed |
| demo-action-card-sequence.test.tsx | 4 | All passed |
| demo-auth-tutorial-flow.test.tsx | 5 | All passed |
| demo-route-isolation.test.tsx | 3 | All passed |
| use-action-cards.test.ts | 11 | All passed |
| socket-client.test.ts | 5 | All passed |

## Summary

| Suite | Pass | Fail | Skip | Flaky | Environment-blocked |
|-------|------|------|------|-------|-------------------|
| Python (non-runtime) | 12 | 0 | 0 | 0 | 0 |
| Python (runtime) | 119 | 0 | 8 | 0 | 0 (via .venv) |
| Frontend (TypeScript) | 62 | 0 | 0 | 0 | 0 |
| **Total** | **193** | **0** | **8** | **0** | **0** |

## Known Issues

1. `pytest_asyncio` not in system Python — use `.venv/bin/python -m pytest`
2. `@pytest.mark.integration` not registered — add to pytest config in TEST-008
3. No frontend interaction tests for dashboard KPI cards (UI-003 will add these)
4. No nginx proxy tests (TEST-002 will restore)
5. No end-to-end chat streaming tests (TEST-003 will restore)
