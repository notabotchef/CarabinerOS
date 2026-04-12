# Feature: Voice Chat

## Overview
Add voice recognition (STT) and text-to-speech (TTS) to the main chat UI. Backend endpoints already exist (Whisper `/api/transcribe`, Kokoro `/api/synthesize`). Work is frontend-only + enabling preload. Phase 3 (mobile PWA voice) is a future TODO — planned but not executed.

## Phases
| # | Name | Status | Plan File | Summary |
|---|------|--------|-----------|---------|
| 1 | Voice Input (STT) | ✅ Complete | plan-voice-chat-phase1.md | useVoiceRecorder hook, mic button in composer, transcribe flow |
| 2 | Voice Output (TTS) | ✅ Complete | plan-voice-chat-phase2.md | Audio player, speaker icon on messages, synthesize flow |
| 3 | Mobile Voice (TODO) | ⬚ Pending | plan-voice-chat-phase3.md | PWA manifest, mobile-optimized voice UI, hands-free mode |

## Key Decisions
- **MediaRecorder API over Web Speech API** — Web Speech API has poor cross-browser support and sends audio to Google. MediaRecorder captures locally, sends to our Whisper backend for privacy + accuracy.
- **Transcribe-then-confirm over live-stream** — User records, sees transcribed text in input, then confirms send. Simpler UX, avoids partial transcription noise.
- **No backend changes** — `/api/transcribe` and `/api/synthesize` are ready. Only uncomment preload for faster cold-start.
- **Phase 3 is plan-only** — mobile PWA voice is documented for future execution, not part of this sprint.

## Decision Compliance
- Decisions (locked): Design tokens from DESIGN_TOKENS.md apply to all new UI
- Discretion (agent): Chose WAV format for recording (Whisper native format, no transcoding)
- Deferred: Streaming TTS (chunked audio playback), voice-to-voice mode

## Architecture
```
[Mic Button] → MediaRecorder → WAV Blob → base64 → POST /api/transcribe → text → input field → send
[Speaker Icon] → POST /api/synthesize → base64 WAV → HTMLAudioElement.play()
```

## Dependencies
- Whisper model: downloaded on first use (or preloaded at startup)
- Kokoro TTS model: downloaded on first use (or preloaded at startup)
- Browser: MediaRecorder API (Chrome 49+, Firefox 25+, Safari 14.1+)

## Risks
- **Model download delay**: First transcription triggers ~100MB download. Mitigation: enable preload, show loading state.
- **Browser mic permission**: User may deny. Mitigation: graceful error with re-prompt instructions.
- **Large audio files**: Long recordings produce big base64 payloads. Mitigation: cap recording at 60 seconds.
