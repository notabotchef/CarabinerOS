# Open Decisions

Decisions that require human input or are pending investigation.

## Pending

| ID | Decision | Context | Options | Due |
|----|----------|---------|---------|-----|
| OD-001 | Workspace model future | DB-007: workspace_* tables overlap with operational models | canonical / projection / demo-only / transitional / migration | Phase 2 |
| OD-002 | Canonical API selection | API-002: carabiner/api/ (legacy Flask) vs carabiner/runtime/ (FastAPI bridge) | Keep bridge, deprecate Flask | Phase 4 |
| OD-003 | Canonical MCP surface | MCP-002: carabiner/mcp/ vs carabiner/runtime/mcp_surface.py | Select one, archive other | Phase 4 |
| OD-004 | Cloudflare tunnel restoration | CFG-006: tunnel returns HTTP 000 (origin cert missing) | Fix cert / use SSH tunnel / alternative authenticated tunnel | Phase 1 |
| OD-005 | Root pyproject.toml adoption | DEP-002: root pyproject.toml exists but may conflict with venv layout | Adopt with evidence / reject | Phase 8 |

## Resolved

(None yet)
