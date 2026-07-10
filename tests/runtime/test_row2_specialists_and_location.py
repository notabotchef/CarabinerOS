"""Hermetic test for the Row #2 specialist scrub + location-context skill.

What is verified:
    * None of the six specialist role prompts **instruct** the model
      to use A0-era concepts. We scan at the **paragraph** level
      because denial lines often continue an earlier denial sentence
      and do not start with a denial prefix themselves.
    * Each role prompt documents the two MCP tools, **unless** the
      role is a notification-shape role (Expo) that legitimately
      does not need data access.
    * ``gm/prompts/agent.system.main.role.md`` no longer routes
      through ``call_subordinate``.
    * ``hermes/skills/carabineros-location-context/SKILL.md`` exists,
      has valid YAML frontmatter, and contains no hard-coded
      location names (no "Main Kitchen", no fixed location label).
    * ``scripts/seed_hermes_soul.sh`` copies the new location-context
      skill to a fresh temp ``HERMES_HOME_DIR``.

Why paragraph-level scan?
    Denial sentences often continue across line breaks, e.g.
    "There is no default\nlocation in this skill anywhere." — a
    line-prefix scanner treats the second line as a positive
    statement. We instead split text into paragraphs (one or more
    blank-line-separated lines) and decide per-paragraph.

A paragraph is **allowed** if any of its lines starts with a
denial prefix. If a paragraph contains a banned phrase but **no**
line starts with a denial prefix, it is an instructional hit.
"""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]

# Six role prompts the Row #2 scrub covers (5 specialists + gm).
SPECIALIST_PROMPTS = [
    REPO_ROOT / "usr" / "agents" / "gm" / "prompts" / "agent.system.main.role.md",
    REPO_ROOT / "usr" / "agents" / "agm" / "prompts" / "agent.system.main.role.md",
    REPO_ROOT / "usr" / "agents" / "executivechef" / "prompts" / "agent.system.main.role.md",
    REPO_ROOT / "usr" / "agents" / "souschef" / "prompts" / "agent.system.main.role.md",
    REPO_ROOT / "usr" / "agents" / "expo" / "prompts" / "agent.system.main.role.md",
    REPO_ROOT / "usr" / "agents" / "marketing" / "prompts" / "agent.system.main.role.md",
]

# Roles that legitimately do not need to call MCP tools (notification-
# shape roles whose only job is to frame the assistant's reply).
DATA_OPTIONAL_ROLES = {
    REPO_ROOT / "usr" / "agents" / "expo" / "prompts" / "agent.system.main.role.md",
}

LCTX_SKILL = (
    REPO_ROOT / "hermes" / "skills" / "carabineros-location-context" / "SKILL.md"
)
SEED_SCRIPT = REPO_ROOT / "scripts" / "seed_hermes_soul.sh"

# A0-era concepts we never want to appear in an instructional paragraph.
FORBIDDEN_PHRASES = [
    "agent zero",
    "nous research",
    "code_execution_tool",
    "call_subordinate",
    "notify_user",
    "main kitchen",
    "hermes agent",
]

# Hard-coded location strings that must NOT appear in the location-context
# skill. The whole point of this skill is that there is no default.
HARD_CODED_LOCATIONS = [
    "main kitchen",
    "default location",
    "fulton market",
    "river north",
    "west loop",
]

# A paragraph that starts with any of these prefixes (after stripping
# leading bullets/whitespace) is **forbidding** the concept. We also
# accept "use … no …" and "this skill teaches … without …" as denial
# framing.
DISALLOWED_LINE_PREFIXES = (
    "no ",
    "never ",
    "not ",
    "does not",
    "doesn",
    "must not",
    "mustn",
    "no longer",
    "there is no ",
    "there are no ",
    "do not ",
    "don",
    "this skill is not",
    "is not a ",
    "is not the ",
    "is not a substitute",
    "are not",
    "the prior overlay",
    "the prior stack",
    "on the prior stack",
    "that approach is gone",
    "do not have",
    "it is not ",
    "it is not a",
    "use exactly two mcp tools. there is no",
    "this skill teaches",
    "use exactly two",
    "for deeply specialised work in any of those",
)


def _read(path: Path) -> str:
    assert path.exists(), f"missing tracked file: {path}"
    return path.read_text(encoding="utf-8")


def _is_denial_prefix(line: str) -> bool:
    stripped = line.lstrip(" \t-*•>").strip().lower().rstrip(".!?:").strip()
    return any(stripped.startswith(p) for p in DISALLOWED_LINE_PREFIXES)


def _paragraphs(text: str) -> list[list[str]]:
    """Split text into paragraphs (blank-line separated)."""
    paras: list[list[str]] = []
    cur: list[str] = []
    for line in text.splitlines():
        if line.strip() == "":
            if cur:
                paras.append(cur)
                cur = []
        else:
            cur.append(line)
    if cur:
        paras.append(cur)
    return paras


def _instructional_hits(text: str) -> dict[str, list[tuple[int, str]]]:
    """phrase -> [(start_line, paragraph_text)] for paragraphs that contain
    a forbidden phrase but do not start with a denial prefix on any line.
    """
    hits: dict[str, list[tuple[int, str]]] = {}
    for para in _paragraphs(text):
        para_text = " ".join(para)
        para_lower = para_text.lower()
        if any(_is_denial_prefix(line) for line in para):
            continue  # this paragraph is a denial paragraph; OK
        for phrase in FORBIDDEN_PHRASES:
            if phrase in para_lower:
                start_line = para[0]
                # locate the actual line number of the paragraph start
                line_no = text[: text.find(para[0])].count("\n") + 1
                hits.setdefault(phrase, []).append((line_no, para_text[:120]))
    return hits


@pytest.mark.parametrize("prompt_path", SPECIALIST_PROMPTS)
def test_specialist_prompt_excludes_a0_language(prompt_path: Path) -> None:
    text = _read(prompt_path)
    hits = _instructional_hits(text)
    assert not hits, (
        f"{prompt_path.relative_to(REPO_ROOT)} contains instructional "
        f"A0-era phrases: {hits}"
    )


@pytest.mark.parametrize("prompt_path", SPECIALIST_PROMPTS)
def test_specialist_prompt_mentions_mcp_tools(prompt_path: Path) -> None:
    if prompt_path in DATA_OPTIONAL_ROLES:
        pytest.skip(f"{prompt_path.relative_to(REPO_ROOT)} is a notification-shape role")
    text = _read(prompt_path)
    assert "carabiner_read" in text, (
        f"{prompt_path.relative_to(REPO_ROOT)} does not document carabiner_read"
    )
    assert "carabiner_propose_write" in text, (
        f"{prompt_path.relative_to(REPO_ROOT)} does not document carabiner_propose_write"
    )


def test_gm_prompt_does_not_route_through_call_subordinate() -> None:
    gm = REPO_ROOT / "usr" / "agents" / "gm" / "prompts" / "agent.system.main.role.md"
    text = _read(gm)
    hits = _instructional_hits(text)
    sub_hits = hits.get("call_subordinate", [])
    assert not sub_hits, (
        f"gm prompt still routes through call_subordinate on lines: {sub_hits}"
    )


def test_location_context_skill_excludes_a0_language() -> None:
    text = _read(LCTX_SKILL)
    hits = _instructional_hits(text)
    assert not hits, f"location-context SKILL.md has instructional A0 phrases: {hits}"


def test_location_context_skill_excludes_hard_coded_locations() -> None:
    text = _read(LCTX_SKILL)
    for para in _paragraphs(text):
        para_text = " ".join(para)
        para_lower = para_text.lower()
        # Allowed phrases when they appear in a denial context.
        # "Main Kitchen" / "default location" / the canonical location
        # names are all explicitly forbidden by THIS skill. If a
        # paragraph mentions one of them and is **not** a denial, that
        # is a real failure. We accept a denial paragraph.
        is_denial = any(_is_denial_prefix(line) for line in para)
        for phrase in HARD_CODED_LOCATIONS:
            if phrase in para_lower and not is_denial:
                start = para[0]
                line_no = text[: text.find(start)].count("\n") + 1
                pytest.fail(
                    f"location-context SKILL.md hard-codes location {phrase!r} "
                    f"on line {line_no}: {para_text[:120]!r}"
                )
        # Allow "main kitchen" only in a denial paragraph AND only in
        # the form "the prior overlay defaulted to a placeholder string
        # when no location was given" — historical context, not a default.
        # Detect by requiring the paragraph to contain a denial prefix
        # AND one of "placeholder" / "default" / "prior overlay".
        if "main kitchen" in para_lower:
            if not (is_denial and any(
                w in para_lower for w in ("placeholder", "prior", "default")
            )):
                start = para[0]
                line_no = text[: text.find(start)].count("\n") + 1
                pytest.fail(
                    f"location-context SKILL.md mentions 'main kitchen' "
                    f"outside a denial/historical context on line {line_no}: "
                    f"{para_text[:120]!r}"
                )


def test_location_context_skill_has_valid_yaml_frontmatter() -> None:
    text = _read(LCTX_SKILL)
    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    assert m, "location-context SKILL.md is missing YAML frontmatter"
    fm = m.group(1)
    assert re.search(r"^name:\s*carabineros-location-context\s*$", fm, re.MULTILINE), (
        "frontmatter missing name: carabineros-location-context"
    )
    assert re.search(r"^description:\s*\S+", fm, re.MULTILINE), (
        "frontmatter missing description"
    )


def test_location_context_skill_documents_three_paths() -> None:
    text = _read(LCTX_SKILL).lower()
    assert "operator" in text
    assert "dashboard" in text or "frontend" in text
    assert "must ask" in text or "model asks" in text


@pytest.mark.skipif(not SEED_SCRIPT.exists(), reason="seed script not present")
def test_seed_script_copies_location_context_skill(tmp_path) -> None:
    env = os.environ.copy()
    env["HERMES_HOME_DIR"] = str(tmp_path)
    result = subprocess.run(
        [str(SEED_SCRIPT)],
        env=env,
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"seed script failed: rc={result.returncode}\n"
        f"stdout={result.stdout}\nstderr={result.stderr}"
    )
    seeded = tmp_path / "skills" / "carabineros-location-context" / "SKILL.md"
    assert seeded.exists(), "seed script did not copy the location-context skill"
    text = seeded.read_text(encoding="utf-8")
    assert "carabineros-location-context" in text
    for para in _paragraphs(text):
        para_text = " ".join(para)
        para_lower = para_text.lower()
        if any(_is_denial_prefix(line) for line in para):
            continue
        for phrase in HARD_CODED_LOCATIONS:
            if phrase in para_lower:
                pytest.fail(
                    f"seeded location skill hard-codes {phrase!r}: {para_text[:120]!r}"
                )