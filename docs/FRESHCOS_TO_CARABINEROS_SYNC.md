# FreshcOS → CarabinerOS Sync — Status: BLOCKED on access

**Produced:** 2026-07-09 · **Authoring session:** main Hermes on /root/carabineros @ 62b0947 · **Prior evidence:** Codex audit run 2026-07-09 on Esteban's machine (referenced in Fable audit §8)

## What was claimed

- The migration brief described FreshcOS as "the newest direction" for the Carabiner stack, implying a working successor tree that the sync step should pull in.
- The only file-based evidence is the Codex audit Esteban's local Codex run produced 2026-07-09. Its conclusion: FreshcOS is a **stale upstream-Agent-Zero experiment (14/17 tests fail, missing `carabiner/agent_overlay` and `bridge.py`)**. No FreshcOS repository on GitHub surfaces this; the conclusion is the only verbatim artifact available.
- Treating "newest direction" as load-bearing before that experiment is reproducible would be guessing. This doc records the block, not the guess.

## What this machine could verify

- `find /root -maxdepth 3 -iname 'freshcos*' 2>/dev/null` → **no results** (zero output lines returned; command exited 0).
- `find /root -maxdepth 4 -type d -iname 'freshcos*' 2>/dev/null` → **no results** (zero output lines returned; command exited 0). No FreshcOS tree on this VDI.
- `gh search repos freshcos --owner notabotchef` → **no results**. `gh` IS authenticated here (`gh auth status` reports `Logged in to github.com account notabotchef`), so an empty result is real, not a noisy auth failure.
- `curl -s "https://api.github.com/search/repositories?q=freshcos+user:notabotchef" | head -c 800` → verbatim:
  ```
  {
    "total_count": 0,
    "incomplete_results": false,
    "items": [

    ]
  }
  ```
  Public GitHub confirms: nothing under `notabotchef/` matches "freshcos".
- DuckDuckGo HTML search `"FreshcOS" notabotchef` → zero hits tying the two together. Only echoes of the query itself and an unrelated "Freshcos Shorts - YouTube" line were returned. **[UNVERIFIED]** whether a non-indexed fork / private mirror exists.

## Verdict from existing evidence

The Codex audit's verbatim verdict — what we have to work with until the tree surfaces — is:

> "stale upstream-A0 experiment (14/17 tests fail, missing `carabiner/agent_overlay` and `bridge.py`)"

That single sentence carries the entire FreshcOS evidence base as of 2026-07-09. It is local-only (Esteban's disk), it is a static artifact from one Codex run, and we **cannot re-run** it from `/root/carabineros`.

## Unblock checklist for Esteban

1. Push FreshcOS to a public branch (e.g. `freshcos-snapshot`) on `notabotchef/`.
2. Or push to a private repo and grant main Hermes read access.
3. Re-run the Codex audit against the public branch so any agent can verify.
4. Publish the original audit's exact `commit hash` + `path` so anyone can reproduce "14/17 fail."
5. Provide the test command + env needed to reproduce the failure (`make` target, pytest invocation, Python version).
6. Either restore `carabiner/agent_overlay` and `bridge.py` in the snapshot, or pin a doc that explains if/when they existed and why they're absent now.
7. Drop a one-page `FRESH_COS_INTENT.md` next to the snapshot: goal, intended Carabiner boundary, what was abandoned, and the deprecation rationale.
8. If FreshcOS is actually superseded, mark it ARCHIVED in the repo (`docs/_archive/`) so future Codex/Fable runs don't surface it as "the newest direction" again.
9. **[Optional]** Add a CI status badge linking the latest public-passing FreshcOS test run.

## What this means for the Hermes beta

- The beta proceeds **without** FreshcOS. The "sync FreshcOS" mission item is recorded as **documented-blocked**, not silently dropped — this file is the audit trail.
- Future agent handoff: if FreshcOS surfaces (public branch, granted access, or archived reactivation), re-run the migration §3 against it; the `carabiner/runtime/` bridge adapter boundary is unchanged — FreshcOS would slot in at the MCP/`carabiner_read|propose_write` surface.
- No CLAUDE.md/README claims about FreshcOS "the newest direction" survive this doc. They are corrected in the doc-banner pass (P3 of the migration plan).
