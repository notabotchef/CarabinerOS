# Agent0 Codex Patch

![Agent0 Codex Patch banner](./banner.png)

Plugin-style Codex integration for stable Agent0.

It installs a local OpenAI-compatible Codex proxy, OAuth login flow, and a `Settings -> External Services -> Codex Proxy` panel without rebuilding Docker. Install into the live Agent0 root, then restart the backend.

## Install with Agent Zero

Copy and paste this into Agent Zero:

```text
Install Agent0 Codex Proxy from https://github.com/Nunezchef/agent0-codex-patch using main branch only. Do a clean install: remove /a0/usr/workdir/.a0-install first if it exists, clone fresh into /a0/usr/workdir/.a0-install, run bash /a0/usr/workdir/.a0-install/install.sh /a0, and do not treat the repo as a standalone app. After install, verify these files exist in /a0: python/api/codex_oauth.py, python/helpers/codex_provider.py, python/extensions/message_loop_start/_15_codex_proxy.py, webui/components/settings/external/codex.html, and confirm webui/components/settings/external/external-settings.html contains section-codex. Finally, tell the user a full Agent0 backend restart is required.
```

## Quick Install

```bash
cd /a0/usr/workdir
rm -rf .a0-install
git clone --branch main https://github.com/Nunezchef/agent0-codex-patch.git .a0-install
bash /a0/usr/workdir/.a0-install/install.sh /a0
```

Then restart Agent0.

Important:

- This repo installs into the live Agent0 root.
- It does not require rebuilding Docker.
- It does require a full Agent0 backend restart.
- Do not run it from `usr/workdir` as a standalone app.

## What It Installs

- `python/api/codex_oauth.py`
- `python/api/codex_status.py`
- `python/api/codex_configure.py`
- `python/helpers/codex_provider.py`
- `python/helpers/codex_oauth_manager.py`
- `python/helpers/codex_proxy_server.py`
- `python/extensions/message_loop_start/_15_codex_proxy.py`
- `webui/components/settings/external/codex.html`
- `webui/components/settings/external/codex-store.js`

It also patches these host files once, idempotently:

- `webui/components/settings/external/external-settings.html`
- `conf/model_providers.yaml`
- `python/extensions/banners/_20_missing_api_key.py`
- `webui/components/settings/settings-store.js`

## Supported Models

- `gpt-5.3-codex`
- `gpt-5.2-codex`
- `gpt-5.1-codex`
- `gpt-5.1-codex-mini`
- `gpt-5.2`
- `gpt-5.1`

Recommended defaults:

- Chat: `gpt-5.3-codex`
- Utility: `gpt-5.1-codex-mini`
- Browser: `gpt-5.1-codex-mini`

## Verification

After restart:

1. Open `Settings -> External Services`.
2. Confirm `Codex Proxy` appears.
3. Open the Codex section and sign in or import `~/.codex/auth.json`.
4. Apply the Codex models.

CLI checks:

```bash
test -f /a0/python/api/codex_oauth.py
test -f /a0/python/helpers/codex_provider.py
test -f /a0/python/extensions/message_loop_start/_15_codex_proxy.py
test -f /a0/webui/components/settings/external/codex.html
grep -q "section-codex" /a0/webui/components/settings/external/external-settings.html
```

## Credits

- Original Codex provider plugin concept and implementation: [protolabs42/codex-provider](https://github.com/protolabs42/codex-provider)
- Agent0 upstream project: [agent0ai/agent-zero](https://github.com/agent0ai/agent-zero)
- Runtime install pattern inspiration: [Nunezchef/Ea0](https://github.com/Nunezchef/Ea0)

This repo adapts the Codex provider idea to stable Agent0 with an Ea0-style runtime installer so the UI can appear in External Services without rebuilding Docker.

## v0.1.1 Features

- **LiteLLM Compatibility Fix**: Automatically injects `created_at` timestamp into upstream payloads to fix proxy crashes in Agent Zero.
- **Stop Proxy Button**: Cleanly stop the proxy and restore your previous local/cloud configurations on the fly without having to disconnect and lose your OAuth auth tokens.
