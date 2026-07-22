# CarabinerOS Recovery Cycle 1 — Status Report

**Date**: 2026-07-22T11:10 CDT
**Cycle**: Recovery Cycle 1 (not product-development)
**Operator authorization**: RESTART-DOCKER through DB-007 only

---

## Live State at Start of Recovery Cycle

| Item | State |
|------|-------|
| Docker containers | 0/5 Up (killed per operator request) |
| Bridge health | HTTP 000 (connection refused) |
| DB revision | `011_chat_context` (in pgdata volume, preserved) |
| Main HEAD | `547f2bc` (reconciliation report) |
| origin/main HEAD | `547f2bc` (synced) |
| strategic-implementation HEAD | `6b4a8c1` |
| Python tests | 12 + 117 passed, 2 FAILED in test_mcp_mount.py |
| Frontend tests | 73 passed |
| Memory | 1.5 GiB available |
| Cron jobs | 3 (none for CarabinerOS) |

---

## Tickets Created on carabineros-strategic-impl Board

8 tickets with **correct schema** (workspace_kind='dir', workspace_path='/root/carabineros'):

| Ticket ID | Priority | Status |
|-----------|----------|--------|
| t_8375d217 RESTART-DOCKER | 100 | running |
| t_6c72d856 FIX-WORKSPACE-KIND | 95 | running |
| t_7be0fd79 FIX-MCP-MOUNT-REGRESSION | 90 | running |
| t_6408bd29 INSTALL-BLOCKER-CRON | 85 | ready |
| t_b2f9a7dc INSTALL-RECONCILE-CRON | 80 | ready |
| t_055b59bb BASE-003 | 75 | ready |
| t_106da3be BASE-005 | 70 | ready |
| t_d9d17d67 DB-007 | 50 | ready |

---

## Schema Bug Fix Confirmed

**Root cause from previous cycle**: workspace_kind='git' is not valid.
**Valid values**: `scratch`, `worktree`, `dir` (from `kanban_db.py:2776`)
**Fix applied**: All 8 recovery tickets use `workspace_kind='dir'` with absolute `workspace_path='/root/carabineros'`.

### Controlled Spawn Test Evidence

Workers spawned successfully:
- PID 1801992 → t_8375d217 (RESTART-DOCKER)
- PID 1801993 → t_6c72d856 (FIX-WORKSPACE-KIND)
- PID 1801994 → t_7be0fd79 (FIX-MCP-MOUNT-REGRESSION)

Worker command line confirmed `agency-router` profile with full toolsets:
```
hermes -p agency-router --cli --accept-hooks \
  --toolsets agency_agents,browser,clarify,code_execution,computer_use,cronjob,delegation,file,image_gen,kanban,memory,session_search,skills,terminal,todo,tts,vision,web,x_search \
  chat -q work kanban task t_8375d217
```

Heartbeat events arriving in task_events:
- t_8375d217 spawned → running
- t_6c72d856 spawned → running
- t_7be0fd79 spawned → running

**Fix VERIFIED**. The 9 previously blocked tickets remain `blocked` (not auto-resubmitted per operator instruction).

---

## Dispatcher Behavior

- Top 3 priority tickets spawned immediately (P100, P95, P90)
- 5 remaining tickets in `ready` status, waiting for worker slots
- Dispatcher concurrency cap: 3 (matches `max_concurrent_children` setting)
- Workers running under `agency-router` profile (PID 1798775 = main hermes gateway)

---

## Safety Compliance

- ✓ Only 8 tickets created (within max-8 budget)
- ✓ No product-development work started
- ✓ No UI/architecture/database redesign
- ✓ No automatic resubmission of previously blocked tickets
- ✓ Only one controlled spawn test performed (confirmed via the 3 spawned workers)
- ✓ All tickets use `assignee_profile: Agency-Router`
- ✓ Tickets have correct `workspace_kind` and absolute `workspace_path`

---

## Awaiting Operator Verification

The 3 running workers are currently executing their tickets. Results will be available in:
- `state/carabineros/RESTART_DOCKER_REPORT.md`
- `state/carabineros/FIX_WORKSPACE_KIND_REPORT.md`
- `state/carabineros/FIX_MCP_MOUNT_REGRESSION_REPORT.md`

The 5 ready tickets will spawn as worker slots free up. No additional action required from operator until the cycle completes.

---

## STOPPING

Per operator instruction: "Do not automatically resubmit all previously blocked strategic tickets during this cycle."

Cycle is proceeding autonomously via dispatcher. This report documents the recovery kickoff. Workers will produce their own reports as they complete.
