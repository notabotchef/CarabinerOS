"""
notebooklm_ask — Query a NotebookLM notebook via the upstream MCP server.

This tool:
 1. Checks that auth state exists and is valid.
 2. Launches (or reuses) the notebooklm-mcp subprocess in MCP stdio mode.
 3. Sends an ask_question call through the MCP protocol.
 4. Returns the notebook's answer.

The upstream notebooklm-mcp server handles all browser automation, typing,
response scraping, etc.  We just supply it with the persisted Chrome profile
so it picks up the authenticated session.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

from helpers.tool import Tool, Response
from helpers.print_style import PrintStyle

logger = logging.getLogger("notebooklm.ask")

# Module-level cache for the MCP subprocess
_mcp_proc: subprocess.Popen | None = None
_mcp_lock = asyncio.Lock()


async def _ensure_mcp_server(env_overrides: dict) -> subprocess.Popen:
    """Start the notebooklm-mcp server as a subprocess if not already running.

    We communicate via MCP stdio transport: write JSON-RPC to stdin,
    read JSON-RPC from stdout.
    """
    global _mcp_proc

    async with _mcp_lock:
        if _mcp_proc is not None and _mcp_proc.poll() is None:
            return _mcp_proc

        npx = shutil.which("npx")
        if not npx:
            raise RuntimeError(
                "npx not found. Install Node.js >= 18 in the container."
            )

        env = {**os.environ, **env_overrides}

        logger.info("Starting notebooklm-mcp subprocess ...")
        _mcp_proc = subprocess.Popen(
            [npx, "-y", "notebooklm-mcp@latest"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True,
            bufsize=1,
        )

        # Wait for the MCP server to send its initialize response.
        # The MCP stdio transport starts with a server -> client init message.
        # We need to send an initialize request first.
        init_request = {
            "jsonrpc": "2.0",
            "id": 0,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "notebooklm-a0-plugin",
                    "version": "0.1.0",
                },
            },
        }
        _write_message(_mcp_proc, init_request)

        # Read init response (with timeout)
        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(_read_message, _mcp_proc),
                timeout=30,
            )
            logger.info("MCP server initialized: %s", json.dumps(resp)[:200])
        except asyncio.TimeoutError:
            _mcp_proc.kill()
            _mcp_proc = None
            raise RuntimeError(
                "notebooklm-mcp server did not respond to initialize within 30s."
            )

        # Send initialized notification
        _write_message(_mcp_proc, {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
        })

        return _mcp_proc


def _write_message(proc: subprocess.Popen, msg: dict) -> None:
    """Write a JSON-RPC message using MCP stdio framing (Content-Length header)."""
    body = json.dumps(msg)
    header = f"Content-Length: {len(body.encode())}\r\n\r\n"
    proc.stdin.write(header + body)
    proc.stdin.flush()


def _read_message(proc: subprocess.Popen) -> dict:
    """Read one JSON-RPC message from the MCP server's stdout.

    Parses Content-Length framing.
    """
    # Read headers until blank line
    content_length = 0
    while True:
        line = proc.stdout.readline()
        if not line or line.strip() == "":
            break
        if line.lower().startswith("content-length:"):
            content_length = int(line.split(":")[1].strip())

    if content_length == 0:
        # Try reading a bare JSON line (some MCP servers do this)
        line = proc.stdout.readline()
        if line:
            return json.loads(line)
        raise RuntimeError("MCP server closed stdout unexpectedly.")

    body = proc.stdout.read(content_length)
    return json.loads(body)


async def _call_tool(proc: subprocess.Popen, tool_name: str, arguments: dict) -> dict:
    """Send a tools/call request and return the result."""
    req_id = str(uuid.uuid4())[:8]
    request = {
        "jsonrpc": "2.0",
        "id": req_id,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments,
        },
    }
    _write_message(proc, request)

    # Read responses until we get the one matching our ID.
    # (The server may send progress notifications in between.)
    while True:
        resp = await asyncio.wait_for(
            asyncio.to_thread(_read_message, proc),
            timeout=180,  # NotebookLM can be slow
        )
        # Skip notifications (no "id" field)
        if "id" not in resp:
            continue
        if str(resp.get("id")) == req_id:
            return resp


class NotebookLMAsk(Tool):

    async def execute(self, question: str = "", notebook_url: str = "",
                      session_id: str = "", **kwargs) -> Response:
        if not question:
            return Response(
                message="Please provide a question to ask NotebookLM.",
                break_loop=False,
            )

        # 1. Check auth state.
        from plugins.notebooklm.tools._helpers import get_state_manager, get_data_paths

        sm = get_state_manager()
        state_path = sm.get_valid_state_path()
        if state_path is None:
            return Response(
                message=(
                    "NotebookLM is not authenticated. "
                    "Run notebooklm_auth_setup first, then try again."
                ),
                break_loop=False,
            )

        # 2. Build env overrides so the upstream MCP server uses our
        #    persisted Chrome profile.
        state_dir, profile_dir = get_data_paths()
        env_overrides = {
            "HEADLESS": "true",
            "NOTEBOOKLM_DATA_DIR": state_dir,
            "NOTEBOOKLM_CHROME_PROFILE": profile_dir,
        }

        if notebook_url:
            env_overrides["NOTEBOOK_URL"] = notebook_url

        # 3. Start or reuse the MCP subprocess.
        try:
            proc = await _ensure_mcp_server(env_overrides)
        except RuntimeError as exc:
            return Response(message=f"Failed to start NotebookLM MCP server: {exc}", break_loop=False)

        # 4. Call ask_question via MCP.
        PrintStyle(font_color="#F39C12").print(
            f"Asking NotebookLM: {question[:80]}..."
        )

        arguments: dict = {"question": question}
        if session_id:
            arguments["session_id"] = session_id
        if notebook_url:
            arguments["notebook_url"] = notebook_url

        try:
            result = await _call_tool(proc, "ask_question", arguments)
        except asyncio.TimeoutError:
            return Response(
                message="NotebookLM query timed out after 3 minutes.",
                break_loop=False,
            )
        except Exception as exc:
            return Response(
                message=f"NotebookLM query failed: {exc}",
                break_loop=False,
            )

        # 5. Parse MCP result.
        if "error" in result:
            err = result["error"]
            return Response(
                message=f"NotebookLM error: {err.get('message', err)}",
                break_loop=False,
            )

        # The result payload has result.content[].text
        content_items = result.get("result", {}).get("content", [])
        texts = [c.get("text", "") for c in content_items if c.get("type") == "text"]
        answer = "\n".join(texts).strip() or "(no response from NotebookLM)"

        return Response(message=answer, break_loop=False)
