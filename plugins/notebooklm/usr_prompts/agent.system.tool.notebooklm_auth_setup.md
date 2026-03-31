## Tool: notebooklm_auth_setup

Launches a remote-browser Google authentication flow for NotebookLM.

A headless Chromium starts inside the container with remote debugging enabled.
The user connects from their host browser to complete Google sign-in (including 2FA).

### Usage
```json
{
  "tool_name": "notebooklm_auth_setup",
  "tool_args": {}
}
```

Returns: Instructions for the user to connect, then blocks until login completes or times out (10 min).

### When to use
- Before the first NotebookLM query
- When notebooklm_auth_status reports expired or missing auth
- When a notebooklm_ask call fails with an auth error
