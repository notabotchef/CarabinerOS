"""Shared test fixtures and path setup for CarabinerOS tests."""
import sys
import types
from pathlib import Path

# Ensure project root is on sys.path
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Register a lightweight stub 'agent' module so that
# patch("agent.AgentContext") and `from agent import AgentConfig` work
# without importing the real A0 agent module (which pulls in litellm and
# other heavy deps). v1.8 of Agent Zero exposes AgentContext, AgentConfig
# and AgentContextType at the top of agent.py; we mirror that surface with
# inert stubs so downstream modules (e.g. initialize.py, run_ui.py) can
# import without dragging the full runtime into the test process.
if "agent" not in sys.modules:
    _agent_stub = types.ModuleType("agent")

    class _AgentContextStub:
        @staticmethod
        def first():
            return None

    class _AgentConfigStub:
        def __init__(self, *args, **kwargs):
            self.profile = kwargs.get("profile")
            self.knowledge_subdirs = kwargs.get("knowledge_subdirs", [])
            self.mcp_servers = kwargs.get("mcp_servers")
            self.additional = {}

    class _AgentContextTypeStub:
        USER = "user"
        AGENT = "agent"
        TASK = "task"
        MCP = "mcp"

    class _AgentStub:
        pass

    class _MessageStub:
        def __init__(self, *args, **kwargs):
            self.content = args[0] if args else kwargs.get("content", "")

    class _LoopDataStub:
        pass

    class _LogStub:
        pass

    _agent_stub.AgentContext = _AgentContextStub  # type: ignore[attr-defined]
    _agent_stub.AgentConfig = _AgentConfigStub  # type: ignore[attr-defined]
    _agent_stub.AgentContextType = _AgentContextTypeStub  # type: ignore[attr-defined]
    _agent_stub.Agent = _AgentStub  # type: ignore[attr-defined]
    # Message/data classes referenced by helpers.fasta2a_server and others
    _agent_stub.UserMessage = _MessageStub  # type: ignore[attr-defined]
    _agent_stub.SystemMessage = _MessageStub  # type: ignore[attr-defined]
    _agent_stub.BaseMessage = _MessageStub  # type: ignore[attr-defined]
    _agent_stub.LoopData = _LoopDataStub  # type: ignore[attr-defined]
    _agent_stub.Log = _LogStub  # type: ignore[attr-defined]
    sys.modules["agent"] = _agent_stub
