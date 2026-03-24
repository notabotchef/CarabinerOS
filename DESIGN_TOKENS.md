# Design Tokens — CarabinerOS

**MANDATORY READ before writing any frontend component.**

This file is the single source of truth for all visual decisions. Every color, font, shadow, radius, and spacing value in the frontend MUST come from this file. If a value isn't here, add it here first, then use it.

## Identity

**Midnight Kitchen** — KDS meets luxury dark dashboard. A Michelin-star kitchen's display system designed by the Linear/Vercel team. Warm, professional, scannable in 3 seconds during a 300-cover Saturday service.

## Fonts

| Role | Font | Tailwind Class | CSS Variable | When to Use |
|------|------|---------------|-------------|-------------|
| **Text** | DM Sans | (default, no class needed) | `var(--font-sans)` | Headings, body, labels, descriptions |
| **Numbers** | Geist Mono | `font-mono` | `var(--font-geist-mono)` | ALL numeric values: prices, percentages, dates, timestamps, KPIs, table numbers, axis labels |

**Rules:**
- Never use inline `fontFamily` in style objects. Use `font-mono` class or let sans cascade.
- Never define font constants in JS (`const MONO = ...`). Use Tailwind classes.
- Every `$` value, every `%` value, every date display = `font-mono`.

## Colors

### Semantic Tokens (use these, not raw values)

| Token | Tailwind Class | Light (oklch) | Dark (oklch) | Use For |
|-------|---------------|---------------|-------------|---------|
| `background` | `bg-background` | `0.97 0.005 230` | `0.16 0.025 250` | Page bg |
| `card` | `bg-card` | `0.99 0.002 230` | `0.20 0.025 250` | Card/panel bg |
| `foreground` | `text-foreground` | `0.18 0.03 250` | `0.95 0.005 230` | Primary text |
| `muted-foreground` | `text-muted-foreground` | `0.48 0.02 250` | `0.60 0.015 230` | Secondary text |
| `primary` | `text-primary` / `bg-primary` | `0.55 0.14 165` | `0.72 0.22 160` | Brand accent, links, active states |
| `border` | `border-border` | `0.88 0.005 230` | `white/8%` | All borders |
| `destructive` | `text-destructive` | `0.55 0.20 27` | `0.60 0.20 25` | Errors, danger |

### Type Accent Colors (action card types, chart accents)

| Type | Tailwind Prefix | Hex (for SVG/Recharts) | Use For |
|------|----------------|----------------------|---------|
| **urgent** | `amber-500` | `#f59e0b` | Urgent cards, COGS, food cost line |
| **action** | `blue-500` | `#3b82f6` | Action cards, below-target indicators |
| **update** | `emerald-400` | `#34d399` | Update cards, revenue, profit, in-range |
| **info** | `violet-500` | `#8b5cf6` | Info cards |
| **danger** | `red-500` | `#ef4444` | Over-target, losses, critical alerts |

**Rules:**
- In Tailwind classes: use keywords (`text-amber-500`, `border-l-emerald-400`)
- In Recharts/SVG: use the hex equivalents from the table above
- NEVER hardcode hex in Tailwind classNames — use the keyword
- NEVER define color constants in JS objects if Tailwind classes work

### Opacity Scale (standardized)

Only use these opacity levels:

| Level | Value | Use For |
|-------|-------|---------|
| `ghost` | `5%` (`/5`) | Backgrounds, subtle fills, chart areas |
| `subtle` | `10%` (`/10`) | Hover states, badges, pills |
| `light` | `20%` (`/20`) | Active badges, emphasis backgrounds |
| `medium` | `40%` (`/40`) | Borders, dividers |
| `strong` | `60%` (`/60`) | Header borders, prominent dividers |
| `heavy` | `85%` (`/85`) | Text on colored backgrounds |

Do NOT use arbitrary opacity values like `/3`, `/8`, `/12`, `/15`, `/[0.03]`. Pick the nearest standard level.

## Shadows

| Token | Tailwind Class | Value | Use For |
|-------|---------------|-------|---------|
| `sm` | `shadow-sm` | (Tailwind default) | Cards at rest |
| `md` | `shadow-md` | (Tailwind default) | Cards on hover |
| `glow` | `shadow-[0_0_20px_oklch(0.72_0.22_160_/_0.12)]` | Primary glow | Focus rings, active inputs |
| `float` | `shadow-[0_8px_32px_oklch(0_0_0_/_0.25)]` | Deep float | Tooltips, popovers, dropdowns |

**Rules:**
- Cards: `shadow-sm` at rest, `shadow-md` on hover. No custom shadows on cards.
- Focus: use `glow` token. No other glow values.
- Tooltips: use `float` token. Always darker bg than parent surface.
- NEVER use `shadow-lg` — it's too heavy for this design. Use `shadow-md` instead.

## Border Radius

| Token | Tailwind Class | Value | Use For |
|-------|---------------|-------|---------|
| `sm` | `rounded-md` | 6px | Small pills, badges, tags |
| `md` | `rounded-lg` | 8px | Inputs, small buttons |
| `lg` | `rounded-xl` | 12px | Cards, panels, modals |
| `full` | `rounded-full` | 9999px | Avatars, round buttons |

**Rules:**
- ALL cards use `rounded-xl`. No exceptions. No `rounded-[13px]`, no `rounded-2xl`.
- Buttons: `rounded-lg` for rectangular, `rounded-full` for pill/icon.
- Do NOT use arbitrary radius values (`rounded-[Xpx]`).

## Spacing

### Card Padding

| Element | Padding | Tailwind |
|---------|---------|----------|
| Card body | 16px | `p-4` |
| Card header | 16px horizontal, 12px vertical | `px-4 py-3` |
| Card footer | 16px horizontal, 12px vertical | `px-4 py-3` |
| Section header (page-level) | 16px horizontal, 12px vertical | `px-4 py-3` |
| Panel/drawer header | 20px horizontal, 16px vertical | `px-5 py-4` |

### Grid Gaps

| Context | Gap | Tailwind |
|---------|-----|----------|
| Card grid | 16px | `gap-4` |
| KPI row | 16px | `gap-4` |
| Inline items (badges, pills) | 8px | `gap-2` |
| Stacked sections | 24px | `space-y-6` |

**Rules:**
- Use `p-4` for card bodies. Not `p-3`, not `p-5`, not `px-5 py-3`.
- Use `gap-4` for grids. Not `gap-3`, not `gap-5`.
- Header areas (panels, drawers) are the ONE exception that uses `px-5 py-4`.

## Typography Scale

Only these sizes are allowed:

| Size | Tailwind | Use For |
|------|----------|---------|
| 10px | `text-[10px]` | Timestamps, axis labels, micro-labels |
| 11px | `text-[11px]` | Badge text, secondary labels |
| 12px | `text-xs` | Body small, card descriptions |
| 13px | `text-[13px]` | Body default in dense contexts (tables) |
| 14px | `text-sm` | Standard body text |
| 16px | `text-base` | Card titles, section headers |
| 20px | `text-xl` | Page titles |
| 30px | `text-3xl` | KPI hero numbers |

**Banned sizes:** 9px (too small), 15px (use 14 or 16), 18px (use 16 or 20).

## Charts (Recharts-specific)

Since Recharts uses SVG and can't read CSS variables, use these hex values:

| Element | Value | Notes |
|---------|-------|-------|
| Revenue fill | `#34d399` gradient 25% → 0% | emerald-400 |
| Revenue stroke | `#34d399` 2px | emerald-400 |
| Food cost line | `#f59e0b` 2.5px | amber-500 |
| In-range dot | `#34d399` | emerald-400 |
| Over-target dot | `#ef4444` | red-500 |
| Under-target dot | `#3b82f6` | blue-500 |
| Bar fill | `#34d399` | emerald-400, all bars same |
| Grid (dark) | `rgba(255,255,255,0.04)` | Solid, horizontal only |
| Grid (light) | `rgba(0,0,0,0.06)` | Solid, horizontal only |
| Axis text (dark) | `rgba(255,255,255,0.30)` | Geist Mono 10px |
| Axis text (light) | `rgba(0,0,0,0.40)` | Geist Mono 10px |
| Budget/ref line (dark) | `rgba(255,255,255,0.15)` | NOT brand color |
| Budget/ref line (light) | `rgba(0,0,0,0.15)` | NOT brand color |
| Tooltip bg (dark) | `#141b27` | Darker than card |
| Tooltip bg (light) | `#ffffff` | White with shadow |
| Tooltip border (dark) | `rgba(255,255,255,0.06)` | |
| Tooltip border (light) | `rgba(0,0,0,0.08)` | |
| Tooltip shadow (dark) | `0 8px 32px rgba(0,0,0,0.5)` | |
| Tooltip shadow (light) | `0 8px 32px rgba(0,0,0,0.12)` | |

**Rules:**
- Always use `useChartTheme()` hook for theme-dependent values — never hardcode dark-only.
- Chart height minimum: 260px.
- X-axis labels: `interval={2}` to prevent crowding.
- Tooltips: custom component, NEVER default `contentStyle`.

## Anti-Patterns (MUST NOT)

- No hardcoded hex in Tailwind classNames (use keywords: `amber-500`, not `#f59e0b`)
- No inline `fontFamily` in style objects (use `font-mono` class)
- No JS color constant objects (`const TYPE_COLORS = { urgent: "#fbbf24" }`)
- No `rounded-[Xpx]` arbitrary radius (use standard tokens)
- No `shadow-lg` (too heavy — use `shadow-md`)
- No opacity values outside the standard scale
- No padding other than `p-4` for card bodies
- No `gap-3` or `gap-5` for grids (use `gap-4`)
- No dark-only rgba() without light mode counterpart
- No `type="monotone"` for financial line/area charts (use `natural` or `linear`)
