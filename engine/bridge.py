"""AgentBridge — connects FastAPI to Agent Zero via overlay pattern.

Responsibilities:
1. Registers CarabinerOS overlay directories (tools, extensions, prompts)
   into Agent Zero's search paths using symlinks in usr/.
2. Boots AgentContext/AgentConfig from CarabinerOS settings.
3. Exposes async methods for FastAPI to call Agent Zero.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

# Resolve paths relative to this file
ENGINE_DIR = Path(__file__).resolve().parent
AGENT_ZERO_DIR = ENGINE_DIR / "agent-zero"
OVERLAY_DIR = ENGINE_DIR / "carabiner" / "agent_overlay"


def _ensure_agent_zero_importable() -> None:
    """Add Agent Zero's root to sys.path so its internal imports work.

    Agent Zero uses absolute imports like `from python.helpers import ...`
    which require its root directory on sys.path.
    """
    az_root = str(AGENT_ZERO_DIR)
    if az_root not in sys.path:
        sys.path.insert(0, az_root)


def _create_overlay_symlinks() -> None:
    """Create symlinks from Agent Zero's usr/ directories to CarabinerOS overlay.

    Agent Zero searches `usr/tools/`, `usr/extensions/` etc. via get_paths().
    We symlink our overlay files there so they're discovered automatically.
    This is non-invasive: usr/ is gitignored in Agent Zero.
    """
    mappings = [
        ("tools", OVERLAY_DIR / "tools"),
        ("extensions", OVERLAY_DIR / "extensions"),
        ("prompts", OVERLAY_DIR / "prompts"),
    ]

    usr_dir = AGENT_ZERO_DIR / "usr"
    usr_dir.mkdir(exist_ok=True)

    for subdir, source_dir in mappings:
        if not source_dir.exists():
            logger.debug("Overlay source %s does not exist, skipping", source_dir)
            continue

        target = usr_dir / subdir

        if target.is_symlink():
            existing_target = target.resolve()
            if existing_target == source_dir.resolve():
                logger.debug("Symlink %s already points to %s", target, source_dir)
                continue
            target.unlink()

        if target.exists() and not target.is_symlink():
            logger.warning(
                "usr/%s already exists and is not a symlink — skipping overlay registration. "
                "Remove it manually if you want overlay tools/extensions.",
                subdir,
            )
            continue

        target.symlink_to(source_dir)
        logger.info("Registered overlay: %s -> %s", target, source_dir)


def bootstrap_agent_zero() -> None:
    """Initialize Agent Zero from the submodule with CarabinerOS overlay.

    Must be called before any Agent Zero imports (except path setup).
    """
    _ensure_agent_zero_importable()
    _create_overlay_symlinks()

    # Now we can safely import Agent Zero modules
    os.chdir(str(AGENT_ZERO_DIR))
    logger.info("Agent Zero working directory set to %s", AGENT_ZERO_DIR)


def get_agent_zero_module(module_name: str):
    """Import an Agent Zero module by name after bootstrap.

    Example: get_agent_zero_module('agent') -> the agent module.
    """
    _ensure_agent_zero_importable()
    import importlib

    return importlib.import_module(module_name)


class AgentBridge:
    """High-level interface between FastAPI and Agent Zero runtime."""

    def __init__(self) -> None:
        self._initialized = False

    async def initialize(self) -> None:
        """Boot Agent Zero context. Call once at FastAPI startup."""
        if self._initialized:
            return

        bootstrap_agent_zero()

        # Import Agent Zero modules now that paths are set up
        from python.helpers import settings as az_settings
        from python.helpers import dotenv as az_dotenv

        # Load Agent Zero's .env and settings
        az_dotenv.load()

        self._initialized = True
        logger.info("AgentBridge initialized successfully")

    @property
    def is_initialized(self) -> bool:
        return self._initialized

    def verify_overlay_discovery(self) -> dict[str, list[str]]:
        """Check which overlay files Agent Zero can discover.

        Returns dict with 'tools' and 'extensions' keys listing discovered files.
        """
        discovered: dict[str, list[str]] = {"tools": [], "extensions": []}

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
                            discovered["extensions"].append(
                                f"{ext_point.name}/{f.stem}"
                            )

        return discovered
