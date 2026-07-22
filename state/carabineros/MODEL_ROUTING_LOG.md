# Model Routing Log

Tracks model provider routing decisions. This is a VPS control-plane function — NOT implemented in the CarabinerOS product repository.

## Active Model Route (VPS Control Plane)

- **Primary**: MiniMax M3 (minimax-oauth)
- **Fallback chain**:
  1. grok-4.3 (xai-oauth)
  2. gpt-5.5 (openai-codex)
  3. tencent/hy3:free (nous)
- **OpenRouter**: Excluded (no key in active profile)
- **Config**: /root/carabineros/var/hermes-home/config.yaml

## Product Note

The CarabinerOS product itself does NOT implement model/provider routing. The bridge delegates intelligence to the Hermes gateway via `CARABINER_RUNTIME=hermes` and `HERMES_BASE_URL`. Provider fallback is handled entirely by the VPS control plane (Hermes gateway config).

## Current Session

- **Model**: poolside/laguna-s-2.1:free (Nous Portal)
- **Provider**: nous
- **Status**: Stable — no further mid-task changes
