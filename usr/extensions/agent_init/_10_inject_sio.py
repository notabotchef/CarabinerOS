"""Inject the Socket.IO server reference into agent config.additional.

Runs at agent init. This makes ``self.agent.config.additional["sio"]``
available to every downstream extension that needs to emit real-time
events (action cards, chef status, workspace sync, etc.).
"""

from __future__ import annotations

import logging

from python.helpers.extension import Extension

logger = logging.getLogger(__name__)


def _get_sio():
    """Lazy import of the module-level socketio_server from run_ui.

    The import is deferred to execution time so there is no risk of
    circular imports during module loading.
    """
    try:
        from run_ui import socketio_server
        return socketio_server
    except ImportError:
        logger.debug("run_ui not available (running outside web server context)")
        return None


class InjectSio(Extension):
    async def execute(self, **kwargs) -> None:
        if self.agent.config.additional.get("sio"):
            return  # already injected (e.g. by a parent agent)

        sio = _get_sio()
        if sio is None:
            logger.debug("No socketio_server found; skipping sio injection")
            return

        self.agent.config.additional["sio"] = sio
        logger.info(
            "Injected sio into agent #%d config.additional",
            self.agent.number,
        )
