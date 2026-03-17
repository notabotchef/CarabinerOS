"""Tests to verify Agent Zero discovers CarabinerOS overlay tools and extensions."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ENGINE_DIR = Path(__file__).resolve().parent.parent
OVERLAY_DIR = ENGINE_DIR / "carabiner" / "agent_overlay"


def test_overlay_tools_directory_exists():
    tools_dir = OVERLAY_DIR / "tools"
    assert tools_dir.exists(), f"Overlay tools directory not found at {tools_dir}"


def test_overlay_extensions_directory_exists():
    extensions_dir = OVERLAY_DIR / "extensions"
    assert extensions_dir.exists(), f"Overlay extensions directory not found at {extensions_dir}"


def test_ping_tool_file_exists():
    ping_tool = OVERLAY_DIR / "tools" / "ping_tool.py"
    assert ping_tool.exists(), f"ping_tool.py not found at {ping_tool}"


def test_restaurant_context_extension_exists():
    ext = OVERLAY_DIR / "extensions" / "system_prompt" / "_25_restaurant_context.py"
    assert ext.exists(), f"Restaurant context extension not found at {ext}"


def test_overlay_symlinks_created():
    """Verify bridge creates symlinks from agent-zero/usr/ to overlay."""
    sys.path.insert(0, str(ENGINE_DIR))
    from bridge import _create_overlay_symlinks, AGENT_ZERO_DIR

    _create_overlay_symlinks()

    usr_tools = AGENT_ZERO_DIR / "usr" / "tools"
    usr_extensions = AGENT_ZERO_DIR / "usr" / "extensions"

    assert usr_tools.is_symlink(), f"usr/tools symlink not created at {usr_tools}"
    assert usr_extensions.is_symlink(), f"usr/extensions symlink not created at {usr_extensions}"

    # Verify symlinks point to correct targets
    assert usr_tools.resolve() == (OVERLAY_DIR / "tools").resolve()
    assert usr_extensions.resolve() == (OVERLAY_DIR / "extensions").resolve()


def test_verify_overlay_discovery():
    """Verify the bridge can enumerate overlay files."""
    sys.path.insert(0, str(ENGINE_DIR))
    from bridge import AgentBridge

    bridge = AgentBridge()
    discovered = bridge.verify_overlay_discovery()

    assert "ping_tool" in discovered["tools"], (
        f"ping_tool not discovered. Found: {discovered['tools']}"
    )
    assert "system_prompt/_25_restaurant_context" in discovered["extensions"], (
        f"restaurant context extension not discovered. Found: {discovered['extensions']}"
    )


def test_health_endpoint():
    """Verify health endpoint responds correctly."""
    from fastapi.testclient import TestClient

    sys.path.insert(0, str(ENGINE_DIR))
    from carabiner.api.health import router
    from fastapi import FastAPI

    test_app = FastAPI()
    test_app.include_router(router)

    client = TestClient(test_app)
    response = client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "carabiner-engine"


def test_connector_domain_model():
    """Verify Pydantic domain models for connectors."""
    sys.path.insert(0, str(ENGINE_DIR))
    from carabiner.domain.connectors import (
        plan_external_action,
        ConnectorChannel,
        ConnectorStatus,
        list_connector_capabilities,
    )

    # Test plan_external_action
    plan = plan_external_action(
        provider_id="coastal-produce",
        action_type="place_order",
        payload_summary="Test produce order",
        requested_channel=ConnectorChannel.API,
        autonomous_enabled=False,
    )

    assert plan.provider_id == "coastal-produce"
    assert plan.status == ConnectorStatus.DRAFTED
    assert plan.channel == ConnectorChannel.API

    # Test fallback
    plan_fallback = plan_external_action(
        provider_id="prime-meats",
        action_type="place_order",
        payload_summary="Test meat order",
        requested_channel=ConnectorChannel.API,  # Not available for prime-meats
        autonomous_enabled=True,
    )
    assert plan_fallback.status == ConnectorStatus.FALLBACK_USED
    assert plan_fallback.channel == ConnectorChannel.EMAIL

    # Test list capabilities
    caps = list_connector_capabilities()
    assert len(caps) == 3
    provider_ids = {c["provider_id"] for c in caps}
    assert provider_ids == {"coastal-produce", "prime-meats", "heritage-bakery"}


def test_unknown_provider_raises():
    sys.path.insert(0, str(ENGINE_DIR))
    from carabiner.domain.connectors import plan_external_action

    with pytest.raises(KeyError, match="Unknown provider"):
        plan_external_action(
            provider_id="nonexistent",
            action_type="place_order",
            payload_summary="Should fail",
        )
