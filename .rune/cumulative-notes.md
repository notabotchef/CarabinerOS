# Cumulative Notes — Voice Chat

## Phase 1: Voice Input (STT) — COMPLETE
- Created `useVoiceRecorder` hook with MediaRecorder API, base64 encoding, `/api/transcribe` POST
- Fixed React 19 lint error: ref write during render moved to useEffect
- Added mic button (MicButton sub-component) with 3 states: idle/recording/transcribing
- Threaded `contextId` from page -> ChatView -> ChatComposer
- Enabled Whisper preload in `engine/agent-zero/preload.py` (submodule commit)
- No new lint errors or warnings introduced

## Phase 2: Voice Output (TTS) — COMPLETE
- Created `useTts` hook with `/api/synthesize` POST, HTMLAudioElement playback
- Built `stripMarkdown()` utility to clean text before TTS
- Created `MessageTtsButton` component with 3 icon states: Volume2/Loader2/VolumeX
- Wired TTS into MessageList via ChatView (TTS state passed as props)
- Enabled Kokoro preload in `engine/agent-zero/preload.py` (submodule commit)
- No new lint errors or warnings introduced

## Phase 3: Mobile Voice — DEFERRED
- Plan exists but marked as future TODO per master plan
- Not executed in this autopilot run

## Concerns
- None. Zero accumulated warnings across both phases.
- Pre-existing lint error (setState in effect, chat-composer.tsx:118) remains — not related to this work.
