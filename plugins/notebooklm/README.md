# NotebookLM Plugin for Agent Zero / CarabinerOS

Query Google NotebookLM notebooks from your A0 agent, with a remote browser
authentication flow designed for Docker environments.

## The Problem

NotebookLM requires Google sign-in. Google sign-in requires a real browser
(2FA, CAPTCHA, device verification). When A0 runs inside Docker, there is no
display for a GUI browser.

## The Solution

Remote Chrome DevTools Protocol (CDP). The plugin:

1. Launches headless Chromium **inside** the container with
   `--remote-debugging-port=9222`
2. Navigates to the Google sign-in page
3. The user opens `http://localhost:9222` on their host machine
4. They see the Google login page rendered inside the container's browser
5. They log in normally (2FA works, CAPTCHAs work)
6. All cookies and state stay inside the container
7. The plugin persists the browser state to `data/` (survives restarts)

## Architecture

```
Host Machine                  Docker Container (A0)
+------------------+         +---------------------------+
|                  |  :9222   |                           |
|  Chrome/Edge  --------->  Chromium (headless, CDP)    |
|  (user logs in)  |         |   |                       |
|                  |         |   v                       |
+------------------+         | notebooklm-mcp (MCP)     |
                             |   |                       |
                             |   v                       |
                             | A0 tools (Python)         |
                             |   notebooklm_ask          |
                             |   notebooklm_auth_setup   |
                             |   notebooklm_auth_status  |
                             +---------------------------+
```

## Installation

```bash
bash plugins/notebooklm/install.sh
```

Then add to `docker-compose.dev.yml`:

```yaml
services:
  agent-zero:
    ports:
      - "9222:9222"    # NotebookLM remote auth
    volumes:
      - ./plugins:/app/plugins
```

## Tools

| Tool | Description |
|------|-------------|
| `notebooklm_auth_setup` | Launch remote auth flow. Blocks until login completes. |
| `notebooklm_auth_status` | Check if Google auth is valid / expired. |
| `notebooklm_ask` | Query a notebook. Params: `question`, `notebook_url`, `session_id`. |
| `notebooklm_list_notebooks` | List notebooks (stub in v0.1). |

## Usage

In A0 chat:

1. "Set up NotebookLM authentication" -- triggers `notebooklm_auth_setup`
2. Open `http://localhost:9222` in your browser, log into Google
3. "Ask my research notebook: what are the key findings on X?" -- triggers `notebooklm_ask`

## File Structure

```
plugins/notebooklm/
  __init__.py
  plugin.yaml              # A0 plugin manifest
  default_config.yaml      # Default settings
  execute.py               # One-time setup (install deps, browser)
  install.sh               # Install into A0 instance
  requirements.txt         # Python deps (patchright, pyyaml)
  auth/
    remote_auth.py         # Remote CDP auth flow
    state_manager.py       # Browser state persistence
  tools/
    _helpers.py            # Shared config/factory helpers
    ask.py                 # notebooklm_ask tool (MCP proxy)
    auth_setup.py          # notebooklm_auth_setup tool
    auth_status.py         # notebooklm_auth_status tool
    list_notebooks.py      # notebooklm_list_notebooks (stub)
  extensions/
    system_prompt/
      _50_notebooklm_context.py  # Injects tool docs into system prompt
  usr_tools/               # Proxy files copied to usr/tools/
  usr_prompts/             # Prompt files copied to usr/prompts/
  data/                    # Created at install; volume-mounted
    browser_state/         # Cookies, localStorage, sessionStorage
    chrome_profile/        # Persistent Chromium profile
```

## Key Design Decisions

1. **MCP subprocess proxy, not reimplementation.** The `notebooklm_ask` tool
   spawns the upstream `notebooklm-mcp` server as a subprocess and communicates
   via MCP stdio transport. This avoids duplicating the complex browser scraping
   logic and stays compatible with upstream updates.

2. **Remote CDP instead of VNC.** Chrome DevTools Protocol is lighter than VNC,
   works with any Chromium-based browser on the host, and does not require X11.

3. **Persistent Chrome profile.** Google tracks browser fingerprints. Using a
   persistent profile directory means the container looks like the same browser
   across restarts, reducing re-auth frequency.

4. **Tool proxy files.** A0 discovers tools by scanning `usr/tools/{name}.py`.
   The proxy files are one-liners that re-export from the plugin package, keeping
   all real logic inside `plugins/notebooklm/`.

## Requirements

- Node.js >= 18 (for npx / notebooklm-mcp)
- Python >= 3.10 (for patchright)
- Chromium (installed by patchright)
- Port 9222 exposed from Docker to host
