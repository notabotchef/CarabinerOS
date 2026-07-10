"""Hermetic test for the CarabinerOS SOUL + skill seed.

The test is hermetic: it does not require Docker, the live
``var/hermes-home`` to exist, or any LLM. It only asserts that
the **tracked** Row #1 assets exist and the seed script copies
them in a fresh temp directory.

What is verified:
    * ``hermes/SOUL.md`` exists, mentions CarabinerOS, mentions
      the two MCP tools by name, and contains none of the
      forbidden A0-era phrases (``code_execution_tool``,
      ``call_subordinate``, ``notify_user``, ``Main Kitchen``,
      ``Agent Zero``, ``Nous Research``).
    * ``hermes/skills/carabineros-restaurant/SKILL.md`` exists
      with a valid YAML frontmatter, name ``carabineros-restaurant``,
      and documents both MCP tools by name.
    * Running ``scripts/seed_hermes_soul.sh`` against a temp
      ``HERMES_HOME_DIR`` produces a valid seeded copy at the
      expected paths and exits 0.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SOUL = REPO_ROOT / "hermes" / "SOUL.md"
SKILL = (
    REPO_ROOT
    / "hermes"
    / "skills"
    / "carabineros-restaurant"
    / "SKILL.md"
)
SEED_SCRIPT = REPO_ROOT / "scripts" / "seed_hermes_soul.sh"

# Phrases the A0 overlay used that MUST NOT appear in the new soul
# or skill (verbatim, case-insensitive). Excluded by stripping them
# from the A0 sources before porting.
FORBIDDEN = [
    "agent zero",
    "nous research",
    "code_execution_tool",
    "call_subordinate",
    "notify_user",
    "main kitchen",
    "hermes agent",  # default identity we are replacing
]

# Phrases the new soul MUST mention to count as a successful port.
SOUL_REQUIRED = [
    "carabineros",
    "carabiner_read",
    "carabiner_propose_write",
    "awaiting operator approval",
    "never",
]

SKILL_REQUIRED = [
    "carabineros-restaurant",
    "carabiner_read",
    "carabiner_propose_write",
    "awaiting_approval",
    "action_card",
]


def _read(path: Path) -> str:
    assert path.exists(), f"missing tracked file: {path}"
    return path.read_text(encoding="utf-8")


def test_soul_mentions_required_phrases() -> None:
    text = _read(SOUL)
    lowered = text.lower()
    for phrase in SOUL_REQUIRED:
        assert phrase.lower() in lowered, (
            f"hermes/SOUL.md missing required phrase: {phrase!r}"
        )


def test_soul_excludes_forbidden_phrases() -> None:
    text = _read(SOUL).lower()
    for phrase in FORBIDDEN:
        assert phrase not in text, (
            f"hermes/SOUL.md contains forbidden A0-era phrase: {phrase!r}"
        )


def test_skill_mentions_required_phrases() -> None:
    text = _read(SKILL)
    for phrase in SKILL_REQUIRED:
        assert phrase in text, (
            f"carabineros-restaurant/SKILL.md missing required phrase: {phrase!r}"
        )


def test_skill_excludes_forbidden_phrases() -> None:
    text = _read(SKILL).lower()
    for phrase in FORBIDDEN:
        assert phrase not in text, (
            f"carabineros-restaurant/SKILL.md contains forbidden phrase: {phrase!r}"
        )


def test_skill_has_valid_yaml_frontmatter() -> None:
    text = _read(SKILL)
    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    assert m, "SKILL.md is missing YAML frontmatter"
    frontmatter = m.group(1)
    # Quick sanity: name and version are present, description has content.
    assert re.search(r"^name:\s*carabineros-restaurant\s*$", frontmatter, re.MULTILINE), (
        "frontmatter missing 'name: carabineros-restaurant'"
    )
    assert re.search(r"^version:\s*\S+", frontmatter, re.MULTILINE), (
        "frontmatter missing 'version'"
    )
    assert re.search(r"^description:\s*\S+", frontmatter, re.MULTILINE), (
        "frontmatter missing 'description'"
    )


@pytest.mark.skipif(
    not SEED_SCRIPT.exists(),
    reason="scripts/seed_hermes_soul.sh not present",
)
def test_seed_script_copies_soul_and_skill(tmp_path: Path) -> None:
    home = tmp_path / "hermes-home"
    env = os.environ.copy()
    env["HERMES_HOME_DIR"] = str(home)

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

    seeded_soul = home / "SOUL.md"
    seeded_skill = home / "skills" / "carabineros-restaurant" / "SKILL.md"
    assert seeded_soul.exists(), "seed script did not produce SOUL.md"
    assert seeded_skill.exists(), "seed script did not produce the skill"

    soul_text = seeded_soul.read_text(encoding="utf-8")
    assert "CarabinerOS" in soul_text
    assert "code_execution_tool" not in soul_text.lower()

    skill_text = seeded_skill.read_text(encoding="utf-8")
    assert "carabineros-restaurant" in skill_text
