# Architecture Decisions

| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| 2026-03-20 | Initial onboard scan | Baseline project context for AI sessions | Active |
| 2026-03-20 | Warm hospitality color palette (oklch hue 50-70) | User-directed "warm hospitality" feel — amber/gold primary, warm charcoal bg. Based on @rune/ui palette-picker data: Restaurant/Food Service + Hotel/Hospitality + Bakery/Cafe blended palettes. | Active |
| 2026-03-20 | Glass utility classes (glass-subtle, warm-glow, gradient-text-warm) | Custom CSS utilities for backdrop-blur and glow effects. Kept as vanilla CSS classes (not Tailwind plugin) for simplicity. | Active |
| 2026-03-20 | Per-metric KPI card accent colors | Orders=blue, Food Cost=amber, Prep=green, Covers=violet. Dashboard reads at a glance instead of monochrome grey. | Active |
| 2026-03-20 | Vanilla theme toggle (no next-themes) | localStorage + classList.toggle + inline script for flash-free hydration. No new dependency. Default remains dark mode. | Active |
| 2026-03-20 | Action Cards: A0 decides IF, Expo decides HOW | A0 has conversation context to judge card-worthiness. Expo Agent formats the card (priority, summary, stats). Avoids hardcoded tool-based card generation. | Active |
| 2026-03-20 | Action Cards: Expo Agent with reactive + proactive modes | Reactive: A0 delegates after DB mutations. Proactive: scheduled hourly sweeps of today's data only. No historical data resurfaces. | Active |
| 2026-03-20 | Action Cards: standalone Socket.IO events (not state_push) | Cards arrive via dedicated action_card/card_reply events, not through the snapshot envelope. Keeps card state decoupled from A0's state_push pipeline. | Active |
| 2026-03-20 | Action Cards: inline chat scoped to card context | Card chatbox sends messages with card context (itemId, module). A0 responds via card_reply. Main chat thread is not affected. Chat thread is frontend-only, not persisted. | Active |
