# Phase 2: Voice Output (TTS)

## Goal
Assistant responses can be played as audio via a speaker icon. Clicking the icon sends the message text to `/api/synthesize` and plays the returned WAV audio. Optional auto-play toggle.

## Data Flow
```
[Speaker Icon click on assistant message]
       ↓
POST /api/synthesize { text: messageContent, ctxid: contextId }
       ↓
Response { audio: "base64-wav-string", success: true }
       ↓
"data:audio/wav;base64," + audio → new Audio(dataUrl).play()
       ↓
Icon state: idle → loading → playing → idle
```

## Code Contracts

```typescript
// frontend/src/hooks/use-tts.ts

type TtsState = "idle" | "loading" | "playing";

interface UseTtsOptions {
  contextId: string;
}

interface UseTtsReturn {
  state: TtsState;
  currentMessageId: string | null;
  play: (messageId: string, text: string) => Promise<void>;
  stop: () => void;
}

function useTts(options: UseTtsOptions): UseTtsReturn;
```

```typescript
// frontend/src/components/message-tts-button.tsx

interface MessageTtsButtonProps {
  messageId: string;
  text: string;
  ttsState: TtsState;
  currentMessageId: string | null;
  onPlay: (messageId: string, text: string) => Promise<void>;
  onStop: () => void;
}
```

## Tasks

### Wave 1 (parallel — no dependencies)

- [x] Task 1 — Create useTts hook
  - File: `frontend/src/hooks/use-tts.ts` (new)
  - Test: manual — call play(), check audio output
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(voice): add useTts hook for text-to-speech playback`
  - Logic:
    - `play(messageId, text)`: set state "loading", POST to `/api/synthesize`, create Audio element from base64, set state "playing", listen for `ended` event → set state "idle"
    - `stop()`: pause audio, set state "idle", clear currentMessageId
    - Store Audio ref to prevent garbage collection during playback
    - Cleanup: stop audio on unmount
    - Only one message plays at a time — calling play() while playing stops previous
  - Edge: synthesize returns `{ success: false, error }` → log error, reset to idle
  - Edge: Audio playback fails (no audio output device) → catch error, reset to idle

- [x] Task 2 — Enable Kokoro TTS preload
  - File: `engine/agent-zero/preload.py` (modify line 44)
  - Test: start backend, check logs
  - Verify: backend starts without error
  - Commit: `feat(voice): enable kokoro TTS preload`
  - Logic: uncomment `preload_kokoro()` in tasks array (line 44)

### Wave 2 (depends on Wave 1)

- [x] Task 3 — Create MessageTtsButton component
  - File: `frontend/src/components/message-tts-button.tsx` (new)
  - depends_on: [Task 1]
  - Test: manual — render button, click, verify states
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(voice): add TTS speaker button component for messages`
  - Logic:
    - Three icon states: `Volume2` (idle), `Loader2` spin (loading), `VolumeX` (playing — click to stop)
    - Styling: `size-6 rounded-md text-muted-foreground/50 hover:text-muted-foreground` — subtle, not distracting
    - Only show for assistant messages (not user messages)
    - Button disabled while another message is loading
  - Edge: message text is empty → hide button

- [x] Task 4 — Wire TTS button into message list
  - File: `frontend/src/components/message-list.tsx` (modify)
  - depends_on: [Task 1, Task 3]
  - touches: [frontend/src/components/message-list.tsx]
  - Test: manual — see speaker icon on assistant messages
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(voice): add TTS button to assistant messages in chat`
  - Logic:
    - Import `useTts` at the chat-view or message-list level (wherever contextId is available)
    - For each assistant message, render `<MessageTtsButton>` with message id and text content
    - Pass tts state + handlers down
    - Strip markdown from text before sending to synthesize (remove `**`, `#`, code blocks, links)
  - Edge: message is still streaming (partial) → hide TTS button until complete

### Wave 3 (depends on Wave 2)

- [ ] Task 5 — Integration test: full TTS flow
  - File: N/A — manual testing
  - depends_on: [Task 3, Task 4]
  - Test: this IS the test task
  - Verify: open chat, send message, wait for response, click speaker icon, hear audio
  - Commit: N/A
  - Cases:
    - Happy path: click speaker → loading → audio plays → icon returns to idle
    - Stop: click during playback → audio stops
    - Switch: click speaker on message A, then on message B → A stops, B starts
    - Long text: send question that produces long response → synthesize handles it
    - Error: stop backend → click speaker → graceful error

## Failure Scenarios

| When | Then | Error Type |
|------|------|-----------|
| `/api/synthesize` returns 500 | Reset to idle, no audio plays | Silent failure |
| `/api/synthesize` returns `{ success: false }` | Reset to idle | Silent failure |
| Audio element fails to play (autoplay policy) | Catch error, reset to idle | Browser restriction |
| Network timeout | Reset to idle after 30s | Timeout |
| Empty message text | TTS button hidden | No error |
| Kokoro model not downloaded yet | First call triggers download — slow but works | Delay (show loading) |

## Rejection Criteria (DO NOT)

- DO NOT auto-play TTS by default — user must click speaker icon (autoplay is intrusive in a kitchen)
- DO NOT send raw markdown to synthesize — strip formatting first
- DO NOT play multiple messages simultaneously — one at a time
- DO NOT add audio waveform visualization — keep it simple (Phase 3 mobile may add this)
- DO NOT modify backend synthesize.py — endpoint is ready
- DO NOT add new npm dependencies

## Cross-Phase Context

- **Assumes from Phase 1**: `contextId` prop is threaded to chat components. `/api/transcribe` pattern established (same fetch-to-backend pattern for `/api/synthesize`).
- **Exports for Phase 3**: `useTts` hook and `MessageTtsButton` component will be reused on mobile. Mobile phase adds auto-play toggle and voice-first mode.
- **Interface contract**: `TtsState` type is stable. `useTts` return shape won't change.

## Acceptance Criteria
- [ ] Speaker icon visible on assistant messages (not user messages)
- [ ] Click speaker → loading indicator → audio plays → icon returns to idle
- [ ] Click during playback → audio stops
- [ ] Only one message plays at a time
- [ ] Markdown stripped before sending to synthesize
- [ ] No TTS button on empty or streaming messages
- [ ] `pnpm build` passes with no TypeScript errors
- [ ] Kokoro preload enabled in `preload.py`

## Files Touched
- `frontend/src/hooks/use-tts.ts` — new
- `frontend/src/components/message-tts-button.tsx` — new
- `frontend/src/components/message-list.tsx` — modify
- `engine/agent-zero/preload.py` — modify (uncomment line 44)
