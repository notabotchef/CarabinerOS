# BASE-005 — Test Baseline

**Status**: COMPLETE (re-recorded)
**Date**: 2026-07-22 (post t_7be0fd79 MCP-mount fix)
**Workspace**: /root/carabineros
**Recorder**: agency-router, run id 34

This baseline was recorded AFTER `t_7be0fd79` (FIX-MCP-MOUNT-REGRESSION) and is
intended to supersede the prior baseline that claimed 119 passed / 8 skipped in
`tests/runtime/`. That prior number is no longer accurate: the MCP-mount
regression has come back, and `tests/test_dashboard.py` (the source of the
historical dashboard failure cluster) has been removed from the tree.

Raw command outputs are saved at:
- `/tmp/baseline_python_nonruntime.txt`
- `/tmp/baseline_python_runtime.txt`
- `/tmp/baseline_frontend.txt`
- `/tmp/baseline_lint.txt`
- `/tmp/baseline_compose.txt`

## Python Tests (backend)

### Non-runtime tests (`tests/` minus `tests/runtime/`)

Command: `.venv/bin/python -m pytest tests/ --ignore=tests/runtime -q`

```
12 passed in 0.71s
```

| Test File                  | Pass | Skip | Fail | Notes |
|----------------------------|------|------|------|-------|
| test_mcp_type_coercion.py  | 12   | 0    | 0    | all green |

### Runtime tests (`tests/runtime/`)

Command: `.venv/bin/python -m pytest tests/runtime/ -q`

```
2 failed, 117 passed, 8 skipped, 6 warnings in 3.47s
```

| Test File                                | Pass | Skip | Fail | Notes |
|------------------------------------------|------|------|------|-------|
| test_audit_log.py                        | 0    | 5    | 0    | all 5 marked `@pytest.mark.integration`; require live bridge — skipped in this env |
| test_card_lifecycle.py                   | 7    | 0    | 0    | |
| test_chat_flow.py                        | 4    | 0    | 0    | |
| test_chat_flow_hermes.py                 | 5    | 0    | 0    | 1 hermes-gated test was skipped on a prior run; this run passed all 5 collected |
| test_chef_flavors.py                     | 7    | 0    | 0    | |
| test_compose_config.py                   | 5    | 0    | 0    | |
| test_contract_http.py                    | 6    | 0    | 0    | |
| test_mcp_mount.py                        | 0    | 0    | **2**| BOTH integration-marked tests are FAILING — MCP mount regression returned |
| test_read_flow.py                        | 7    | 0    | 0    | |
| test_row2_specialists_and_location.py    | 17   | 1    | 0    | 1 skip (live hermes requirement) |
| test_row3_card_shape_and_mcp_parity.py   | 10   | 0    | 0    | |
| test_row5_brief_scheduler.py             | 21   | 0    | 0    | |
| test_smoke_hermes.py                     | 0    | 2    | 0    | both marked `@pytest.mark.integration`; live hermes required |
| test_soul_and_skill.py                   | 6    | 0    | 0    | |
| test_stream_think_stripping.py           | 11   | 0    | 0    | |
| test_write_policy.py                     | 11   | 0    | 0    | |
| **Totals**                               | **117** | **8** | **2** | |

#### Failures (2)

```
FAILED tests/runtime/test_mcp_mount.py::test_mcp_initialize_returns_carabiner_bridge
FAILED tests/runtime/test_mcp_mount.py::test_mcp_tools_list_includes_both_scoped_tools
```

Both tests in `tests/runtime/test_mcp_mount.py` carry `@pytest.mark.integration`.
They require the bridge runtime (`CARABINER_RUNTIME=hermes`, server on
`127.0.0.1:8641`) to be live during the test. `t_7be0fd79` previously
attributed these failures to the bridge not running and shipped an env-gated
fix. As of this run, the two tests still fail in this environment — either
the bridge is again not up, or the fix did not actually make the tests pass
without a live bridge. See "Differences from prior baseline" below.

#### Skipped tests (8 total)

- 5 in `test_audit_log.py` — all `@pytest.mark.integration` (live bridge)
- 2 in `test_smoke_hermes.py` — `@pytest.mark.integration` (live hermes gateway)
- 1 in `test_row2_specialists_and_location.py` — live hermes requirement

#### Warnings (6)

- `PytestUnknownMarkWarning` for `@pytest.mark.integration` (mark is not
  registered in `pytest` config). Cosmetic only; should be registered under
  `pyproject.toml` `[tool.pytest.ini_options].markers` in a follow-up ticket.

### Environment-blocked tests

- `pytest_asyncio` is **not** in the system Python 3.14 interpreter. All
  runtime tests must be invoked via `.venv/bin/python -m pytest` to pick up
  the venv-installed `pytest_asyncio`. Documented; not a regression.
- 8 tests skip cleanly when integration marks are honored and the bridge /
  hermes gateway are absent. That is expected behavior, not a failure.

## Frontend Tests (TypeScript / Vitest)

Command: `cd frontend && npx vitest run`

```
Test Files  9 passed (9)
     Tests  73 passed (73)
  Duration  12.74s
```

| Test File                                      | Tests | Status |
|------------------------------------------------|------:|--------|
| src/__tests__/components/action-card.test.tsx  | 18    | passed |
| src/__tests__/components/module-chat.test.tsx  | 10    | passed |
| src/__tests__/components/solitaire-cards.test.tsx | 11 | passed |
| src/__tests__/components/chat-composer.test.tsx (collect via prior baseline) | — | covered in suite |
| src/__tests__/demo/demo-auth-tutorial-flow.test.tsx | — | covered in suite |
| src/__tests__/demo/demo-route-isolation.test.tsx | 2 | passed |
| src/__tests__/hooks/use-action-cards.test.ts   | 12    | passed |
| src/__tests__/lib/socket-client.test.ts        |  5    | passed |

All 73 tests across 9 files green. Test count grew from 62 (prior baseline)
to 73 — three new test files / suites were added between baselines
(consistent with the larger component surface that now includes
`solitaire-cards` and the demo coverage expansion).

## Frontend Lint

Command: `cd frontend && pnpm lint`

```
14 problems (3 errors, 11 warnings)
```

The lint command exited non-zero. Of note:

- **3 errors**, all in `src/components/solitaire-cards.tsx`:
  - `react-hooks/set-state-in-effect` — `setReduced(mq.matches)` called
    synchronously inside `useEffect` at line 31. This is a new rule added
    by the recent Next.js / React upgrade and the file has not yet been
    adapted.
  - (2 further errors in the same file: same rule on subsequent setState
    sites inside the effect.)
- **11 warnings**, mostly `@typescript-eslint/no-unused-vars` for `_` and
  `_contextId`, plus `@next/next/no-before-interactive-script-outside-document`
  in `src/components/theme-script.tsx`. Pre-existing.

These are non-blocking but should be tracked under a follow-up ticket
(e.g. LINT-001) — the new `react-hooks/set-state-in-effect` rule was not
in force at the time the solitaire-cards component was written.

## Docker Compose Config Validation

Command: `docker compose -f docker-compose.hermes.yml config -q`

Exit code 0, no output. The compose file is syntactically valid and resolves
against the local Docker engine.

## Summary

| Suite                       | Pass | Fail | Skip | Flaky | Env-blocked |
|-----------------------------|-----:|-----:|-----:|------:|------------:|
| Python (non-runtime)        |   12 |    0 |    0 |     0 |           0 |
| Python (runtime)            |  117 |  **2**|    8 |     0 |           8 |
| Frontend (Vitest)           |   73 |    0 |    0 |     0 |           0 |
| Frontend (ESLint)           |    — |    3 errors + 11 warnings |    — |     — |           — |
| Docker compose config       |    — |    0 |    — |     — |           — |
| **Aggregate (functional)**  | **202** | **2** | **8** | **0** |           — |

Aggregate functional pass rate: **202 / 204 = 99.0 %**.

## Differences from previous baseline

The previous baseline (saved before `t_7be0fd79`) reported
**131 passed → expected 119 + 8 skipped** for Python runtime tests after the
MCP fix. The actual current state is:

1. **`tests/test_dashboard.py` is gone.** The earlier baseline and the
   `/tmp/baseline_failures.txt` artifact referenced 19 failures in
   `test_dashboard.py`. That file no longer exists in `tests/` — only
   `test_mcp_type_coercion.py` and `runtime/` remain. The 19 dashboard
   failures were real at the time but the file has since been deleted
   (presumably under a separate dashboard cleanup ticket). They are NOT
   present in this baseline.
2. **MCP mount regression returned.** The two `test_mcp_mount.py`
   integration tests fail again. The prior baseline claimed
   "119 passed, 8 skipped, 0 failed" for the runtime suite; the actual
   number with the bridge down is **117 passed, 2 failed, 8 skipped**.
   `t_7be0fd79` (FIX-MCP-MOUNT-REGRESSION) appears to have marked the
   tests as `@pytest.mark.integration` but did not make them pass under
   the same conditions — they still require a live bridge on
   `127.0.0.1:8641`. Either (a) the fix landed in a different branch,
   (b) the tests need to be marked with `skipif` based on bridge reachability
   instead of just `integration`, or (c) the bridge needs to be started
   before the baseline is recorded.
3. **Frontend tests grew** from 62 → 73 tests across 8 → 9 files. New
   component coverage (solitaire-cards) and demo coverage expansions
   account for the delta. All green.
4. **Lint now reports 3 errors** under a new
   `react-hooks/set-state-in-effect` rule that did not fire in the prior
   baseline. All 3 errors are in the new `solitaire-cards.tsx` component.
5. **Compose config** validation was not performed in the prior baseline;
   it is in this one and passes cleanly.

## Acceptance checklist

- [x] All 5 baseline commands executed (pytest non-runtime, pytest
  runtime, vitest, lint, compose config)
- [x] Baseline report updated with current numbers
- [x] New failures documented (2 MCP-mount, 3 lint errors in
  solitaire-cards, with root-cause notes above)

## Recommended follow-up tickets

- **FIX-MCP-MOUNT-REGRESSION v2** — re-investigate the two failing
  `test_mcp_mount.py` tests. The `t_7be0fd79` fix was insufficient.
  Recommended action: either start the bridge before recording the
  baseline, or wrap the integration-marked tests with
  `pytest.mark.skipif(not bridge_reachable(), reason=...)`.
- **LINT-001** — fix the 3 `react-hooks/set-state-in-effect` errors in
  `frontend/src/components/solitaire-cards.tsx`. Move the synchronous
  `setState` calls into a layout effect or use a function initializer.
- **TEST-008** — register `@pytest.mark.integration` in
  `pyproject.toml` under `[tool.pytest.ini_options].markers` to silence
  the 6 `PytestUnknownMarkWarning`s.