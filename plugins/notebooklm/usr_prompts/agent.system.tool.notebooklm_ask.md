## Tool: notebooklm_ask

Ask a question to a Google NotebookLM notebook. Uses Gemini grounded on your uploaded sources for source-cited answers.

### Usage
```json
{
  "tool_name": "notebooklm_ask",
  "tool_args": {
    "question": "What are the key patterns for error handling?",
    "notebook_url": "https://notebooklm.google.com/notebook/NOTEBOOK_ID",
    "session_id": "optional-session-id-for-follow-ups"
  }
}
```

### Parameters
- **question** (required) — The question to ask.
- **notebook_url** (optional) — URL of the notebook to query. If omitted, uses the server's default.
- **session_id** (optional) — Reuse a session for follow-up questions in the same context. If omitted, a new session is created.

### Session flow
1. First call: omit session_id to start a new session. Save the returned session_id.
2. Follow-up calls: pass the same session_id for contextual multi-turn research.
3. For a different topic, omit session_id to start fresh.

### Prerequisites
- Google auth must be valid. Check with notebooklm_auth_status.
- If auth is missing or expired, run notebooklm_auth_setup first.
