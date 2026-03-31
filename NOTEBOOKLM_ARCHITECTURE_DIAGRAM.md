# NotebookLM MCP Architecture Diagram

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code Terminal                      │
│  User: "Ask NotebookLM: How do I reduce food costs?"            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ MCP Protocol (stdio)
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                  NotebookLM MCP Server (Node.js)                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Index Server (index.ts)                                 │   │
│  │  - Receives: ask_question tool call                     │   │
│  │  - Routes to: ToolHandlers.handleAskQuestion()          │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                            │
│  ┌──────────────────▼───────────────────────────────────────┐   │
│  │  SessionManager (session-manager.ts)                      │   │
│  │  - Manages up to 10 concurrent browser sessions          │   │
│  │  - Reuses shared Chromium context (memory efficient)     │   │
│  │  - Handles auto-recovery if browser crashes             │   │
│  │  - Creates new page (tab) for each query                │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                            │
│  ┌──────────────────▼───────────────────────────────────────┐   │
│  │  BrowserSession (browser-session.ts)                      │   │
│  │  - One per session                                       │   │
│  │  - Navigates to: https://notebooklm.google.com/nb...   │   │
│  │  - Validates auth (checks cookies expiry)              │   │
│  │  - Waits for: textarea.query-box-input                  │   │
│  │  - Types question (humanized: 160-240 WPM)             │   │
│  │  - Presses Enter                                        │   │
│  │  - Polls for response (streaming detection)            │   │
│  │  - Returns answer text                                 │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                            │
│  ┌──────────────────▼───────────────────────────────────────┐   │
│  │  AuthManager (auth-manager.ts)                            │   │
│  │  - Loads saved browser state (cookies + localStorage)    │   │
│  │  - Validates cookie expiry (24h timeout)               │   │
│  │  - Handles interactive login (setup_auth tool)        │   │
│  │  - Saves/restores sessionStorage                       │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                            │
│  ┌──────────────────▼───────────────────────────────────────┐   │
│  │  Patchright/Chromium (patchright v1.48.2)                │   │
│  │  - Headless browser automation                          │   │
│  │  - Stealth mode: humanized typing, random delays       │   │
│  │  - Persistent fingerprint                              │   │
│  │  - Memory-efficient: shared context across sessions    │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     │                                            │
└─────────────────────┼──────────────────────────────────────────┘
                      │
                      │ HTTPS (Google's infrastructure)
                      ↓
           ┌──────────────────────┐
           │  Google NotebookLM   │
           │  Web UI (.html/.js)  │
           │  ┌────────────────┐  │
           │  │ Input Textarea │  │
           │  │ Response Divs  │  │
           │  └────────────────┘  │
           └──────────────┬───────┘
                          │
                          │ HTTP API
                          ↓
           ┌──────────────────────┐
           │  Gemini 2.5 Backend  │
           │  (Google AI Labs)    │
           └──────────────┬───────┘
                          │
                          │ Semantic Analysis
                          ↓
           ┌──────────────────────┐
           │  Your Uploaded Docs  │
           │  - PDFs              │
           │  - Google Docs       │
           │  - Web links         │
           │  - YouTube videos    │
           └──────────────────────┘
```

---

## Authentication State Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                       SETUP (One-Time)                           │
└─────────────────────────────────────────────────────────────────┘

User runs: setup_auth tool
    ↓
Patchright launches HEADFUL Chrome (visible window)
    ↓
Navigate to: https://accounts.google.com/v3/signin/...
    ↓
USER MANUALLY LOGS IN (enters email, password, 2FA)
    ↓
Google redirects to NotebookLM
    ↓
Server captures browser state:
    ├── state.json (cookies + localStorage + IndexedDB)
    ├── session.json (sessionStorage - Google tokens)
    └── Stored in: ~/.local/share/notebooklm-mcp/browser_state/
    ↓
Browser closes automatically
    ↓
✅ Ready for queries!


┌─────────────────────────────────────────────────────────────────┐
│               QUERIES (Subsequent, Up to 24h)                    │
└─────────────────────────────────────────────────────────────────┘

User asks question
    ↓
Server checks: Is saved state fresh? (< 24h old)
    ├─ YES → Load state.json + session.json
    └─ NO → Show error, ask user to run setup_auth
    ↓
Patchright launches HEADLESS Chrome (hidden)
    ↓
Create browser context with pre-loaded cookies:
    ├── CRITICAL_COOKIES: SID, HSID, SSID, APISID, SAPISID, OSID, __Secure-*
    └── localStorage, IndexedDB, sessionStorage
    ↓
Create new page (tab)
    ↓
Navigate to notebook URL
    ↓
Validate cookies still work:
    ├─ Valid → Proceed
    └─ Expired → Trigger setup_auth
    ↓
Wait for: textarea.query-box-input (visible)
    ↓
Type question (human-like, 160-240 WPM)
    ↓
Press Enter
    ↓
Poll for response in DOM:
    ├── Selector: .to-user-container .message-text-content
    ├── Interval: 1000ms
    ├── Detect streaming: Hash comparison
    └── Require stability: 3 consecutive identical polls
    ↓
Extract text and return to Claude
    ↓
✅ Answer received


┌─────────────────────────────────────────────────────────────────┐
│               STATE EXPIRY (After 24h)                           │
└─────────────────────────────────────────────────────────────────┘

Query attempt after 24h of inactivity
    ↓
Server checks state file age: > 24 hours
    ↓
❌ State marked as EXPIRED
    ↓
Error: "Please run setup_auth to re-authenticate"
    ↓
User runs: setup_auth tool
    ↓
(Back to SETUP flow above)
```

---

## DOM Interaction & Response Extraction

```
QUESTION SUBMISSION:
───────────────────

Page loaded: notebooklm.google.com/notebook/abc123
    ↓
Find: textarea.query-box-input (PRIMARY SELECTOR)
    ├─ Must be visible (checked via page.waitForSelector)
    └─ If not found, try fallback: textarea[aria-label="..."]
    ↓
Focus textarea
    ↓
Type question character-by-character:
    ├─ Realistic WPM: 160-240 words/min
    ├─ Human errors: occasional typo + correction
    ├─ Random delays: 100-400ms between characters
    └─ Natural pauses after punctuation
    ↓
Press Enter key
    ↓
Wait 1-1.5 seconds for processing


RESPONSE DETECTION (Streaming):
────────────────────────────────

Poll loop (every 1000ms, timeout 120 seconds):
    ↓
Check for: div.thinking-message (if visible, still thinking)
    ├─ YES → Wait, continue polling
    └─ NO → Check for response
    ↓
Query DOM: .to-user-container .message-text-content
    ├─ If multiple matches, get latest
    └─ If none found, try fallback selectors
    ↓
Extract innerText()
    ↓
Normalize: trim(), lowercase for comparison
    ↓
Compare to previous poll:
    ├─ IDENTICAL (hash match) → increment stable_count
    │   └─ If stable_count == 3 → DONE! Return answer
    │
    ├─ DIFFERENT (hash mismatch) → reset stable_count = 0
    │   └─ Text is still streaming, continue polling
    │
    └─ NONE → Continue polling
    ↓
Repeat until:
    ├─ Text stable for 3 polls (RETURN ANSWER)
    ├─ Timeout reached (ERROR: No response)
    └─ Rate limit detected (ERROR: Rate limit)


RESPONSE EXTRACTION (Final):
──────────────────────────────

Query: document.querySelector(".to-user-container .message-text-content")
    ↓
Get: innerText()
    ↓
Clean: Remove leading/trailing whitespace
    ↓
Return to Claude via MCP protocol

EXAMPLE DOM SNAPSHOT:
──────────────────────

<div class="to-user-container">      ← Container selector
  <div class="message-text-content">  ← Text selector
    <p>Based on your playbook, reduce food cost by:</p>
    <ol>
      <li>Negotiate with suppliers for volume discounts</li>
      <li>Reduce portion sizes slightly (2-3%)</li>
      <li>Optimize prep waste (compost unused trim)</li>
    </ol>
  </div>
</div>
```

---

## State File Structure

```
~/.local/share/notebooklm-mcp/  ← Data directory
├── browser_state/              ← Auth state (CRITICAL!)
│   ├── state.json              ← Cookies + localStorage + IndexedDB
│   │   {
│   │     "cookies": [
│   │       {
│   │         "name": "SSID",
│   │         "value": "AgL...xyz",
│   │         "domain": ".google.com",
│   │         "path": "/",
│   │         "expires": 1234567890,
│   │         "httpOnly": true,
│   │         "secure": true
│   │       },
│   │       ... (SID, APISID, OSID, __Secure-1PSID, etc.)
│   │     ],
│   │     "localStorage": [...],
│   │     "idbData": [...]
│   │   }
│   │
│   └── session.json             ← sessionStorage (Google tokens)
│       {
│   │     "key1": "value1",
│   │     "key2": "value2",
│   │     ...
│   │   }
│   │
├── chrome_profile/              ← Chromium profile cache
│   ├── Default/                 ← Main profile
│   ├── Cache/
│   └── ... (other Chromium internals)
│
└── chrome_profile_instances/    ← Isolated profiles (if using auto strategy)
    ├── instance-001/
    ├── instance-002/
    └── ... (per-instance profiles)

~/.config/notebooklm-mcp/       ← Settings directory
└── settings.json                ← Tool profile (minimal|standard|full)
    {
      "profile": "standard",
      "disabled_tools": ["cleanup_data"],
      "last_updated": "2025-03-28T10:30:00Z"
    }
```

---

## Session Management & Pooling

```
NotebookLM MCP Server (Running)
│
└── SessionManager
    ├── Max concurrent: 10 (CONFIG.maxSessions)
    ├── Session timeout: 900s idle (CONFIG.sessionTimeout)
    │
    └── SharedContextManager
        │
        ├── Shared Chromium Context
        │   ├── Page (Tab 1) → Session-1
        │   ├── Page (Tab 2) → Session-2
        │   ├── Page (Tab 3) → Session-3
        │   └── Page (Tab 4) → Session-4
        │
        └── [Auto-Recovery]
            ├── If context crashes → Recreate
            ├── If page closes → Recreate
            └── Session data persists

MEMORY EFFICIENCY:
──────────────────
Single Chromium process with 4 tabs:
└── ~200-300 MB RAM total

vs. 4 separate Chromium processes:
└── ~800-1200 MB RAM total

REUSE ACROSS QUERIES:
─────────────────────
Query 1: Create session-1
Query 2: Create session-2 (reuses same Chromium context)
Query 3: Reuse session-1 (if same session_id)
Query 4: Create session-3

Idle session timeout: 15 minutes
└── After timeout → Auto-close page
└── Session data → Discarded
```

---

## Error Recovery & Auto-Healing

```
Attempt Query
    ↓
TRY: Validate browser context
    ├─ OK → Proceed
    └─ ERROR: "Browser has been closed"
        │
        └─ CATCH: Recreate context
            └─ RETRY: Continue query

TRY: Create new page
    ├─ OK → Proceed
    └─ ERROR: "Context has been closed"
        │
        └─ CATCH: Recreate shared context
            └─ RETRY: Create page again

TRY: Navigate to notebook
    ├─ OK → Proceed
    └─ ERROR: Navigation timeout
        │
        └─ CATCH: Re-try with longer timeout
            └─ RETRY: Navigate again

TRY: Wait for input textarea
    ├─ OK → Proceed
    └─ ERROR: Timeout, input not found
        │
        └─ CATCH: Fallback selector
            ├─ Try: aria-label selector
            └─ If STILL fails → ERROR: Interface changed

TRY: Type question
    ├─ OK → Proceed
    └─ ERROR: Page not interactive
        │
        └─ CATCH: Wait for page to stabilize
            └─ RETRY: Type again

TRY: Poll for response
    ├─ OK (got answer) → Return
    ├─ ERROR: Rate limit → Throw RateLimitError
    ├─ ERROR: Auth expired → Throw AuthError
    └─ ERROR: Timeout → Throw TimeoutError
```

---

## Browser Stealth & Detection Avoidance

```
Chrome Launch Flags:
───────────────────
--disable-blink-features=AutomationControlled
    └─ Hides navigator.webdriver flag

Stealth Measures:
────────────────
Before typing: Human-like delays
    ├─ Random: 100-400ms between keystrokes
    └─ Natural pauses after: . ? !

While typing: Occasional errors
    ├─ Random typo: ~2-5% of time
    └─ Auto-correct: backspace + retype
    └─ WPM variation: 160-240 words/min (realistic range)

Between actions: Realistic delays
    ├─ After page load: 2-3 seconds
    ├─ Before submit: 0.5-1.0 seconds
    ├─ After submit: 1.0-1.5 seconds
    └─ Between polls: 1.0 second

Mouse movements:
    ├─ Humanized cursor paths
    ├─ Variable speed
    └─ Natural pauses

Persistent fingerprint:
    ├─ Chrome profile reused across sessions
    ├─ Cookies + localStorage preserved
    └─ Same user agent, screen size, timezone

⚠️ STILL NOT 100% FOOLPROOF:
    └─ Google can detect patterns
    └─ Recommendation: Use dedicated account, respect rate limits
```

---

## Integration with Carabiner OS

```
┌────────────────────────────────────────────────────────────┐
│           Carabiner Frontend (Next.js 16)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Knowledge Module (/knowledge/)                       │  │
│  │ - Notebook library view                             │  │
│  │ - Chat interface                                    │  │
│  │ - Results as info cards                            │  │
│  └──────────────────────┬───────────────────────────────┘  │
└────────────────────────┼──────────────────────────────────┘
                         │
                         │ REST: POST /api/knowledge/ask
                         │ Data: { question, notebook_id }
                         ↓
┌────────────────────────────────────────────────────────────┐
│         Carabiner Backend (Python/Flask)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Flask Route: @app.route('/api/knowledge/ask')       │  │
│  │ - Validate user auth                                │  │
│  │ - Fetch context from DB (optional)                 │  │
│  │ - Call NotebookLM MCP via subprocess               │  │
│  │ - Stream response via Socket.IO                    │  │
│  └──────────────────────┬───────────────────────────────┘  │
└────────────────────────┼──────────────────────────────────┘
                         │
                         │ Subprocess/Shell call
                         │ or HTTP POST to MCP service
                         ↓
┌────────────────────────────────────────────────────────────┐
│    NotebookLM MCP Server (Node.js, separate process)       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ MCP Tool: ask_question()                            │  │
│  │ - Call SessionManager                              │  │
│  │ - Return answer JSON                               │  │
│  └──────────────────────┬───────────────────────────────┘  │
└────────────────────────┼──────────────────────────────────┘
                         │
                         │ Browser automation
                         ↓
              Google NotebookLM + Gemini
```

---

## Cost Flow & Rate Limiting

```
Google Account (one per deployment)
    │
    └── Daily Query Limit
        │
        ├─ Free Tier: 50/day
        │   └─ Small restaurant, light usage
        │
        ├─ AI Pro: 250/day ($50/month)
        │   └─ Medium restaurant, standard usage
        │
        └─ AI Ultra: 500/day ($500/month)
            └─ Large chain, heavy automation

Per-Query Lifecycle:
────────────────────
Question asked → Increment counter (1/50)
    ↓
Response received → Counter is now 2/50
    ↓
Next day at 00:00 UTC → Counter resets to 0/50
    ↓
If counter reaches limit:
    └─ Error: "Rate limit reached (50 queries/day for free accounts)"
    └─ Solution: re_auth tool → switch to different Google account
    └─ Or: Upgrade to Pro/Ultra tier

Recommendation for Carabiner:
──────────────────────────────
Start: Free tier ($0)
├─ Test with PoC
└─ ~5 queries/day average
    │
Target: AI Pro ($50/month)
├─ Budget: ~$600/year
├─ Queries: ~250/day
├─ Margin: 5x buffer (good for spikes)
└─ ROI: Cost of 1 bad decision > $50/month
```

---

## Failure Scenarios & Recovery

```
SCENARIO 1: Browser Crashes Mid-Query
──────────────────────────────────────
Chromium process dies
    ↓
BrowserSession.isPageClosedSafe() returns true
    ↓
Catch error: "Browser has been closed"
    ↓
SharedContextManager.getOrCreateContext() recreates
    ↓
RETRY: Create new page, navigate, ask question
    ↓
✅ User gets answer (automatic recovery)


SCENARIO 2: Auth State Expired (24h old)
─────────────────────────────────────────
User queries after 24 hours
    ↓
AuthManager.isStateExpired() returns true
    ↓
Server checks: cookies valid?
    ├─ Valid → Proceed
    └─ Expired → Next step
    ↓
Return: { success: false, error: "Auth expired" }
    ↓
User sees: "Please run setup_auth to re-authenticate"
    ↓
User calls: setup_auth tool
    ↓
✅ Fresh login, back to normal


SCENARIO 3: Rate Limit Hit
──────────────────────────
Query 51 on free tier
    ↓
NotebookLM returns: Rate limit error page
    ↓
BrowserSession.detectRateLimitError() finds error div
    ↓
Throw: RateLimitError("50 queries/day limit reached")
    ↓
Return to Claude: { success: false, error: "Rate limit..." }
    ↓
User sees: "Rate limit reached. Switch accounts or upgrade."
    ↓
User calls: re_auth tool (switches to different account)
    ↓
✅ Next query uses new account quota


SCENARIO 4: NotebookLM UI Changes
──────────────────────────────────
Google updates HTML structure
    ├─ Old selector: .to-user-container .message-text-content (broken)
    └─ New structure: .response-box (unknown)
    ↓
Fallback selectors exhausted
    ↓
Throw: Error("Could not find NotebookLM chat response")
    ↓
Return: { success: false, error: "Interface changed" }
    ↓
Developer action: Update RESPONSE_SELECTORS in page-utils.ts
    ↓
✅ Patch released in next version


SCENARIO 5: Network Outage (Temporary)
───────────────────────────────────────
Browser can't reach notebooklm.google.com
    ↓
page.goto() timeout after 30 seconds
    ↓
Catch: TimeoutError
    ↓
Option A: RETRY (automatic, configurable)
├─ Retry 3 times with exponential backoff
└─ If still fails → Error
    ↓
Option B: Fail immediately
├─ Return: { success: false, error: "Network timeout" }
└─ User retries manually later
    ↓
✅ User can retry when network recovers
```

---

## Summary Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  User Request (Claude Code)                                     │
│  "Ask NotebookLM: How do I reduce food cost?"                  │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│  MCP Protocol Layer (stdio)                                     │
│  Tool: ask_question(question, notebook_url)                    │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│  MCP Server (Node.js) - index.ts                               │
│  - Register tool handlers                                      │
│  - Dispatch to ToolHandlers                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│  ToolHandlers (handlers.ts) - handleAskQuestion()              │
│  - Resolve notebook URL from library                           │
│  - Get/create browser session                                  │
│  - Apply browser options (headless, etc)                       │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│  SessionManager (session-manager.ts)                           │
│  - Pool management (max 10 sessions)                           │
│  - Session lifetime & idle timeout tracking                    │
│  - Auto-close on idle                                          │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│  BrowserSession (browser-session.ts)                           │
│  - Initialize session (navigate to notebook)                   │
│  - Auth validation (cookie expiry check)                       │
│  - Ask question (type + submit)                                │
│  - Wait for response (streaming detection)                     │
│  - Extract answer (DOM querySelector)                          │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│  AuthManager (auth-manager.ts)                                 │
│  - Load browser state (state.json)                             │
│  - Validate cookies (24h expiry)                               │
│  - Handle interactive login (setup_auth)                       │
│  - Save/restore sessionStorage                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│  Patchright/Chromium (patchright v1.48.2)                      │
│  - Headless browser instance                                   │
│  - Human-like typing & delays (stealth)                        │
│  - DOM querying & interaction                                  │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
                Google NotebookLM + Gemini 2.5
                + Your Uploaded Documents
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│  Response Extraction (page-utils.ts)                           │
│  - Poll: .to-user-container .message-text-content             │
│  - Detect streaming: hash comparison                           │
│  - Stability: 3 consecutive identical polls                    │
│  - Extract: innerText()                                        │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│  Return Result to Claude                                       │
│  {                                                             │
│    success: true,                                              │
│    answer: "Reduce food cost by: 1) Negotiate...",           │
│    session_id: "session-xyz789"                               │
│  }                                                             │
└──────────────────────┬──────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│  Claude Returns Answer to User                                 │
│  "Based on your playbook: 1) Negotiate with suppliers..."    │
└─────────────────────────────────────────────────────────────────┘
```
