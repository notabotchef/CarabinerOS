"""Test that agent profiles, tools, and extensions exist and are properly structured."""

import json
import sys
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ENGINE_DIR))

OVERLAY_DIR = ENGINE_DIR / "carabiner" / "agent_overlay"


def test_profiles_exist():
    profiles_dir = OVERLAY_DIR / "profiles"
    expected = {"gm", "agm", "executivechef", "souschef", "marketing"}
    found = {p.name for p in profiles_dir.iterdir() if p.is_dir()}
    assert expected.issubset(found), f"Missing profiles: {expected - found}"


def test_profile_has_agent_json():
    profiles_dir = OVERLAY_DIR / "profiles"
    for name in ["gm", "agm", "executivechef", "souschef", "marketing"]:
        agent_json = profiles_dir / name / "agent.json"
        assert agent_json.exists(), f"Missing agent.json for profile {name}"
        data = json.loads(agent_json.read_text())
        assert "title" in data, f"agent.json for {name} missing 'title'"
        assert "description" in data, f"agent.json for {name} missing 'description'"


def test_profile_has_role_prompt():
    profiles_dir = OVERLAY_DIR / "profiles"
    for name in ["gm", "agm", "executivechef", "souschef", "marketing"]:
        role_md = profiles_dir / name / "prompts" / "agent.system.main.role.md"
        assert role_md.exists(), f"Missing role prompt for profile {name}"
        content = role_md.read_text()
        assert len(content) > 50, f"Role prompt for {name} is too short"


def test_tools_exist():
    tools_dir = OVERLAY_DIR / "tools"
    expected = {"order_tool", "inventory_tool", "prep_tool", "food_cost_tool", "menu_tool", "marketing_tool"}
    found = {f.stem for f in tools_dir.glob("*.py") if f.stem != "__init__" and f.stem != "ping_tool"}
    assert expected.issubset(found), f"Missing tools: {expected - found}"


def test_tools_have_execute_class():
    """Verify each tool file defines a class inheriting Tool with execute method."""
    tools_dir = OVERLAY_DIR / "tools"
    for tool_name in ["order_tool", "inventory_tool", "prep_tool", "food_cost_tool", "menu_tool", "marketing_tool"]:
        content = (tools_dir / f"{tool_name}.py").read_text()
        assert "class " in content, f"{tool_name}.py missing class definition"
        assert "async def execute" in content, f"{tool_name}.py missing execute method"
        assert "from helpers.tool import" in content, f"{tool_name}.py missing Tool import"


def test_extensions_exist():
    ext_dir = OVERLAY_DIR / "extensions"
    assert (ext_dir / "system_prompt" / "_25_restaurant_context.py").exists()
    assert (ext_dir / "tool_execute_after" / "_25_workspace_sync.py").exists()
    assert (ext_dir / "response_stream_chunk" / "_25_response_cleaning.py").exists()


def test_gm_prompt_mentions_subordinates():
    """GM prompt should mention all subordinate agent names."""
    gm_prompt = (OVERLAY_DIR / "profiles" / "gm" / "prompts" / "agent.system.main.role.md").read_text()
    for agent_name in ["agm", "executivechef", "souschef", "marketing"]:
        assert agent_name in gm_prompt, f"GM prompt missing reference to {agent_name}"


def test_bridge_has_communicate():
    """Verify bridge.py has communicate method."""
    bridge_file = ENGINE_DIR / "bridge.py"
    content = bridge_file.read_text()
    assert "async def communicate" in content, "bridge.py missing communicate method"
    assert "_build_config" in content, "bridge.py missing _build_config method"
    assert "hist_add_user_message" in content, "bridge.py missing hist_add_user_message call"
