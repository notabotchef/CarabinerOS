"""AgentBridge — connects FastAPI to Agent Zero via overlay pattern.

Responsibilities:
1. Registers CarabinerOS overlay directories (tools, extensions, prompts, profiles)
   into Agent Zero's search paths using symlinks in usr/.
2. Boots AgentContext/AgentConfig from CarabinerOS settings.
3. Exposes async communicate() for FastAPI to call Agent Zero.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# Resolve paths relative to this file
ENGINE_DIR = Path(__file__).resolve().parent
AGENT_ZERO_DIR = ENGINE_DIR / "agent-zero"
OVERLAY_DIR = ENGINE_DIR / "carabiner" / "agent_overlay"

# LLM env var mapping: engine/.env key -> A0_SET_ key
_LLM_ENV_MAP = {
    "CHAT_MODEL_PROVIDER": "A0_SET_chat_model_provider",
    "CHAT_MODEL_NAME": "A0_SET_chat_model_name",
    "CHAT_MODEL_API_BASE": "A0_SET_chat_model_api_base",
    "UTILITY_MODEL_PROVIDER": "A0_SET_util_model_provider",
    "UTILITY_MODEL_NAME": "A0_SET_util_model_name",
    "UTILITY_MODEL_API_BASE": "A0_SET_util_model_api_base",
    "EMBEDDINGS_MODEL_PROVIDER": "A0_SET_embed_model_provider",
    "EMBEDDINGS_MODEL_NAME": "A0_SET_embed_model_name",
    "EMBEDDINGS_MODEL_API_BASE": "A0_SET_embed_model_api_base",
    "BROWSER_MODEL_PROVIDER": "A0_SET_browser_model_provider",
    "BROWSER_MODEL_NAME": "A0_SET_browser_model_name",
    "BROWSER_MODEL_API_BASE": "A0_SET_browser_model_api_base",
}


def _ensure_agent_zero_importable() -> None:
    """Add Agent Zero's root to sys.path so its internal imports work."""
    az_root = str(AGENT_ZERO_DIR)
    if az_root not in sys.path:
        sys.path.insert(0, az_root)


def _create_overlay_symlinks() -> None:
    """Create symlinks from Agent Zero's usr/ directories to CarabinerOS overlay."""
    mappings = [
        ("tools", OVERLAY_DIR / "tools"),
        ("extensions", OVERLAY_DIR / "extensions"),
        ("prompts", OVERLAY_DIR / "prompts"),
        ("agents", OVERLAY_DIR / "profiles"),
    ]

    usr_dir = AGENT_ZERO_DIR / "usr"
    usr_dir.mkdir(exist_ok=True)

    for subdir, source_dir in mappings:
        if not source_dir.exists():
            logger.debug("Overlay source %s does not exist, skipping", source_dir)
            continue

        target = usr_dir / subdir

        # For agents/profiles: symlink individual profiles into existing usr/agents/
        if subdir == "agents" and target.exists() and not target.is_symlink():
            for profile_dir in source_dir.iterdir():
                if profile_dir.is_dir() and not profile_dir.name.startswith("_"):
                    profile_target = target / profile_dir.name
                    if profile_target.is_symlink():
                        if profile_target.resolve() == profile_dir.resolve():
                            continue
                        profile_target.unlink()
                    if not profile_target.exists():
                        profile_target.symlink_to(profile_dir)
                        logger.info("Registered profile: %s -> %s", profile_target, profile_dir)
            continue

        if target.is_symlink():
            existing_target = target.resolve()
            if existing_target == source_dir.resolve():
                logger.debug("Symlink %s already points to %s", target, source_dir)
                continue
            target.unlink()

        if target.exists() and not target.is_symlink():
            logger.warning(
                "usr/%s already exists and is not a symlink — skipping overlay registration.",
                subdir,
            )
            continue

        target.symlink_to(source_dir)
        logger.info("Registered overlay: %s -> %s", target, source_dir)


def _write_agent_zero_env() -> None:
    """Write Agent Zero's usr/.env from engine/.env values with A0_SET_ prefix."""
    usr_dir = AGENT_ZERO_DIR / "usr"
    usr_dir.mkdir(exist_ok=True)
    env_file = usr_dir / ".env"

    lines = []
    for engine_key, az_key in _LLM_ENV_MAP.items():
        value = os.environ.get(engine_key)
        if value:
            lines.append(f"{az_key}={value}")

    if lines:
        env_file.write_text("\n".join(lines) + "\n")
        logger.info("Wrote %d LLM settings to %s", len(lines), env_file)
    else:
        logger.debug("No LLM env vars found — agent-zero/usr/.env not written")


def bootstrap_agent_zero() -> None:
    """Initialize Agent Zero from the submodule with CarabinerOS overlay."""
    _ensure_agent_zero_importable()
    _create_overlay_symlinks()
    _write_agent_zero_env()

    os.chdir(str(AGENT_ZERO_DIR))
    logger.info("Agent Zero working directory set to %s", AGENT_ZERO_DIR)


def get_agent_zero_module(module_name: str):
    """Import an Agent Zero module by name after bootstrap."""
    _ensure_agent_zero_importable()
    import importlib
    return importlib.import_module(module_name)


class AgentBridge:
    """High-level interface between FastAPI and Agent Zero runtime."""

    def __init__(self) -> None:
        self._initialized = False
        self._sio = None

    async def initialize(self, sio=None) -> None:
        """Boot Agent Zero context. Call once at FastAPI startup."""
        if self._initialized:
            return

        self._sio = sio
        bootstrap_agent_zero()

        from python.helpers import dotenv as az_dotenv
        az_dotenv.load_dotenv()

        self._initialized = True
        logger.info("AgentBridge initialized successfully")

    @property
    def is_initialized(self) -> bool:
        return self._initialized

    def _build_config(self, profile: str = "gm"):
        """Create an AgentConfig using Agent Zero's initialize_agent() with profile override."""
        from initialize import initialize_agent
        config = initialize_agent()
        config.profile = profile
        config.additional = {
            "organization_name": "Carabiner Restaurant Group",
            "sio": self._sio,
        }
        return config

    async def communicate(
        self,
        context_id: str,
        message: str,
        active_location: Optional[dict] = None,
    ) -> str:
        """Send a message to Agent Zero and return the response.

        Uses AgentContext.communicate() which runs the agent in a separate
        thread with its own event loop (via DeferredTask), avoiding
        nest_asyncio/uvloop conflicts.
        """
        from agent import AgentContext, UserMessage

        context = AgentContext.get(context_id)
        if context is None:
            config = self._build_config(profile="gm")
            context = AgentContext(config=config, id=context_id)

        # Inject location context
        if active_location:
            context.agent0.config.additional["active_location_name"] = active_location.get("name", "Unknown")
            context.agent0.config.additional["active_location_id"] = active_location.get("id")
            context.agent0.config.additional["active_location_status"] = active_location.get("status", "")

        # Ensure sio is set
        context.agent0.config.additional["sio"] = self._sio

        # Use AgentContext.communicate() — runs in DeferredTask thread
        user_msg = UserMessage(message=message, attachments=[])
        task = context.communicate(user_msg)

        # Await the deferred task result
        response = await task.result()
        return response

    def verify_overlay_discovery(self) -> dict[str, list[str]]:
        """Check which overlay files Agent Zero can discover."""
        discovered: dict[str, list[str]] = {"tools": [], "extensions": [], "profiles": []}

        tools_dir = OVERLAY_DIR / "tools"
        if tools_dir.exists():
            discovered["tools"] = [
                f.stem for f in tools_dir.glob("*.py") if f.stem != "__init__"
            ]

        extensions_dir = OVERLAY_DIR / "extensions"
        if extensions_dir.exists():
            for ext_point in extensions_dir.iterdir():
                if ext_point.is_dir() and ext_point.name != "__pycache__":
                    for f in ext_point.glob("*.py"):
                        if f.stem != "__init__":
                            discovered["extensions"].append(f"{ext_point.name}/{f.stem}")

        profiles_dir = OVERLAY_DIR / "profiles"
        if profiles_dir.exists():
            discovered["profiles"] = [
                d.name for d in profiles_dir.iterdir()
                if d.is_dir() and not d.name.startswith("_") and (d / "agent.json").exists()
            ]

        return discovered
