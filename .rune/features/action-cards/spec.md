# Action Cards — Feature Spec

See full design: `docs/superpowers/specs/2026-03-20-action-cards-design.md`

## Summary
The expo window of CarabinerOS. DB changes pass through an Expo Agent (A0 sub-agent) that decides card-worthiness and formats action cards. Cards appear in a slide-over panel, are expandable with inline chat, and can be committed or dismissed by the chef. Expo also runs proactive daily sweeps.

## Key Decisions (from brainstorm)
- A0 decides IF, Expo decides HOW (option C)
- Slide-over panel layout (existing NotificationPanel evolved)
- Full panel takeover on card expand
- Inline chat scoped to card context (no main chat bleed)
- Urgency banner with count + earliest deadline
- Proactive sweeps limited to current business day only
- Cards are session-scoped / ephemeral for v1

## Constraints (from decisions.md)
- Warm hospitality color palette (oklch hue 50-70)
- Glass utility classes (glass-subtle, warm-glow)
- Per-metric accent colors for visual consistency
