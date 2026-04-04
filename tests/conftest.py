"""Shared test fixtures and path setup for CarabinerOS tests."""
import sys
import types
from pathlib import Path

# Ensure project root is on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Register a lightweight stub 'agent' module so that
# patch("agent.AgentContext") works without importing the real A0 agent
# (which pulls in litellm and other heavy deps).
if "agent" not in sys.modules:
    _agent_stub = types.ModuleType("agent")

    class _AgentContextStub:
        @staticmethod
        def first():
            return None

    _agent_stub.AgentContext = _AgentContextStub  # type: ignore[attr-defined]
    sys.modules["agent"] = _agent_stub
