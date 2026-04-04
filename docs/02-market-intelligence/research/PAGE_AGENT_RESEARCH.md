# page-agent Research Report

**Repository**: https://github.com/alibaba/page-agent
**Research date**: 2026-03-25
**Verdict for CarabinerOS use-case**: Not a fit. See section 6.

---

## 1. What is page-agent?

page-agent is a TypeScript/JavaScript library published by Alibaba that embeds an AI agent **directly inside a web page**. The description says it plainly: "JavaScript in-page GUI agent. Control web interfaces with natural language."

The key design philosophy is client-side first:
- No headless browser, no browser extension required for the base use case.
- No Python, no server-side automation runner.
- Just a script tag (or npm package) injected into the target page.
- The LLM is called directly from the page's JavaScript context.

The agent uses a ReAct loop (observe → think → act) where the "observe" step reads the live DOM of the page it is already running in, the LLM decides what action to take, and the "act" step fires synthetic DOM events to click, type, scroll, or select elements.

Primary intended use case (from README): **SaaS AI copilot** — a vendor embeds page-agent into their own product so users can command it with natural language. Secondary use cases: smart form filling in ERP/CRM admin panels, accessibility, and (with the Chrome extension) multi-tab agents.

The project explicitly acknowledges it is "derived from browser-use" (Python) and credits that project in its license attribution.

---

## 2. Technical Architecture

### Monorepo packages

| Package | npm name | Role |
|---|---|---|
| `packages/page-agent` | `page-agent` | Main public entry: PageAgentCore + UI Panel + PageController bundled |
| `packages/core` | `@page-agent/core` | Headless ReAct agent loop, tool dispatch, prompt assembly |
| `packages/page-controller` | `@page-agent/page-controller` | DOM extraction, element indexing, click/type/scroll actions |
| `packages/llms` | `@page-agent/llms` | OpenAI-compatible LLM client with retry logic |
| `packages/ui` | `@page-agent/ui` | Floating panel UI component |
| `packages/extension` | (Chrome store) | Browser extension for multi-tab support |
| `packages/mcp` | `@page-agent/mcp` | MCP server that bridges Claude Desktop / Copilot to the extension |

### The ReAct loop (core)

```
while (steps < maxSteps):
    1. observe:   PageController.getBrowserState() → simplified DOM text
    2. assemble:  system prompt + agent history + browser state → LLM messages
    3. think:     LLM.invoke() → MacroToolResult (reflection + action choice)
    4. act:       execute selected tool (click, input, scroll, wait, done, ask_user)
    5. record:    push step to history
    6. check:     if action == 'done', exit loop
```

The LLM is forced via `tool_choice` to always call a single "MacroTool" that bundles reflection fields (`evaluation_previous_goal`, `memory`, `next_goal`) plus the chosen action into one structured output. This is the same reflection-before-action approach used by browser-use.

### DOM pipeline

1. `PageController` walks the live DOM of the current page.
2. Interactive elements (inputs, buttons, links, selects, contenteditables) are extracted and assigned sequential integer indexes.
3. A simplified HTML string is generated in the format `[33]<button>Submit</button>` — no screenshots, just text.
4. This text goes into the LLM prompt as `<browser_state>`.
5. The LLM returns an action like `{ click_element_by_index: { index: 33 } }`.
6. `PageController.clickElement(33)` fires synthetic MouseEvents (mouseenter → mousedown → focus → mouseup → click) on the real DOM element.

### Tools available to the agent

| Tool | What it does |
|---|---|
| `click_element_by_index` | Fires synthetic click event sequence on element |
| `input_text` | Clears and types text into input/textarea/contenteditable |
| `select_dropdown_option` | Sets `<select>` value and dispatches change event |
| `scroll` | Vertical scroll, page-level or element-specific |
| `scroll_horizontally` | Horizontal scroll |
| `wait` | Waits N seconds (1-10) |
| `ask_user` | Pauses and asks user a question (requires `onAskUser` callback) |
| `done` | Terminates the task with success/failure + final text |
| `execute_javascript` | (Experimental, opt-in) Runs arbitrary JS on the page |

**Missing tools** (the repo has explicit TODOs for these): `send_keys`, `upload_file`, `go_back`, `extract_structured_data`.

### LLM compatibility

Any OpenAI-compatible API. Configuration is `{ baseURL, model, apiKey }`. The README shows Alibaba's Qwen (via DashScope) as the default demo model. GPT-4o, Claude (via proxy), and others work. A `customFetch` hook lets you attach custom headers or credentials.

### Multi-tab / cross-page support

The base library is **single-page only** — the system prompt explicitly says "You can only handle single page app. Do not jump out of current page." and "Do not click on link if it will open in a new page".

Multi-page (cross-tab) requires:
1. The Chrome extension (published to Chrome Web Store)
2. Optionally the `@page-agent/mcp` package as an MCP server

The MCP server opens a local HTTP+WebSocket server, launches a "hub" tab through the extension, and proxies `execute_task` MCP calls through to the hub's multi-page agent. This lets Claude Desktop or Copilot control the browser.

---

## 3. Capabilities

### What it can do

- Navigate within a single-page app (SPA) by clicking links that do not trigger full navigations to new origins.
- Fill forms: text inputs, selects, contenteditable fields (React, Quill, Slate partial support).
- Click buttons, open dropdowns, scroll to find content.
- Read visible page text and extract information.
- Handle same-origin iframes (as of v1.6.0).
- Pause and prompt user for missing information via `ask_user`.
- Execute arbitrary JavaScript on the page (experimental, opt-in).
- Provide lifecycle hooks (`onBeforeStep`, `onAfterStep`, `onBeforeTask`, `onAfterTask`) for orchestration.
- Accept custom tools via `customTools` config (extend or override built-ins).
- Accept custom system prompt override.
- Mask sensitive data before sending to LLM via `transformPageContent` callback.
- Fetch and include `/llms.txt` from the target site (experimental).

### What it cannot do (hard limitations)

- **No navigation across origins** in base mode. Cannot go from `toast.com` to `square.com` in a single task run.
- **No cross-tab operation** without the Chrome extension.
- **No file upload** (missing tool, open TODO).
- **No keyboard shortcut dispatch** (no `send_keys` tool).
- **No captcha solving** — system prompt explicitly tells the agent to stop and ask user.
- **No screenshot / visual grounding** — purely text-based DOM. If the target platform renders complex widgets outside standard DOM (canvas, WebGL, custom shadow DOM not traversed), those elements are invisible.
- **No auth session management** — it has no mechanism to persist cookies or credentials across runs.
- **No go_back action** (missing tool, open TODO).
- **Structured data extraction** — the `extract_structured_data` tool is a TODO comment. The agent can read page text and summarize, but there is no dedicated extraction mode.
- **Single-page only in headless / server contexts** — this library runs in a browser window. There is no Node.js headless mode. It is not Playwright. It cannot be called from Python.

---

## 4. Maturity

| Signal | Value |
|---|---|
| Stars | 13,893 |
| Forks | 1,067 |
| Open issues | 46 |
| Contributors | ~18 (1 dominant: gaomeng1900 with 721 commits) |
| Created | 2025-09-23 |
| Last push | 2026-03-24 (yesterday) |
| Latest version | 1.6.2 |
| License | MIT |

**Age**: ~6 months old as of this research date.

**Activity**: Very active. The changelog shows roughly one meaningful release every 2–4 weeks. Dependency updates (dependabot) run frequently.

**Bus factor**: High risk. One contributor (gaomeng1900) has 721 of ~790 total commits. Everyone else has 1–7.

**Issues**: 46 open. Bugs include: Element Plus component compatibility problems, scroll container detection failures in multi-scroll layouts, 413 payload too large errors on pages with many elements, issues with left-side menu expansion on frameworks like ruoyi-vue-pro. The majority of issues and bug reports are in Chinese, suggesting the primary user base is Chinese developers.

**Stability**: Breaking config changes appeared as recently as v1.5.1. The API is stabilizing but not stable.

---

## 5. Limitations Summary

1. **Client-side only, no server runtime.** This is a JavaScript library that runs inside a browser tab. There is no Python SDK, no headless runner, no Node.js API for server-side automation. Integration with a Python/Flask backend requires either: (a) the Chrome extension + MCP server bridge, or (b) running the library inside a headless browser (Playwright) yourself — at which point you are using Playwright for browser control and page-agent adds no value over browser-use directly.

2. **Single-origin constraint.** The base agent cannot navigate across domains. Automating a workflow that spans Toast's dashboard login → order pull → Uber Eats portal → report generation requires the Chrome extension + multi-page hub, which requires a user's Chrome browser to be open and logged in.

3. **Designed for copilot embedding, not scraping / integration.** The intended deployment is: the target site's *own* developer embeds page-agent so *their* users can control *their* UI. Using it to automate a third-party site (Toast, OpenTable, Square) is using it against its design intent. The third-party site has no `[index]` overlay and never consented to this usage.

4. **Anti-bot friction is invisible to it.** Because page-agent cannot see CAPTCHAs, cannot handle MFA flows automatically, and cannot manage session state, any third-party platform with moderate security will block or interrupt automation within a few steps.

5. **No structured data extraction primitive.** There is no "extract this table as JSON" tool. The agent can narrate what it sees, but structured output requires asking the LLM to parse free text from the page.

6. **Dependency on a running LLM for every step.** Each step fires an LLM API call. A 10-step workflow costs 10 API roundtrips. On a page with 200+ interactive elements (like a dense admin dashboard), each prompt is very large, risking 413 errors (as seen in open issues).

7. **No persistence between sessions.** No built-in memory, credential store, or session state. Every execution starts fresh.

8. **DOM-only.** If a platform uses canvas-rendered UI, custom web components with closed shadow roots, or dynamic elements only visible after specific interactions, the DOM text representation will be incomplete.

---

## 6. Comparison to Alternatives

| | page-agent | browser-use (Python) | Playwright (Python) | Stagehand | Puppeteer |
|---|---|---|---|---|---|
| Language | TypeScript/JS (browser) | Python | Python | TypeScript (Node) | JavaScript (Node) |
| Where it runs | Inside browser tab | Server (headless browser) | Server (headless/headed) | Server (Node) | Server (Node) |
| Crosses origins | No (base) / Yes (ext) | Yes | Yes | Yes | Yes |
| Uses screenshots | No (DOM text) | Yes (+ DOM) | You control | Yes | You control |
| Python SDK | No | Yes | Yes | No | No |
| Auth/session mgmt | No | Via browser profile | Full control | Via Playwright | Full control |
| Designed for scraping | No | Yes | Yes | Yes | Yes |
| Headless server use | No | Yes | Yes | Yes | Yes |
| Multi-step memory | In-session only | In-session only | None (manual) | In-session only | None (manual) |
| MCP server | Beta | Via custom impl | No | No | No |
| Maturity | 6 months, 1 dev | ~1 year, active team | 10+ years, Microsoft | ~1 year | 8+ years, Google |

**browser-use** is the direct ancestor/inspiration and is better suited for server-side integration because it runs in Python, manages headless Chromium via Playwright, handles cross-origin navigation natively, and has screenshot + DOM grounding. It would integrate cleanly with a Python/Flask backend.

**Playwright** (which CarabinerOS already has installed) gives direct, low-level headless browser control from Python. Combined with an LLM agent loop (which Agent Zero already provides), Playwright can do everything page-agent does plus: cross-origin navigation, file upload, auth session persistence via browser profiles/storage state, keyboard shortcuts, and network interception.

**Stagehand** (by Browserbase) is the closest "AI-native browser automation" alternative in the Node.js ecosystem. It wraps Playwright with LLM-powered `act()` and `extract()` primitives, supports screenshots, and runs server-side. Not Python though.

---

## 7. Assessment for CarabinerOS Integration Use Case

The goal: automate browser interactions with Toast, OpenTable, Square, Google Business, 7shifts, DoorDash, Uber Eats where official APIs are limited.

**page-agent is the wrong tool for this.** Specific reasons:

1. It is a client-side JavaScript library. CarabinerOS runs a Python backend. There is no path from Python to page-agent without running a full Chrome browser, managing the MCP bridge, and maintaining a persistent browser session — at which point you have added three layers of complexity compared to just using Playwright directly.

2. It is designed for "embedded copilot" scenarios, not third-party site automation. Running it against Toast's admin dashboard requires injecting it into Toast's pages, which means you need to be on Toast's domain — not CarabinerOS's domain.

3. It has no session/credential management. Every run against a third-party portal that requires login will require solving auth from scratch or relying on an already-logged-in browser session.

4. The single-page constraint is a blocker. Restaurant platform workflows routinely span multiple pages (login → orders → export → download).

**What would actually work for this use case:**

- **Playwright + browser-use (Python)**: Both are already partially in the stack. browser-use wraps Playwright with an LLM agent loop in Python. It handles cross-origin navigation, screenshots for visual grounding, session state via browser profiles, and runs headlessly on a server. This is the natural choice.

- **Direct Playwright automation (no LLM)**: For well-understood, stable workflows (e.g., "export last week's orders from Toast as CSV"), deterministic Playwright scripts are faster, cheaper, and more reliable than LLM-driven agents. LLM agents are best for exploratory or variable workflows.

- **Playwright + custom Agent Zero tool**: Since Agent Zero is already the framework and Playwright is already installed, writing a `playwright_browser_task` tool that accepts a natural language instruction, spins up a browser-use-style loop, and returns structured results would be a clean integration path within the existing architecture.

page-agent could be relevant in exactly one CarabinerOS scenario: if a third-party platform's vendor embeds page-agent into their own admin UI, and you want to send natural language commands to it. That is not the integration model described.
