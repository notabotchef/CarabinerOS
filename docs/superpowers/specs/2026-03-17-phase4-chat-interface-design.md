# Phase 4: Chat Interface — Design Spec

## Goal

Replace the current dashboard homepage with a full-screen, chat-first interface. The chat is the primary way operators interact with CarabinerOS. Workspace modules remain accessible via sidebar and module pills. Agent Zero handles all processing — our chat is a presentation layer that filters internal agent mechanics into clean, restaurant-context responses.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary interface | Chat IS the homepage | Operators interact via natural language first, not forms |
| Layout | Everything centered | Clean, focused, matches ChatGPT/Claude/Gemini pattern |
| Suggested prompts | Rotate inside chat input as placeholder text | Feels native, not bolted-on; Enter executes, typing replaces |
| Message style | Bubbles (WhatsApp/iMessage) | Familiar, warm, right-aligned user / left-aligned assistant |
| Send button | Rounded square with arrow (ChatGPT style) | Clean, familiar |
| Module access | Centered pills below input on empty state | Quick workspace access without cluttering the chat |
| Backend | Mock streaming with status transitions | Frontend-first; real Agent Zero wiring in Phase 5 |
| Conversations | Single session, in-memory | No persistence, no conversation list — comes later |
| Agent output | Filtered via rendering helpers | Operator never sees internal agent mechanics |

## Tech Stack

- **react-markdown** — markdown rendering in assistant bubbles
- **Socket.IO** — existing client/server for real-time streaming
- **Zustand** — chat state (messages, streaming status)
- **CSS animations** — prompt rotation fade, streaming cursor, status pill pulse

## Architecture

### Presentation Layer (not duplicating Agent Zero)

Agent Zero does all the work. Our chat UI is a thin filter:

```
Agent Zero logs → deriveConversationStatus() → status pill UI
Agent Zero tool names → cleanOperationalCopy() → "Checking inventory levels"
Agent Zero agent refs → mapInternalAgentToRestaurantRole() → "Assistant GM"
Agent Zero response → react-markdown → formatted bubble
```

The operator sees clean restaurant-context output. Internal mechanics (tool calls, subordinate agents, code execution) are hidden.

### File Structure

#### New Files
```
src/components/chat/chat-view.tsx          — main chat container (empty state + active state)
src/components/chat/chat-message.tsx       — single bubble (user or assistant) with markdown
src/components/chat/chat-composer.tsx      — input with rotating placeholder, attach btn, send btn
src/components/chat/chat-status-pill.tsx   — animated status indicator (role + activity text)
src/lib/chat-helpers.ts                    — ported rendering helpers from legacy carabiner-store.js
```

#### Modified Files
```
src/app/page.tsx                           — rewritten: chat-first homepage replaces dashboard
src/stores/workspace-store.ts              — add chat state: messages[], isStreaming, streamingStatus
src/hooks/use-socket.ts                    — add response_stream + status_update event handlers
engine/main.py                             — mock streaming handler for chat_message events
```

#### Install
```
pnpm add react-markdown
```

#### Existing Files (kept, not deleted)
```
src/components/dashboard/*                 — still used by module pages, just not the homepage
src/app/(workspace)/*                      — workspace routes unchanged
src/components/workspace/chat-dock.tsx     — UPDATED: rewritten to use shared ChatView component
```

### Docked Chat Panel Integration

The existing ChatDock (from Phase 3) and the new chat homepage share components:
- `ChatView` renders in both contexts — full-screen on homepage, 380px docked on workspace pages
- `ChatComposer` and `ChatMessage` are reused in both
- Zustand store holds shared state: when user clicks "Ask CarabinerOS" on a workspace item, `chatPrompt` is set, `isChatOpen` becomes true, and the ChatDock renders ChatView with the prompt pre-filled in the composer
- `isChatOpen` controls the docked panel on workspace pages (unchanged from Phase 3)
- `chatPrompt` is consumed by ChatComposer: if set, it replaces the rotating placeholder and shows as editable text ready to send
- Messages are shared across both contexts — same conversation whether on homepage or docked

## Component Specifications

### ChatView

The main container. Manages two states:

**Empty state** (no messages):
- CarabinerOS logo/mark centered
- "Good morning" greeting + subtitle
- Composer with rotating prompts as placeholder
- Module pills centered below composer
- Hint text: "Press Enter to run this prompt · Start typing to replace"

**Active state** (has messages):
- Scrollable message list (auto-scroll to bottom)
- Status pill between messages when agent is working
- Composer fixed at bottom
- Module pills hidden

Props: none (reads from chat store)

### ChatMessage

Single message bubble.

**User bubble**: right-aligned, accent background, rounded corners (14px with 4px bottom-right)
**Assistant bubble**: left-aligned, card background with border, rounded corners (14px with 4px bottom-left)
- Shows "CarabinerOS" label above content
- Content rendered via react-markdown
- Supports lists, code blocks, bold/italic
- While streaming: cursor blink animation at end of text

Props: `{ role: "user" | "assistant", content: string, isStreaming?: boolean }`

### ChatComposer

Input area at bottom of chat.

**Empty state behavior**:
- Rotating prompts cycle as placeholder text (8s interval, smooth fade transition)
- Up/down arrow keys cycle through prompts manually
- Enter key sends the current prompt as a message
- Any character key dismisses prompts and enables normal typing
- Attach button (+ icon) on left — file picker (UI only for Phase 4, no upload logic)

**Active state behavior**:
- Normal textarea, auto-expanding up to 4 rows
- Enter sends (Shift+Enter for newline)
- Disabled while streaming (re-enables when agent responds)

**Send button**: Rounded square (30x30px), subtle background, arrow-up icon. Right side of input.

Props: `{ onSend: (message: string) => void, disabled?: boolean }`

### ChatStatusPill

Animated indicator shown when agent is processing.

- Centered in message list between user message and assistant response
- Pulsing dot (amber) + role text + activity text
- Example: "● Assistant GM · Checking inventory levels"
- Fades in/out with 200ms transition
- Derives display from status events via `deriveConversationStatus()`

Props: `{ status: { state: "thinking" | "waiting", text: string, role: string } | null }`

### Module Pills

Centered row of pill buttons shown only in empty state.

- One pill per module: Orders, Inventory, Prep, Food Cost, Menu, Marketing
- Clicking a pill navigates to the workspace module page (Next.js router.push)
- Styled: dark background, subtle border, small text, rounded corners
- Disappear when chat becomes active

## Chat Helpers (lib/chat-helpers.ts)

Three functions ported from legacy `carabiner-store.js`:

### cleanOperationalCopy(value: string): string
Strips internal Agent Zero language:
- Remove prefixes: "Using", "Writing"
- Replace tool names: "code_execution_tool" → "operational workflow", "browser_agent" → "vendor workflow", "document_query" → "document review", "restaurant_ops" → "restaurant ops"

### mapInternalAgentToRestaurantRole(log: AgentLog): string
Derives restaurant role from agent log content by keyword matching:
- recipe/prep/menu/food cost/kitchen/chef → "Head Chef"
- invoice/accounting/ap/reconciliation → "Senior Accountant"
- marketing/campaign/launch/research/social → "Marketing Specialist"
- inventory/ordering/vendor/purchase/procurement → "Assistant GM"
- default → "GM"

### deriveConversationStatus(log: AgentLog): StatusPayload | null
Converts agent log entries to UI status objects:
- `{ state: "thinking" | "waiting", text: string, role: string }`
- Log type "progress" → thinking state with cleaned activity text
- Log type "tool" → thinking state with tool label
- Log type "response" → waiting state
- Log type "error" → waiting state with "Needs attention"

Also includes `cleanVisibleActivityText()` which extends `cleanOperationalCopy` by removing agent references (A0-A9, "agent", "subagent", "subordinate", "superior").

## Type Definitions

```typescript
// In lib/api.ts or lib/chat-helpers.ts

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface AgentLog {
  type: "progress" | "agent" | "tool" | "response" | "error" | "warning";
  heading?: string;
  content?: string;
  kvps?: {
    step?: string;
    tool_name?: string;
    _tool_name?: string;
    [key: string]: string | undefined;
  };
}

interface StatusPayload {
  state: "thinking" | "waiting" | "error";
  text: string;
  role: string;
}
```

## Chat Store (Zustand)

Add to existing `workspace-store.ts`:

```typescript
messages: ChatMessage[]           // { id, role, content, timestamp }
isStreaming: boolean               // true while receiving chunks
streamingStatus: StatusPayload | null  // current status pill data
addMessage: (msg) => void
appendToLastMessage: (chunk) => void
setStreaming: (v) => void
setStreamingStatus: (s) => void
clearMessages: () => void
```

## Error Handling

- **Socket disconnect during stream**: 10-second timeout on `isStreaming`. If no chunk received in 10s, set `isStreaming: false`, show error message in assistant bubble ("Connection lost. Try again.").
- **Send failure**: If socket is disconnected when user sends, show toast: "Not connected to CarabinerOS engine." Don't add the user message to the list.
- **Empty message**: Prevent sending empty strings. If rotating prompt is active, Enter sends that prompt. If user cleared the input, Enter does nothing.
- **Rapid sends**: Composer is disabled while streaming. Queue not needed — user waits for response.

## Mock Streaming Backend

**Note:** This replaces the existing placeholder `chat_message` handler in `engine/main.py` (line ~56).

Update `engine/main.py` Socket.IO handler:

```python
@sio.on("chat_message")
async def handle_chat_message(sid, data):
    message = data.get("message", "")
    context_id = data.get("context_id", "default")

    # 1. Acknowledge
    await sio.emit("status_update", {
        "context_id": context_id,
        "status": "thinking",
        "detail": "Processing your request"
    }, to=sid)

    # 2. Simulate status transitions
    await asyncio.sleep(0.5)
    await sio.emit("status_update", {
        "context_id": context_id,
        "status": "thinking",
        "detail": "Checking inventory levels"
    }, to=sid)

    await asyncio.sleep(0.5)
    await sio.emit("status_update", {
        "context_id": context_id,
        "status": "thinking",
        "detail": "Drafting response"
    }, to=sid)

    # 3. Stream response word by word
    response = f"I've analyzed your request: \"{message[:80]}\".\n\nHere's what I found:\n\n- **Inventory check** completed for the active location\n- **Par levels** are within normal range for 3 of 5 key items\n- **Two items** are below par and may need replenishment\n\nWould you like me to draft an order for the items that need restocking?"

    full = ""
    for word in response.split(" "):
        full += word + " "
        await sio.emit("response_stream", {
            "context_id": context_id,
            "chunk": word + " ",
            "full": full.strip()
        }, to=sid)
        await asyncio.sleep(0.05)

    # 4. Done
    await sio.emit("status_update", {
        "context_id": context_id,
        "status": "waiting"
    }, to=sid)
```

## Socket.IO Event Handling (Frontend)

Update `use-socket.ts` to handle chat events:

- `response_stream` → `appendToLastMessage(chunk)` + ensure assistant message exists
- `status_update` → `setStreamingStatus(deriveStatus)` or `setStreaming(false)` on "waiting"

## UI States

### Empty State
- Logo centered
- "Good morning" + subtitle
- Composer with rotating prompt placeholder
- Module pills below
- No messages, no status pill

### Sending
- User bubble appears (right-aligned)
- Composer disabled
- Status pill fades in: "● GM · Processing your request"

### Streaming
- Status pill updates: "● Assistant GM · Checking inventory levels"
- Assistant bubble appears and grows as chunks arrive
- Cursor blink at end of text
- Auto-scroll follows new content

### Complete
- Status pill fades out
- Assistant bubble finalized (no cursor)
- Composer re-enables
- User can send another message

## Animations

- **Prompt rotation**: crossfade between prompts (opacity 0 → 0.35, 8s cycle)
- **Status pill**: pulse animation on dot (2.6s), fade in/out (200ms)
- **Streaming cursor**: blink animation at end of assistant text (1s)
- **Message appear**: subtle slide-up + fade-in (150ms)
- **Module pills**: fade out when first message sent (200ms)

## Accessibility

- Composer textarea has `aria-label="Message CarabinerOS"`
- Rotating placeholder uses `aria-live="off"` to prevent repeated screen reader announcements
- Message list container uses `aria-live="polite"` for new message announcements
- Status pill uses `role="status"` for live announcements
- Enter-to-send behavior documented via `aria-describedby` hint on composer
- Focus moves to composer after page load

## Known Limitations (Deferred)

- **File upload**: Attach button shows file picker but upload logic is deferred to Phase 5
- **Conversation persistence**: Messages lost on page refresh — no backend storage yet
- **Multiple conversations**: Single session only — list/switch comes later
- **Real Agent Zero responses**: Mock backend — real wiring in Phase 5

## Exit Criteria

1. Home page is a full-screen centered chat interface
2. Rotating prompts cycle inside the composer as placeholder text
3. Enter key executes the current prompt, typing replaces it
4. User messages appear as right-aligned bubbles
5. Mock streaming response appears word-by-word in left-aligned assistant bubble
6. Status pill shows simulated agent activity between messages
7. Markdown renders correctly in assistant responses (lists, bold, code)
8. Auto-scroll follows streaming content
9. Module pills navigate to workspace pages
10. Sidebar navigation still works alongside chat
