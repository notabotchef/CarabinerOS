# File Lease Index

Tracks active file leases for repository-writing tickets. Leases prevent concurrent edits to overlapping files.

## Active Leases

(None — Phase 0 baseline work is read-only)

## Lease Rules

1. Every repository-writing ticket must acquire leases before entering `In Progress`
2. No overlapping active leases
3. Read-only work may overlap
4. Expired leases require branch, diff, and report inspection
5. Do not discard unmerged work
6. Do not assume an expired lease means no changes were made

## Lease Format

```yaml
ticket_id: <ticket-id>
leased_paths:
  - <path/glob>
acquired_at: <timestamp>
expires_at: <timestamp>
status: active | expired | released
```
