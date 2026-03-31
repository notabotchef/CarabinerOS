# Worktree Isolation Analysis

**Date:** 2026-03-20
**Branch:** fix/a0-frontend-streaming (investigation in worktree-agent-aff45a90)
**Status:** Root cause identified — fix implemented

---

## Executive Summary

Agents spawned with `isolation: "worktree"` (via Claude Code's `EnterWorktree` tool or the Agent tool's isolation parameter) correctly get their own git worktree at `.claude/worktrees/agent-XXXXX`. However, **there is zero enforcement preventing agents from editing files via absolute paths that point outside their worktree**. The registered `pre-edit` hook fires for every Write/Edit/MultiEdit call but has no handler — it silently succeeds with `[OK] Hook: pre-edit` and lets any edit through.

---

## What Actually Happens

### How Worktrees Are Created

Claude Code's `EnterWorktree` tool creates a git worktree inside `.claude/worktrees/` with a new branch based on HEAD. The agent session's working directory is switched to that worktree path. This is confirmed by the 23 active worktrees at:

```
/Users/estebannunez/Projects/carabiner-os/.claude/worktrees/agent-*/
```

Each has a `.git` file pointing to:
```
gitdir: /Users/estebannunez/Projects/carabiner-os/.git/worktrees/agent-XXXXX
```

And its own branch (e.g., `worktree-agent-aff45a90`).

### The Isolation Gap

When an agent is in worktree `agent-aff45a90`, its correct working directory is:
```
/Users/estebannunez/Projects/carabiner-os/.claude/worktrees/agent-aff45a90/
```

Edits to `./frontend/src/app/orders/page.tsx` correctly touch the worktree's file at:
```
/Users/estebannunez/Projects/carabiner-os/.claude/worktrees/agent-aff45a90/frontend/src/app/orders/page.tsx
```

But if the agent uses the absolute path (copied from context, from `git rev-parse --show-toplevel` in the main session, or from memory):
```
/Users/estebannunez/Projects/carabiner-os/frontend/src/app/orders/page.tsx
```

...that edit lands on the **main working tree**, bypassing isolation entirely.

### Why Agents Use Absolute Paths

1. **Context injection**: When an orchestrator delegates a task, it often includes absolute file paths from its own session (which is rooted at the main project).
2. **Memory**: Agents recall absolute paths from previous sessions stored in ruflo memory.
3. **git rev-parse --show-toplevel**: If an agent runs this in its worktree, it gets the worktree root, which is correct. But if the orchestrator passes its own root to the subagent as part of the task context, the subagent uses that absolute path.
4. **Symlink confusion**: The worktree's `.claude/` directory contains real files (tracked in git) including helpers, agents, settings — agents may cd into those and then navigate up using absolute paths.

### Evidence of Escape

From `git status` at session start, `frontend/src/components/solitaire-cards.tsx` and several other files are modified in the **main working tree** while those same files show as modified in `worktree-agent-aa19d4f6`. This confirms an agent edited files in both the main tree and a worktree simultaneously.

Additionally, multiple worktrees (`agent-a238b378`, `agent-a77041a3`, `agent-a8a17a0f`, `agent-ac844551`, `agent-ae5f5747`, `agent-af7dbc95`) show `.claude/settings.local.json` modified — these are modifications to the git-tracked `.claude/` dir, which is shared across all worktrees since it's the same content in the git object store.

### The Missing Hook Handler

`.claude/settings.json` registers a `pre-edit` hook:

```json
{
  "matcher": "Write|Edit|MultiEdit",
  "hooks": [{
    "type": "command",
    "command": "node \"$(git rev-parse --show-toplevel)/.claude/helpers/hook-handler.cjs\" pre-edit",
    "timeout": 5000
  }]
}
```

But `hook-handler.cjs` has **no `pre-edit` case** in its handlers object. The command falls through to:

```javascript
} else if (command) {
  // Unknown command - pass through without error
  console.log(`[OK] Hook: ${command}`);
}
```

This means every file edit — regardless of whether it's inside or outside the worktree — succeeds without any isolation check.

---

## Root Cause

**Three compounding failures:**

1. **No path enforcement in pre-edit hook** — The hook fires but has no implementation. Any absolute path edit passes through unchecked.

2. **No worktree boundary awareness in the hook system** — Even if `pre-edit` had logic, it would need to know: (a) whether we're currently in a worktree, and (b) what the worktree root is.

3. **Orchestrators pass absolute paths to subagents** — When a parent session (rooted at the main project) spawns an agent via the `Agent` tool and includes file paths in the task description, those paths are absolute and point to the main tree.

---

## Recommended Fix

### Fix 1: Implement `pre-edit` worktree boundary guard in `hook-handler.cjs` (DONE)

Add a `pre-edit` handler that:
1. Detects if the current process is running inside a worktree (CWD is under `.claude/worktrees/`)
2. Resolves the file path being edited (from `hookInput.toolInput.file_path`)
3. If the resolved file path is NOT under the worktree root, **blocks the edit** (exit code 2)

This catches absolute path escapes at the hook level. Claude Code treats exit code 2 from a `PreToolUse` hook as "block this tool call and show the hook output to the user."

### Fix 2: Add worktree root instruction to agent tasks (RECOMMENDED)

When spawning agents via the `Agent` tool or delegating via the `SubagentStart` event, always prefix the task with the worktree-relative context:

```
IMPORTANT: You are working in an isolated worktree at {worktree_root}.
All file edits MUST use paths relative to this directory.
Never use absolute paths that point to /Users/estebannunez/Projects/carabiner-os/ directly.
```

### Fix 3: Add pre-task worktree verification (RECOMMENDED)

The `SubagentStart` hook currently just runs `status`. Enhance it to:
1. Check if Claude Code has assigned a worktree to this subagent
2. Verify the subagent's CWD is inside that worktree
3. If not, log a warning that isolation may not be active

### Fix 4: Use relative paths in task delegation (RECOMMENDED)

In CLAUDE.md workflow rule #10, add explicit instruction that when delegating tasks to agents, only include relative file paths (relative to the project root), never absolute paths.

---

## What `isolation: "worktree"` Actually Does

Per the `EnterWorktree` tool description:
- Creates a new git worktree at `.claude/worktrees/<name>`
- Creates a new branch based on HEAD
- Switches the **session's working directory** to the new worktree
- Does NOT prevent the agent from using absolute paths outside the worktree

It is a CWD change + branch isolation, not a filesystem sandbox. There is no syscall-level restriction preventing edits outside the worktree path.

---

## Implementation

The `pre-edit` guard has been added to `.claude/helpers/hook-handler.cjs`. See the code change for details.

The guard:
- Runs on every Write/Edit/MultiEdit call
- Checks if we are in a worktree context (CWD is under `.claude/worktrees/`)
- If yes, validates the target file path is within the worktree root
- If the file is outside, exits with code 2 (blocking the edit) with a clear error message
- If not in a worktree, passes through (no change to normal operation)
