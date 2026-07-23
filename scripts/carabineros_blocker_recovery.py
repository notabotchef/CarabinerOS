#!/usr/bin/env python3
"""Carabineros blocked-ticket recovery job.

Reads the carabineros-strategic-impl Hermes kanban board, analyzes blocked
cards using the protocol in state/carabineros/BLOCKER_INDEX.md, writes a
recovery report, and stamps next_review_at for processed tickets.
"""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path("/root/carabineros")
STATE_DIR = REPO_ROOT / "state" / "carabineros"
BOARD_DB = Path("/root/.hermes/kanban/boards/carabineros-strategic-impl/kanban.db")
BLOCKER_INDEX = STATE_DIR / "BLOCKER_INDEX.md"
FILE_LEASES = STATE_DIR / "FILE_LEASES.json"

ALLOWED_OUTCOMES = {
    "UNBLOCK_TO_READY",
    "KEEP_BLOCKED",
    "MOVE_TO_HUMAN_DECISION",
    "DEFERRED",
    "REJECTED",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def shell(args: list[str]) -> str:
    try:
        return subprocess.run(
            args,
            cwd=str(REPO_ROOT),
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=20,
        ).stdout.strip()
    except Exception as exc:  # pragma: no cover - defensive cron evidence capture
        return f"ERROR: {type(exc).__name__}: {exc}"


def ensure_next_review_at(conn: sqlite3.Connection) -> None:
    columns = {row[1] for row in conn.execute("PRAGMA table_info(tasks)")}
    if "next_review_at" not in columns:
        conn.execute("ALTER TABLE tasks ADD COLUMN next_review_at INTEGER")
        conn.commit()


def rows(conn: sqlite3.Connection, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    conn.row_factory = sqlite3.Row
    return [dict(row) for row in conn.execute(query, params).fetchall()]


def failure_signature(task: dict[str, Any], events: list[dict[str, Any]], runs: list[dict[str, Any]]) -> str:
    parts: list[str] = [str(task.get("last_failure_error") or "")[:240]]
    for run in runs[:5]:
        parts.append(str(run.get("error") or run.get("summary") or "")[:240])
    for event in events[:8]:
        if event.get("kind") in {"blocked", "gave_up", "protocol_violation", "comment"}:
            parts.append(f"{event.get('kind')}:{str(event.get('payload') or '')[:240]}")
    return " | ".join(p for p in parts if p).strip() or "no recorded failure signature"


def count_equivalent_failures(runs: list[dict[str, Any]]) -> int:
    normalized = []
    for run in runs:
        text = (run.get("error") or run.get("summary") or "").strip().lower()
        if not text:
            continue
        normalized.append(" ".join(text.split())[:180])
    if not normalized:
        return 0
    return Counter(normalized).most_common(1)[0][1]


def decide(task: dict[str, Any], events: list[dict[str, Any]], runs: list[dict[str, Any]], parents: list[dict[str, Any]]) -> tuple[str, str]:
    body = (task.get("body") or "").lower()
    block_kind = task.get("block_kind")
    recurrences = int(task.get("block_recurrences") or 0)
    equivalent_failures = count_equivalent_failures(runs)
    parent_blockers = [p for p in parents if p.get("status") != "done"]
    signature = failure_signature(task, events, runs).lower()

    if parent_blockers:
        return "KEEP_BLOCKED", f"Waiting on {len(parent_blockers)} unfinished parent dependency/dependencies."

    if any(term in body or term in signature for term in ("needs input", "human decision", "missing credentials", "permission", "secret", "api key")):
        return "MOVE_TO_HUMAN_DECISION", "Requires human authority, credentials, permission, or an explicit decision."

    if recurrences >= 3 or equivalent_failures >= 3:
        return "MOVE_TO_HUMAN_DECISION", "Three or more equivalent failures/recurrences; protocol requires human decision or deferred handling."

    if "out of scope" in body or block_kind == "transient" and equivalent_failures >= 2:
        return "DEFERRED", "Blocked condition is outside the current recovery scope or remains transient after repeated failures."

    if "rejected" in body or "invalid" in signature:
        return "REJECTED", "Evidence indicates the proposal/path is invalid and should not be retried."

    if equivalent_failures >= 2:
        return "KEEP_BLOCKED", "Two equivalent failures detected; keep blocked and require different specialist/reduced scope before retry."

    return "KEEP_BLOCKED", "No safe unblock evidence found; never unblock solely because time passed."


def main() -> int:
    now = utc_now()
    timestamp = now.strftime("%Y%m%dT%H%M%SZ")
    report_path = STATE_DIR / f"BLOCKER_RECOVERY_{timestamp}.md"
    next_review = int((now + timedelta(hours=5)).timestamp())

    if not BOARD_DB.exists():
        raise FileNotFoundError(f"Board DB not found: {BOARD_DB}")
    if not BLOCKER_INDEX.exists():
        raise FileNotFoundError(f"Blocker protocol not found: {BLOCKER_INDEX}")

    protocol_text = BLOCKER_INDEX.read_text(encoding="utf-8")
    leases_text = FILE_LEASES.read_text(encoding="utf-8") if FILE_LEASES.exists() else "{}"
    branch_state = shell(["git", "branch", "-a"])
    worktree_state = shell(["git", "worktree", "list"])

    conn = sqlite3.connect(BOARD_DB)
    conn.row_factory = sqlite3.Row
    ensure_next_review_at(conn)

    blocked = rows(conn, "SELECT * FROM tasks WHERE status = 'blocked' ORDER BY priority DESC, created_at ASC")
    decisions: list[dict[str, Any]] = []

    for task in blocked:
        task_id = task["id"]
        events = rows(
            conn,
            "SELECT kind, payload, created_at FROM task_events WHERE task_id = ? ORDER BY created_at DESC LIMIT 20",
            (task_id,),
        )
        runs = rows(
            conn,
            "SELECT status, outcome, summary, error, metadata, started_at, ended_at FROM task_runs WHERE task_id = ? ORDER BY started_at DESC LIMIT 10",
            (task_id,),
        )
        parents = rows(
            conn,
            """
            SELECT p.id, p.title, p.status
            FROM task_links l
            JOIN tasks p ON p.id = l.parent_id
            WHERE l.child_id = ?
            ORDER BY p.created_at ASC
            """,
            (task_id,),
        )
        children = rows(
            conn,
            """
            SELECT c.id, c.title, c.status
            FROM task_links l
            JOIN tasks c ON c.id = l.child_id
            WHERE l.parent_id = ?
            ORDER BY c.created_at ASC
            """,
            (task_id,),
        )

        outcome, rationale = decide(task, events, runs, parents)
        if outcome not in ALLOWED_OUTCOMES:
            raise ValueError(f"Internal invalid outcome {outcome!r} for {task_id}")

        if outcome == "UNBLOCK_TO_READY":
            conn.execute(
                "UPDATE tasks SET status = 'ready', next_review_at = NULL, claim_lock = NULL, claim_expires = NULL WHERE id = ?",
                (task_id,),
            )
        else:
            conn.execute("UPDATE tasks SET next_review_at = ? WHERE id = ?", (next_review, task_id))

        decisions.append(
            {
                "task": task,
                "events": events,
                "runs": runs,
                "parents": parents,
                "children": children,
                "outcome": outcome,
                "rationale": rationale,
                "signature": failure_signature(task, events, runs),
                "next_review_at": next_review if outcome in {"KEEP_BLOCKED", "MOVE_TO_HUMAN_DECISION"} else None,
            }
        )

    conn.commit()
    conn.close()

    lines = [
        f"# Blocker Recovery Report {timestamp}",
        "",
        f"- Board DB: `{BOARD_DB}`",
        f"- Protocol: `{BLOCKER_INDEX}`",
        f"- Processed blocked tickets: {len(blocked)}",
        f"- Allowed outcomes: {', '.join(sorted(ALLOWED_OUTCOMES))}",
        "",
        "## Protocol Source",
        "",
        f"Read `{BLOCKER_INDEX}` before processing. The report normalizes legacy protocol labels to the acceptance-approved outcomes: {', '.join(sorted(ALLOWED_OUTCOMES))}.",
        "",
        "## Environment Evidence",
        "",
        "### Git branches",
        "```",
        branch_state[:4000],
        "```",
        "",
        "### Git worktrees",
        "```",
        worktree_state[:4000],
        "```",
        "",
        "### File leases",
        "```json",
        leases_text[:4000],
        "```",
        "",
        "## Decisions",
        "",
    ]

    if not decisions:
        lines.extend(["No blocked tickets were present. Schema check still ensured `tasks.next_review_at` exists.", ""])
    for item in decisions:
        task = item["task"]
        lines.extend(
            [
                f"### {task['id']} — {task['title']}",
                "",
                f"- Assignee: `{task.get('assignee')}`",
                f"- Priority: `{task.get('priority')}`",
                f"- Block kind: `{task.get('block_kind')}`",
                f"- Decision: `{item['outcome']}`",
                f"- Rationale: {item['rationale']}",
                f"- Next review at: `{item['next_review_at']}`",
                f"- Failure signature: {item['signature']}",
                f"- Parents: {json.dumps(item['parents'], ensure_ascii=False)}",
                f"- Children: {json.dumps(item['children'], ensure_ascii=False)}",
                "",
            ]
        )

    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"BLOCKER_RECOVERY_REPORT={report_path}")
    print(f"PROCESSED_BLOCKED_TICKETS={len(blocked)}")
    print("OUTCOMES=" + ",".join(item["outcome"] for item in decisions))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
