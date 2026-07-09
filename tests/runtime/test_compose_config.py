"""Compose config tests — verify the new ``docker-compose.hermes.yml`` parses.

Skipped when docker isn't installed (e.g. CI runners without it).
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
COMPOSE_FILE = REPO_ROOT / "docker-compose.hermes.yml"


pytestmark = pytest.mark.skipif(
    shutil.which("docker") is None, reason="docker not installed on this machine"
)


def test_compose_file_exists() -> None:
    assert COMPOSE_FILE.exists(), f"missing: {COMPOSE_FILE}"


def test_compose_config_parses() -> None:
    result = subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE_FILE), "config", "--format", "json"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, f"docker compose config failed:\n{result.stderr}"
    parsed = json.loads(result.stdout)
    services = parsed.get("services", {})
    # Required services per the migration plan
    for required in ("postgres", "bridge", "hermes", "frontend", "nginx"):
        assert required in services, f"missing service in compose: {required}"


def test_bridge_depends_on_postgres() -> None:
    result = subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE_FILE), "config", "--format", "json"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0
    parsed = json.loads(result.stdout)
    bridge = parsed["services"]["bridge"]
    depends = bridge.get("depends_on", {})
    # depends_on may be a dict (long syntax) or list (short syntax)
    if isinstance(depends, dict):
        assert "postgres" in depends, "bridge must depend_on postgres"
        condition = depends["postgres"].get("condition")
        assert condition == "service_healthy", f"postgres must be service_healthy, got {condition!r}"
    else:
        assert "postgres" in depends, "bridge must depend_on postgres"


def test_hermes_depends_on_bridge() -> None:
    result = subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE_FILE), "config", "--format", "json"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    parsed = json.loads(result.stdout)
    hermes = parsed["services"]["hermes"]
    depends = hermes.get("depends_on", {})
    if isinstance(depends, dict):
        assert "bridge" in depends
        assert depends["bridge"].get("condition") == "service_healthy"


def test_nginx_exposes_8080() -> None:
    result = subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE_FILE), "config", "--format", "json"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    parsed = json.loads(result.stdout)
    nginx = parsed["services"]["nginx"]
    ports = nginx.get("ports", [])
    assert any("8080" in str(p) for p in ports), f"nginx must expose :8080, got {ports}"