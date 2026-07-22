# Phase Status

## Phase 0 — Baseline, backup, and truth capture

**Status**: IN PROGRESS

### Tickets

| Ticket | Title | Status | Branch | Leases | Reviewer | Validator |
|--------|-------|--------|--------|--------|----------|-----------|
| BASE-001 | Confirm current repository and deployment state | IN PROGRESS | ticket/BASE-001-confirm-state | none | Agency-Router | Agency-Router |
| BASE-002 | Push or reconcile unpushed war-room commits | PENDING | ticket/BASE-002-reconcile-commits | none | Agency-Router | Agency-Router |
| BASE-003 | Backup database, runtime config, and evidence | PENDING | ticket/BASE-003-backup | none | Agency-Router | Agency-Router |
| BASE-004 | Generate canonical repository tree | PENDING | ticket/BASE-004-repo-tree | none | Agency-Router | Agency-Router |
| BASE-005 | Establish test baseline | PENDING | ticket/BASE-005-test-baseline | none | Agency-Router | Agency-Router |

### Exit Gate Checklist

- [ ] Stable restore point exists (database dump + config backup)
- [ ] Repository and deployment state documented
- [ ] No destructive work started without backups
