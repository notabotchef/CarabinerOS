# CarabinerOS — Status Correction Report (Recovery Cycle 1)

**Date**: 2026-07-23
**Trigger**: Operator requested status corrections per controlled resumption authorization §1.
**Constraint**: Do not begin new dispatch until status corrections applied and recorded.

---

## 1. Corrections Applied

### t_6c72d856 — FIX-WORKSPACE-KIND

| Field | Before | After |
|-------|--------|-------|
| status | `done` | **`review`** (Specialist Review column) |
| result text | unchanged | unchanged |

**Acceptance gate per operator §1**:
- ✓ Independent reviewer will inspect the branch (this is now the gate — ticket is in review, not done)
- ⏳ Reviewer verifies documented valid workspace kinds (PENDING)
- ⏳ Reviewer verifies invalid `git` source correctly identified (PENDING)
- ⏳ Reviewer verifies ticket templates corrected (PENDING)
- ⏳ Reviewer determines whether pre-dispatch validation was IMPLEMENTED or merely RECOMMENDED (PENDING)
- ⏳ Validation confirms isolated worktree behavior (PENDING)
- ⏳ Eligible changes merge into `strategic-implementation` (PENDING)
- ⏳ Stash disposition finalized (PENDING — currently PARTIALLY APPLIED, retained)

**Pre-dispatch validation status**: The WORKSPACE_KIND_VALIDATION.md documents a *recommendation* for a `create_ticket_safe()` helper but does NOT implement it. Acceptance criterion 4 (pre-dispatch validation added) is therefore **incomplete** in code terms. Per operator §1: "A recommendation for pre-dispatch validation is not equivalent to implementing validation. ... If no code-level validation was added, record that acceptance criterion as incomplete and create a follow-up ticket rather than claiming it passed."

**Follow-up ticket required**: A new ticket must be created to add the `create_ticket_safe()` helper to a CarabinerOS-side ticket creation script (or note that this is a hermes-cli tool not in scope).

### t_7be0fd79 — FIX-MCP-MOUNT-REGRESSION

| Field | Before | After |
|-------|--------|-------|
| status | `done` | **`blocked`** |
| blocked reason | n/a | `RESTART-DOCKER must restore the bridge, then both MCP mount integration tests must pass.` |

**Acceptance gate per operator §1**:
- ⏳ `.venv/bin/python -m pytest -q tests/runtime/test_mcp_mount.py` PASSES (PENDING bridge restart)
- Test current result: 2 FAILED with `Connection refused [Errno 111]` (environmental — no code regression)
- Closure dependency: RESTART-DOCKER ticket + live bridge + tests pass

**Validation report**: `/root/carabineros/state/carabineros/MCP_MOUNT_REGRESSION_VALIDATION.md` (committed)

---

## 2. Other Tickets — Verification

### t_106da3be — BASE-005

| Field | Value |
|-------|-------|
| status | `done` (verified legitimate) |
| artifact | `/root/carabineros/state/carabineros/BASE-005_TEST_BASELINE.md` (10526 bytes) |
| content | Records test baseline: Python non-runtime 12 pass / 0 fail; Python runtime 117 pass / 2 fail / 8 skip; Frontend 73 pass |
| verification | File exists, content accurate, produced by a worker that ran all 5 baseline commands |

**Verdict**: Legitimately done. No correction needed.

### t_3c024a85 — TEST-WORKTREE-PROOF

| Field | Value |
|-------|-------|
| status | `done` (verified legitimate) |
| branch | `ticket/test-worktree-proof` |
| commit | 59386b7 |
| worktree | `/root/carabineros/.worktrees/t_3c024a85` |
| verification | Branch exists, commit exists, worktree exists, manual isolation proof verified |

**Verdict**: Legitimately done. No correction needed.

### t_d9d17d67 — DB-007

| Field | Value |
|-------|-------|
| status | `done` (verified legitimate) |
| artifact | `/root/carabineros/state/carabineros/DB-007_MODEL_DECISION.md` (21428 bytes) |
| artifact 2 | `/root/carabineros/docs/DATA_OWNERSHIP.md` (updated with "DB-007 Final Decisions" section) |
| content | Per-table decision matrix for all 8 modules + recommended: Option 1 (canonical workspace_*) for 6 modules, Option 2 (projection) for 2 modules |
| verification | ADR file exists, comprehensive 21KB document, DATA_OWNERSHIP.md updated |

**Verdict**: Legitimately done. The `result` field in the DB was empty but the file deliverable exists. No status correction needed; the result was captured by the worker via a comment ("BLOCKED: agency-agents-router plugin not installed") that was resolved by inline fallback (per task comment thread).

### t_8375d217 — RESTART-DOCKER

| Field | Value |
|-------|-------|
| status | `blocked` (awaiting controlled resume per Gate §2) |

### t_6408bd29 — INSTALL-BLOCKER-CRON

| Field | Value |
|-------|-------|
| status | `blocked` (awaiting controlled resume) |

### t_b2f9a7dc — INSTALL-RECONCILE-CRON

| Field | Value |
|-------|-------|
| status | `blocked` (awaiting controlled resume) |

### t_055b59bb — BASE-003

| Field | Value |
|-------|-------|
| status | `blocked` (awaiting controlled resume) |

---

## 3. Status Correction Summary

| Ticket | Previous | Current | Reason |
|--------|----------|---------|--------|
| t_6c72d856 FIX-WORKSPACE-KIND | done | **review** | Independent review + code-level validation still pending |
| t_7be0fd79 FIX-MCP-MOUNT-REGRESSION | done | **blocked** | Tests need live bridge; environment-only dependency |

## 4. Follow-up Action Required

Per operator §1, if no code-level pre-dispatch validation was added for FIX-WORKSPACE-KIND, create a follow-up ticket. Since I only documented a recommendation (not implemented code), the follow-up ticket is required.

**Follow-up ticket to create** (after this correction commit):
- **Title**: ADD-PRE-DISPATCH-VALIDATION — Implement create_ticket_safe() helper
- **Description**: Implement a `create_ticket_safe()` wrapper that validates `workspace_kind` against VALID_WORKSPACE_KINDS before SQL INSERT. Add to a CarabinerOS-side ticket creation script (or document why this is hermes-cli scope only).
- **Priority**: 60
- **Workspace kind**: `worktree` (writes Python code to validate ticket creation)
- **Dependencies**: FIX-WORKSPACE-KIND closure (current ticket in review)

## 5. Dispatch Authorization

Per operator §2, Recovery Cycle 1 is authorized to resume under explicit Agency Router dispatch. Per §1, no new dispatch begins until this correction is committed and recorded.

**Status corrections committed and recorded**: YES (this document)

**Awaiting operator go to begin controlled dispatch of remaining blocked tickets**:
- t_8375d217 RESTART-DOCKER (scratch, Docker ops)
- t_6408bd29 INSTALL-BLOCKER-CRON (scratch, control-plane cron install)
- t_b2f9a7dc INSTALL-RECONCILE-CRON (scratch, control-plane cron install)
- t_055b59bb BASE-003 (scratch, DB restore test)

**Order per operator §7**:
1. RESTART-DOCKER
2. FIX-WORKSPACE-KIND validation closure (in review)
3. FIX-MCP-MOUNT-REGRESSION validation closure (blocked on bridge)
4. INSTALL-BLOCKER-CRON
5. INSTALL-RECONCILE-CRON
6. BASE-003
7. BASE-005 (done)
8. DB-007 (done)
