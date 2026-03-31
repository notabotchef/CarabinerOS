# NotebookLM MCP Server - Connection & Authentication Analysis

## Overview
The NotebookLM MCP server is a **TypeScript Node.js application** that automates interactions with Google's NotebookLM service via **Patchright browser automation**. It provides an MCP interface for CLI agents (Claude, Cursor, Codex) to query NotebookLM notebooks without hallucinations.

---

## 1. Connection Mechanism

### How It Connects to NotebookLM

**Method: Browser Automation via Patchright (Chromium-based)**

The server does NOT use an API. Instead, it:
1. **Launches a headless Chromium browser** (via Patchright v1.48.2)
2. **Loads NotebookLM in the browser** (`https://notebooklm.google.com/`)
3. **Simulates human interactions** by typing questions and submitting them through the web UI
4. **Extracts responses** from the DOM using CSS selectors

### Architecture Flow

```
User Query
  ↓
Claude/Cursor (MCP Client)
  ↓
NotebookLM MCP Server (Node.js)
  ↓
SessionManager (manages browser instances)
  ↓
BrowserSession (Patchright/Chromium automation)
  ↓
Google NotebookLM Web UI
  ↓
Gemini 2.5 (backend inference)
  ↓
Your uploaded documents
  ↓
Response (extracted from DOM, returned to Claude)
```

### Key Interaction Flow

1. **Question Input**: User passes question via `ask_question` MCP tool
2. **Browser Navigation**: Server navigates to a shared NotebookLM notebook URL
3. **Human-Like Typing**: Question is typed into `textarea.query-box-input` with realistic WPM (160-240 words/min)
4. **Submission**: Enter key is pressed to submit
5. **Response Detection**: Server polls the DOM waiting for:
   - `.to-user-container .message-text-content` (primary selector)
   - Detects streaming by comparing text hashes across polls
   - Waits for text to stabilize for 3 consecutive polls before returning
6. **Response Extraction**: Latest response is extracted and returned to Claude

---

## 2. Authentication Method

### Mechanism: Browser-Based Google OAuth + Session Persistence

**NOT API-based authentication**. Uses Google's interactive login flow:

#### Step 1: Interactive Setup (One-Time)
When `setup_auth` tool is called:
1. Patchright launches a **visible Chrome window** (headful)
2. Navigates to: `https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fnotebooklm.google.com%2F&flowName=GlifWebSignIn&flowEntry=ServiceLogin`
3. **User manually logs in with Google credentials** in the browser
4. Google sets cookies and redirects to NotebookLM
5. Server captures and persists browser state

#### Step 2: State Persistence
After successful login, the server saves:

**Cookies** (critical for NotebookLM):
```javascript
const CRITICAL_COOKIE_NAMES = [
  "SID", "HSID", "SSID",           // Google session cookies
  "APISID", "SAPISID",              // Google API auth
  "OSID", "__Secure-OSID",          // NotebookLM-specific
  "__Secure-1PSID", "__Secure-3PSID" // Secure variants
];
```

**Storage State** (via Patchright `context.storageState()`):
- localStorage
- IndexedDB
- sessionStorage

**File Location**: `~/.local/share/notebooklm-mcp/browser_state/` (or platform-specific equiv)
- `state.json` - All persistent storage (cookies + localStorage + IndexedDB)
- `session.json` - sessionStorage data (Google session tokens)

#### Step 3: Session Reuse
For subsequent questions:
1. Server loads saved state from `state.json` and `session.json`
2. Creates a new browser context with pre-loaded cookies
3. Validates cookie expiry before using (24-hour timeout on state file)
4. If expired, prompts for re-authentication
5. If still valid, navigates directly to notebook URL and asks questions

#### Optional: Auto-Login (Credentials-Based)
For automation workflows, can set environment variables:
```bash
AUTO_LOGIN_ENABLED=true
LOGIN_EMAIL=your@email.com
LOGIN_PASSWORD=your_password
```
Server will automatically login if session expires. (⚠️ Not recommended for primary accounts)

---

## 3. Setup Requirements

### System Requirements
- **Node.js**: v18.0.0 or higher
- **Platform Support**: macOS, Linux, Windows
- **Browser**: Chromium (bundled by Patchright)

### Installation

#### For Claude Code (Recommended)
```bash
claude mcp add notebooklm npx notebooklm-mcp@latest
```

#### For Other MCP Clients
```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["-y", "notebooklm-mcp@latest"]
    }
  }
}
```

#### Package.json Dependencies
```json
{
  "@modelcontextprotocol/sdk": "^1.0.0",
  "patchright": "^1.48.2",        // Browser automation (Chromium)
  "dotenv": "^16.4.0",            // Environment variables
  "env-paths": "^3.0.0",          // Cross-platform config paths
  "globby": "^14.1.0",            // File globbing
  "zod": "^3.22.0"                // Schema validation
}
```

### Data Directories

Created automatically at:
- **Linux**: `~/.local/share/notebooklm-mcp/`
- **macOS**: `~/Library/Application Support/notebooklm-mcp/`
- **Windows**: `%APPDATA%\notebooklm-mcp\`

Subdirectories:
- `browser_state/` - Authentication state (cookies, localStorage)
- `chrome_profile/` - Chromium profile
- `chrome_profile_instances/` - Per-instance isolated profiles
- Settings: `~/.config/notebooklm-mcp/settings.json`

### Configuration

**No config file needed** — works out of the box. Optional tweaks via environment variables:

```bash
# Browser behavior
HEADLESS=true                    # Run browser hidden (default)
NOTEBOOKLM_PROFILE=minimal      # minimal|standard|full (tool set size)

# Session management
MAX_SESSIONS=10                  # Max concurrent browser sessions
SESSION_TIMEOUT=900             # Session idle timeout (seconds)

# Stealth settings
STEALTH_ENABLED=true            # Human-like delays & typing
TYPING_WPM_MIN=160
TYPING_WPM_MAX=240

# Auto-login (optional)
AUTO_LOGIN_ENABLED=false        # Don't use on primary account!
LOGIN_EMAIL=your@email.com
LOGIN_PASSWORD=your_password
```

### One-Time Setup Flow

```
1. Install: claude mcp add notebooklm npx notebooklm-mcp@latest
2. User says: "Log me in to NotebookLM"
3. Server launches visible Chrome → Google login appears
4. User logs in manually (2FA supported)
5. Server captures & persists browser state
6. Create notebook at notebooklm.google.com → Upload docs
7. Share notebook → Copy link
8. User says: "Add this NotebookLM: [link]"
9. Done! Claude can query it forever (unless state expires after 24h)
```

---

## 4. Key Technical Details

### Browser Automation Library: Patchright
- **Chromium-based** (not Firefox, not Chrome)
- **Stealth mode enabled** to avoid detection:
  - Humanized typing speeds (160-240 WPM)
  - Random delays between interactions (100-400ms)
  - Mouse movement simulation
  - Persistent browser fingerprint
  - `--disable-blink-features=AutomationControlled` flag

### Session Management
- **Shared context** across sessions (reduces memory/startup overhead)
- **Per-session pages** (tabs) within the shared context
- **Auto-recovery**: If browser crashes, automatically recreates context
- **Session timeout**: Default 15 minutes of inactivity
- **Max concurrent sessions**: 10 (configurable)

### Response Extraction Selectors
```javascript
const RESPONSE_SELECTORS = [
  ".to-user-container .message-text-content",  // Primary
  "[data-message-author='bot']",
  "[data-message-author='assistant']",
  "[aria-live='polite']",
  // ... fallback selectors
];
```

### Rate Limiting
- **Free tier**: 50 queries/day per Google account
- **Paid (AI Pro/Ultra)**: 5x higher limits
- Server detects rate limit error and throws `RateLimitError`
- Solution: `re_auth` tool to switch Google account

### Timeout Values
```typescript
Browser navigation:     30 seconds
Chat input ready wait:  10 seconds
Response polling:       2 minutes total
Stealth delays:         100-400ms between actions
```

---

## 5. MCP Tools Provided

### Core Tools (All profiles)
- `ask_question` - Query a NotebookLM notebook
- `get_health` - Check server status
- `list_notebooks` - Show library
- `select_notebook` - Set active notebook
- `get_notebook` - Get notebook metadata

### Standard Profile (+10 tools)
- `setup_auth` - Interactive Google login
- `add_notebook` - Save notebook to library
- `update_notebook` - Modify notebook metadata
- `search_notebooks` - Find notebooks by tag
- `list_sessions` - Show active sessions

### Full Profile (+16 tools)
- `cleanup_data` - Deep clean browser state
- `re_auth` - Switch Google account
- `remove_notebook` - Delete from library
- `reset_session` - Clear session cache
- `close_session` - End session
- `get_library_stats` - Library analytics

---

## 6. Security Considerations

### What's Transmitted
- ✅ Questions (to NotebookLM)
- ✅ Responses (from NotebookLM)
- ✅ Google cookies (stored locally)
- ✅ Your NotebookLM notebook URL

### What's NOT Transmitted
- ❌ Credentials never leave your machine (browser automation = local)
- ❌ Files never uploaded by this tool (you upload manually to NotebookLM.google.com)
- ❌ No third-party API access required

### Browser Detection Risk
⚠️ **Google may flag automated access**: Patchright includes stealth features, but Google could still detect and block bot traffic. The project recommends:
- Use a **dedicated Google account** for automation (not your primary)
- Treat it like web scraping: probably fine, but better safe than sorry
- Keep it within the free tier's daily limits to avoid suspicion

---

## 7. Comparison to Alternatives

| Approach | Token Cost | Setup | Hallucinations | Answer Quality |
|----------|-----------|-------|----------------|----------------|
| Feed docs to Claude | 🔴 High (repeated reading) | Instant | Yes ❌ | Variable |
| Web search | 🟡 Medium | Instant | High ❌ | Unreliable |
| Local RAG | 🟡 Medium | Hours (embeddings, DB) | Medium ❌ | Depends on setup |
| **NotebookLM MCP** | 🟢 Minimal | 5 min (one login) | **Zero** ✅ | Expert synthesis |

**Why NotebookLM wins:**
1. Pre-indexed by Gemini (you upload once)
2. Semantic understanding across 50+ documents
3. Natural synthesis, not just retrieval
4. Multi-source correlation built-in
5. Citation-backed answers

---

## 8. Current Limitations & Workarounds

| Limitation | Cause | Workaround |
|-----------|-------|-----------|
| 50 queries/day | Free tier rate limit | Upgrade to AI Pro/Ultra, or switch accounts |
| 24h auth expiry | Google session timeout | `setup_auth` to re-login |
| Browser detection | Stealth detection evasion | Use dedicated account, avoid rapid queries |
| One notebook at a time | Current design | Can swap with `select_notebook` tool |
| Manual Google login | No API access | Browser automation necessary; can't automate 2FA |

---

## 9. Example Flow: Asking a Question

```typescript
// User: "Ask NotebookLM: How do I use Patchright?"

// 1. Claude calls MCP tool
ask_question({
  question: "How do I use Patchright?",
  notebook_url: "https://notebooklm.google.com/notebook/abc123",
  show_browser: false
})

// 2. Server loads browser state (cookies from ~/.local/share/...)
// 3. Patchright launches headless Chromium
// 4. Context loads cookies → navigates to notebook
// 5. Waits for textarea.query-box-input to appear
// 6. Types question with 160-240 WPM (realistic)
// 7. Presses Enter
// 8. Polls .to-user-container.message-text-content every 1000ms
// 9. Detects streaming (text hashes change)
// 10. Waits for stability (3 polls with identical hash)
// 11. Extracts response text
// 12. Returns to Claude

// Result:
{
  success: true,
  answer: "Patchright is a library for browser automation...",
  session_id: "session-xyz789",
  tokens_used: 245
}
```

---

## Summary

| Aspect | Details |
|--------|---------|
| **Connection** | Patchright (Chromium) browser automation, headless by default |
| **API** | None — scrapes NotebookLM web UI via DOM selectors |
| **Auth** | Google OAuth (browser login) → cookies persisted locally for 24h |
| **Setup** | 5 minutes: `claude mcp add`, one manual Google login, share a notebook URL |
| **Cost** | Free (uses Google's free NotebookLM tier, 50 queries/day) |
| **Rate Limits** | 50 queries/day free, 250/day Pro, 500/day Ultra |
| **Token Efficiency** | Extremely low (NotebookLM handles doc indexing) |
| **Hallucinations** | Zero — NotebookLM refuses answers outside uploaded docs |
| **Security** | Local browser automation, no credentials transmitted; use dedicated account |
| **Best For** | Knowledge bases that rarely change; internal documentation; API references |

