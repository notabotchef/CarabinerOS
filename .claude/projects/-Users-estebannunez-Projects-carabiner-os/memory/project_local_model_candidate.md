---
name: Local Model Candidate
description: Qwen3.5-27B Claude 4.6 Opus distilled for local A0 utility model via llama.cpp — $0 inference for cheap routing tier
type: project
---

**Model:** `Jackrong/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled-v2-GGUF`
**Source:** HuggingFace
**Size:** 27B params (fits Apple Silicon 16GB at Q4)
**Format:** GGUF (llama.cpp native)

**Why this model:** Distilled from Claude 4.6 Opus reasoning — inherits strong instruction following. 27B is the sweet spot for local inference on consumer hardware.

**Runtime:** llama.cpp in server mode → litellm proxy → A0 utility_model config. Ollama won't run it; needs llama.cpp directly. Esteban has done this setup before.

**Current setup:** Codex Proxy is primary and working well. Keep it. This model is for the future "cheap" tier in the tiny-router routing stack.

**Cost stack when fully deployed:**
- Skip (tiny-router DeBERTa): $0, 10ms — acknowledgments, closures
- Cheap (Qwen3.5-27B local): $0, ~2-3s — low urgency, confirmations, self-updates
- Full (Codex Proxy): paid — complex reasoning, high urgency
- Fallback (LLM Fallback plugin): paid backup

**How to apply:** When implementing the local inference tier, use this model. Set up: llama.cpp server → litellm proxy → A0 utility_model. TurboQuant KV cache compression can extend context window.
