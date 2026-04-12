# Phase 1: Voice Input (STT)

## Goal
Users can tap a microphone button in the chat composer, record audio, see the transcribed text in the input field, and confirm to send. Backend Whisper endpoint already exists — this phase is frontend + enabling preload.

## Data Flow
```
[Mic Button click] → navigator.mediaDevices.getUserMedia({ audio: true })
       ↓
MediaRecorder(stream, { mimeType: "audio/webm" })
       ↓
recorder.ondataavailable → Blob[] → new Blob(chunks)
       ↓
Blob → FileReader.readAsDataURL → base64 string (strip prefix)
       ↓
POST /api/transcribe { audio: base64, ctxid: contextId }
       ↓
Response { text: "transcribed text", language: "en" }
       ↓
setText(result.text) → user sees text in input → confirms send
```

## Code Contracts

```typescript
// frontend/src/hooks/use-voice-recorder.ts

type RecordingState = "idle" | "recording" | "transcribing";

interface UseVoiceRecorderOptions {
  contextId: string;
  maxDurationMs?: number;  // default 60_000 (60s)
  onTranscript: (text: string) => void;
  onError: (error: string) => void;
}

interface UseVoiceRecorderReturn {
  state: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  elapsedMs: number;
}

function useVoiceRecorder(options: UseVoiceRecorderOptions): UseVoiceRecorderReturn;
```

```typescript
// API call shape (inside the hook)
async function transcribeAudio(base64Audio: string, contextId: string): Promise<string> {
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio: base64Audio, ctxid: contextId }),
  });
  const data = await res.json();
  return data.text ?? "";
}
```

```typescript
// chat-composer.tsx additions
interface ChatComposerProps {
  onSend: (text: string) => void;
  loading?: boolean;
  placeholder?: string;
  queueCount?: number;
  showSuggestions?: boolean;
  contextId?: string;  // NEW — needed for transcribe API
}
```

## Tasks

### Wave 1 (parallel — no dependencies)

- [x] Task 1 — Create useVoiceRecorder hook
  - File: `frontend/src/hooks/use-voice-recorder.ts` (new)
  - Test: manual — record, check console log of transcript
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(voice): add useVoiceRecorder hook with MediaRecorder + transcribe`
  - Logic:
    - `startRecording`: request mic permission, create MediaRecorder, start recording, start elapsed timer (setInterval every 100ms)
    - `stopRecording`: stop MediaRecorder, collect chunks into Blob, convert to base64, POST to `/api/transcribe`, call `onTranscript(text)`
    - `cancelRecording`: stop MediaRecorder, discard chunks, reset state to "idle"
    - Auto-stop at `maxDurationMs` (default 60s)
    - Set state transitions: idle → recording → transcribing → idle
    - Cleanup: stop all tracks on stream when done, clear interval
  - Edge: getUserMedia throws (no mic / permission denied) → call `onError("Microphone access denied. Please allow microphone permission in your browser settings.")`, stay "idle"
  - Edge: transcribe API returns error → call `onError("Transcription failed. Please try again.")`, reset to "idle"
  - Edge: empty transcription result → call `onError("No speech detected. Please try again.")`, reset to "idle"

- [x] Task 2 — Enable Whisper preload in backend
  - File: `engine/agent-zero/preload.py` (modify line 43-44)
  - Test: `python -c "from helpers import whisper; print('ok')"`
  - Verify: start backend, check logs for "Preload completed"
  - Commit: `feat(voice): enable whisper STT preload for faster first transcription`
  - Logic: uncomment `preload_whisper()` in the tasks array (line 43). Leave `preload_kokoro()` commented — Phase 2.
  - Edge: N/A — preload already has try/except

### Wave 2 (depends on Wave 1)

- [x] Task 3 — Add microphone button + recording UI to chat composer
  - File: `frontend/src/components/chat-composer.tsx` (modify)
  - depends_on: [Task 1]
  - Test: manual — click mic, see recording indicator, stop, see text in input
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(voice): add mic button and recording indicator to chat composer`
  - Logic:
    - Import `useVoiceRecorder` and `Mic`, `Square`, `Loader2` from lucide-react
    - Add `contextId` prop to ChatComposerProps
    - Wire useVoiceRecorder: `onTranscript` sets input value via `setValue(text)`, `onError` shows toast or inline error
    - Add mic button BETWEEN attachment button and input container (same styling as attach button: `size-8 rounded-lg`)
    - Three states for mic button:
      - `idle`: Mic icon, muted color, click → startRecording
      - `recording`: Square icon (stop), red/destructive color with pulse animation, click → stopRecording. Show elapsed time badge next to button.
      - `transcribing`: Loader2 icon with spin animation, disabled
    - Recording indicator: small red dot + elapsed time (e.g., "0:05") shown inline next to mic button
    - While recording, hide the text input placeholder, show "Recording..." text
    - Disable send button while recording or transcribing
  - Edge: if `contextId` not provided, mic button hidden (graceful degradation)
  - Rejection: DO NOT replace the text input with a voice-only mode — voice supplements text

- [x] Task 4 — Pass contextId from chat page to composer
  - File: `frontend/src/app/chat/[contextId]/page.tsx` (modify)
  - depends_on: [Task 3]
  - Test: manual — verify contextId flows through
  - Verify: `cd frontend && pnpm build`
  - Commit: `feat(voice): pass contextId to chat composer for transcribe API`
  - Logic: the page already has `contextId` from route params. Pass it to `<ChatComposer contextId={contextId} />`. Check how `ChatComposer` is instantiated in the page/chat-view — may need to thread through `chat-view.tsx` as well.
  - touches: may also need `frontend/src/components/chat-view.tsx` if composer is rendered there

### Wave 3 (depends on Wave 2)

- [ ] Task 5 — Integration test: full voice input flow
  - File: N/A — manual testing
  - depends_on: [Task 3, Task 4]
  - Test: this IS the test task
  - Verify: start backend + frontend, open chat, click mic, speak, verify text appears in input, send message, verify agent responds
  - Commit: N/A (no code change)
  - Cases:
    - Happy path: record 3s → stop → text appears → send → agent responds
    - Permission denied: click mic in incognito → error message shown
    - Empty speech: record silence → "No speech detected" error
    - Long recording: record 60s+ → auto-stops, transcribes
    - Cancel: start recording → click cancel → input stays empty

## Failure Scenarios

| When | Then | Error Type |
|------|------|-----------|
| Browser lacks MediaRecorder | mic button hidden (feature detection) | No error — graceful degradation |
| User denies mic permission | onError("Microphone access denied...") shown as inline message | UX message, no throw |
| `/api/transcribe` returns 500 | onError("Transcription failed..."), reset to idle | UX message |
| `/api/transcribe` returns empty text | onError("No speech detected..."), reset to idle | UX message |
| Network timeout during transcribe | onError("Transcription timed out..."), reset to idle | UX message |
| Recording exceeds maxDurationMs | Auto-stop, proceed to transcribe normally | No error |
| MediaRecorder.stop() called when not recording | Guard: only call stop if state === "recording" | No error |

## Rejection Criteria (DO NOT)

- DO NOT use the Web Speech API (SpeechRecognition) — poor cross-browser, sends audio to Google
- DO NOT stream audio chunks during recording — collect all chunks, send once on stop
- DO NOT auto-send after transcription — user MUST see text in input and confirm
- DO NOT modify any backend Python files except `preload.py` line 43 — endpoints are ready
- DO NOT add new npm dependencies — MediaRecorder and fetch are native
- DO NOT use `any` type — full TypeScript strict
- DO NOT hardcode colors — use Tailwind classes per DESIGN_TOKENS.md

## Cross-Phase Context

- **Assumes**: nothing from prior phases (this is Phase 1)
- **Exports for Phase 2**: `useVoiceRecorder` hook pattern establishes audio handling conventions. `contextId` prop threaded to composer. Phase 2 adds audio player using same fetch pattern to `/api/synthesize`.
- **Interface contract**: `RecordingState` type and `UseVoiceRecorderReturn` shape are stable — Phase 2 may import types.

## Acceptance Criteria
- [ ] Mic button visible in chat composer (between attach and input)
- [ ] Click mic → browser requests microphone permission
- [ ] Recording state shows red indicator + elapsed time
- [ ] Stop → transcription sent to backend → text appears in input
- [ ] User can edit transcribed text before sending
- [ ] Error states handled: permission denied, transcription failure, empty speech
- [ ] Recording auto-stops at 60 seconds
- [ ] Cancel recording discards audio, resets to idle
- [ ] `pnpm build` passes with no TypeScript errors
- [ ] Whisper preload enabled in `preload.py`

## Files Touched
- `frontend/src/hooks/use-voice-recorder.ts` — new
- `frontend/src/components/chat-composer.tsx` — modify
- `frontend/src/app/chat/[contextId]/page.tsx` — modify (possibly `chat-view.tsx` too)
- `engine/agent-zero/preload.py` — modify (uncomment line 43)
