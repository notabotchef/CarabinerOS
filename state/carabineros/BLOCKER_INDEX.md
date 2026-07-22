# Blocker Index

Tracks all blocked tickets and their recovery status. Reviewed every 5 hours by the blocker-recovery cron job.

## Active Blockers

(None — Phase 0 has no blocked tickets yet)

## Recovery Schedule

- **Cron**: `0 */5 * * *` (every 5 hours)
- **Job**: `carabineros-kanban-blocker-recovery`
- **Process**:
  1. Load all Blocked tickets
  2. Read complete ticket content
  3. Read implementation, review, and validation reports
  4. Inspect dependencies
  5. Inspect branch and PR state
  6. Inspect file leases
  7. Check environment state when relevant
  8. Compare current and prior failure signatures
  9. Decide: UNBLOCK_TO_READY | KEEP_BLOCKED | MOVE_TO_HUMAN_DECISION | MOVE_TO_DEFERRED | MOVE_TO_REJECTED
  10. Write recovery report
  11. Update `next_review_at`

## Rules

- Never unblock solely because time passed
- Never retry an uncertain non-idempotent mutation
- After 2 equivalent failures: select different specialist, include previous reports, reduce/split scope
- After 3 equivalent failures: move to Human Decision or Deferred
