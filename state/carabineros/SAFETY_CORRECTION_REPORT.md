# CarabinerOS Recovery Cycle 1 — Safety Correction Report

**Date**: 2026-07-22T11:20 CDT
**Trigger**: Operator requested immediate safety correction after observing all 8 recovery workers shared `/root/carabineros` workspace
**Authority**: Immediate pause of dispatcher + classification + isolation correction

---

## 1. Dispatcher Pause: YES

| Action | Evidence |
|--------|----------|
| `hermes config set kanban.dispatch_in_gateway false` | ✓ Set, written to `/root/.hermes/config.yaml` |
| `hermes config set kanban.auto_decompose false` | ✓ Set, written to `/root/.hermes/config.yaml` |
| Gateway process reload | NOT YET — running gateway (PID 1798775) still has old config loaded |
| Effective pause | PARTIAL — config change written but dispatcher continues from in-memory old config |

**Note**: Per the hermes-kanban-ops skill, `hermes gateway restart` is BLOCKED from inside the gateway process. The operator must restart the gateway from outside (e.g., `sudo systemctl restart hermes-gateway.service` from a non-gateway shell) for the pause to fully take effect.

---

## 2. Active Workers — Inspection Results

Three workers spawned before pause; two more spawned after pause attempt (in-memory config not yet reloaded).

| Ticket | Worker PID | Status | Read-Only? | Files Modified | Branch | Overlap |
|--------|-----------|--------|------------|----------------|--------|---------|
| t_6c72d856 FIX-WORKSPACE-KIND | 1801993 | **done** | No (wrote docs) | `state/carabineros/EXPERT_ASSIGNMENT_LOG.md` (+19 lines, VALID_WORKSPACE_KINDS doc) | main (shared) | None |
| t_7be0fd79 FIX-MCP-MOUNT-REGRESSION | 1801994 | **done** | YES | None (root cause was environmental) | main (shared) | None |
| t_8375d217 RESTART-DOCKER | 1801992, 1802940 | **blocked** (crashed twice) | Read-only on repo (Docker ops only) | None | n/a | None |
| t_6408bd29 INSTALL-BLOCKER-CRON | 1803109, 1803710 | killed (running→blocked) | Control-plane (cron) | None | n/a | None |
| t_b2f9a7dc INSTALL-RECONCILE-CRON | 1803110 | killed | Control-plane (cron) | None | n/a | None |
| t_055b59bb BASE-003 | 1803111, 1803712 | killed | Read-only (DB restore test) | None | n/a | None |

### Overlapping Files Detected: NONE

The only repo file modified was `state/carabineros/EXPERT_ASSIGNMENT_LOG.md` by t_6c72d856 (its own ticket's documentation target). No two workers wrote to the same file.

### Diff Disposition

- **t_6c72d856 diff**: 19 insertions, 1 file modified
  - Stashed: `git stash push -m "RECOVERY-CYCLE-1-stash: FIX-WORKSPACE-KIND doc update (t_6c72d856)"`
  - Stash ID: `stash@{0}` — safe, recoverable
  - Backup at: `/tmp/t_6c72d856_diff.patch` (2241 bytes)
- **All other workers**: No repo writes to preserve

---

## 3. Branch and Worktree Status

| Ticket | Branch | Worktree | Result |
|--------|--------|----------|--------|
| t_6c72d856 | main (shared checkout) | None | Done; diff stashed |
| t_7be0fd79 | main (shared checkout) | None | Done; no writes |
| t_8375d217 | n/a | n/a | Crashed before any branch |
| t_6408bd29 | n/a | n/a | Killed before any branch |
| t_b2f9a7dc | n/a | n/a | Killed before any branch |
| t_055b59bb | n/a | n/a | Killed before any branch |
| t_106da3be | n/a | n/a | Never spawned |
| t_d9d17d67 | n/a | n/a | Never spawned |
| t_3c024a85 | ticket/test-worktree-proof (queued) | Queued, not yet spawned | Awaiting dispatcher reload |

**Worktrees created**: 0
**Ticket branches created**: 0

---

## 4. Branch Policy Violations

### Direct-to-main commits (this cycle)

| Commit | Type | Branch | Violation? |
|--------|------|--------|------------|
| 547f2bc | docs (reconciliation report) | main | **YES** — direct to main, not via strategic-implementation |
| 8502368 | docs (recovery status report) | main | **YES** — direct to main |

### Earlier recovery-related commits that bypassed integration branch

| Commit | Cycle | Status |
|--------|-------|--------|
| cc2cdfd | Phase 2 (DB dup + ownership) | Direct to main — also bypasses |
| 41f4a4f | Master prompt | Direct to main — bypasses |
| 0a55b97 | Merge strategic-implementation | Legitimate merge |

### Corrected Policy (from this point onward)

- ❌ No direct implementation or status commits to `main`
- ✅ Commits go to `strategic-implementation` or `ticket/<id>-<slug>` branches
- ✅ Promotion to `main` only via the defined phase/release process
- ✅ Reports (like this one) go to strategic-implementation branch

**Note**: I am NOT rewriting or force-pushing history. The existing commits remain. From this commit onward, all writes go to strategic-implementation.

---

## 5. File Lease Registry

Created: `/root/carabineros/state/carabineros/FILE_LEASES.json`

Records all 9 tickets with workspace_kind, leased_paths, worker PID, start/end times, status. No conflicts detected. Agency Router must consult this file before spawning future workers.

---

## 6. Isolated Worktree Spawn Proof

**Status**: PARTIAL — ticket created but not yet spawned.

| Field | Value |
|-------|-------|
| Ticket ID | t_3c024a85 |
| Title | TEST-WORKTREE-PROOF verify worktree spawn |
| Workspace kind | `worktree` |
| Branch | `ticket/test-worktree-proof` |
| Spawn outcome | PENDING — waiting for gateway restart to load `dispatch_in_gateway=false` |

**Cannot verify** until the gateway is restarted to load the new config. The dispatcher is still using in-memory old config and continues to spawn `dir`-kind workers.

### Operator action required

To complete the worktree spawn proof, the operator must run from a non-gateway shell:

```bash
sudo systemctl restart hermes-gateway.service hermes-gateway-telegram-operator.service
```

After restart, the dispatcher will read `dispatch_in_gateway=false` and stop spawning. The t_3c024a85 ticket (worktree kind) will not auto-spawn — the operator will need to manually spawn it via:

```bash
hermes chat -q "work kanban task t_3c024a85 --board carabineros-strategic-impl"
```

---

## 7. Reclassification of Remaining Work

Per operator instruction §4:

| Ticket | Original Kind | Correct Kind | Reason |
|--------|--------------|--------------|--------|
| t_106da3be BASE-005 | `dir` (ready) | **`scratch`** — read-only test runs, no repo writes unless baseline doc is updated | Baseline doc update should use isolated worktree |
| t_d9d17d67 DB-007 | `dir` (ready) | **`worktree`** with branch `ticket/db-007-workspace-future` — writes ADR | ADR is repo documentation |
| t_6408bd29 INSTALL-BLOCKER-CRON | `dir` (blocked) | **`scratch`** — cron install is control-plane, outside repo | Cron config lives in `/root/.hermes/cron/jobs.json` |
| t_b2f9a7dc INSTALL-RECONCILE-CRON | `dir` (blocked) | **`scratch`** — cron install is control-plane | Same as above |
| t_055b59bb BASE-003 | `dir` (running→killed) | **`scratch`** — DB restore test is read-only DB op, no repo writes | Only documentation commit needs worktree |
| t_8375d217 RESTART-DOCKER | `dir` (blocked) | **`scratch`** — Docker ops only, no repo writes | docker compose is outside the repo |

---

## 8. Disposition

### Stopped (SIGTERM, not SIGKILL)

Workers PIDs 1801993, 1801994 (auto-completed), 1802940, 1803109, 1803110, 1803111, 1803710, 1803712 (manually terminated).

### Preserved

- `t_6c72d856` diff: stashed in `stash@{0}`, also at `/tmp/t_6c72d856_diff.patch`
- All other workers: no repo writes to preserve

### Awaiting gateway restart

- `t_3c024a85` worktree spawn proof — needs operator-initiated gateway restart
- All other tickets — needs proper resubmission with correct workspace_kind

---

## 9. Confirmation: No Further Direct-to-main Commits

From this commit onward:
- This report (`SAFETY_CORRECTION_REPORT.md`) goes to `strategic-implementation` branch
- FILE_LEASES.json goes to `strategic-implementation` branch
- Future status reports go to `strategic-implementation` branch
- Promotion to `main` only via the defined phase/release process

The previous direct-to-main commits (`547f2bc`, `8502368`) are NOT rewritten — history is preserved per operator instruction.

---

## STOPPING

Per operator instruction: "Then resume only the tickets whose workspace and lease strategy is safe."

The dispatcher config change is written but not yet effective (gateway not restarted). All active workers stopped. No further action taken. Awaiting operator decision on gateway restart and ticket reclassification.
