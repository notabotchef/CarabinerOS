# Release History

Tracks stable releases and rollback points.

## Stable Deployments

| Date | SHA | Tag | Description | Rollback |
|------|-----|-----|-------------|----------|
| 2026-07-22 | 5437b5d | baseline-2026-07-22 | Post-war-room baseline; mem_limit fixes; dashboard mock fallback | `git checkout 5437b5d` |

## Release Candidates

(None yet)

## Rollback Procedures

### Database

```bash
# Dump current state
docker exec carabiner-hermes-postgres-1 pg_dump -U postgres carabiner > /tmp/carabiner_backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker exec -i carabiner-hermes-postgres-1 psql -U postgres carabiner < /tmp/carabiner_backup.sql
```

### Config

```bash
# Config is backed up at /root/carabineros/var/rollback/
# Restore: cp /root/carabineros/var/rollback/warroom-2026-07-22/config.yaml.bak /root/carabineros/var/hermes-home/config.yaml
```

### Code

```bash
# Stable deployment SHA
git checkout 5437b5d  # baseline-2026-07-22
# Or from strategic-implementation branch
git checkout strategic-implementation
```
