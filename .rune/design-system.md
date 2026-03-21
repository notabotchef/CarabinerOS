# Design System: Carabiner OS
Last Updated: 2026-03-20
Platform: web (Next.js 16, React 19)
Domain: SaaS Dashboard — Restaurant Operations
Style: Data-Dense Dark ("Midnight Kitchen")

## Color Tokens

### Color Space
OKLCH (Okayama Lightness Chroma Hue) — perceptually uniform, excellent for dark/light mode parity.

### Primitive (raw values in OKLCH)

#### Light Mode
```
--background:          oklch(0.97 0.005 230)     /* ~#F8F9FA off-white */
--foreground:          oklch(0.18 0.03 250)      /* ~#1A1D2B dark blue-gray */
--card:                oklch(0.99 0.002 230)     /* ~#FDFDFE near-white */
--primary:             oklch(0.55 0.14 165)      /* ~#1DAFAA teal */
--primary-foreground:  oklch(0.98 0.005 165)     /* light teal text on primary */
--secondary:           oklch(0.94 0.005 230)     /* light cool gray */
--muted:               oklch(0.94 0.005 230)     /* muted gray */
--accent:              oklch(0.92 0.01 230)      /* very light blue-gray */
--destructive:         oklch(0.55 0.20 27)       /* ~#C23F3F red */
--border:              oklch(0.88 0.005 230)     /* light border */
--input:               oklch(0.88 0.005 230)     /* input border */
--ring:                oklch(0.55 0.14 165)      /* focus ring = primary */
```

#### Dark Mode
```
--background:          oklch(0.16 0.025 250)     /* ~#0F1419 deep blue-black */
--foreground:          oklch(0.95 0.005 230)     /* ~#F0F2F5 near-white */
--card:                oklch(0.20 0.025 250)     /* ~#1A2030 dark surface */
--primary:             oklch(0.72 0.22 160)      /* ~#00E5D8 bright emerald */
--destructive:         oklch(0.60 0.20 25)       /* ~#FF4444 bright red */
--border:              oklch(1 0 0 / 8%)         /* subtle white */
--input:               oklch(1 0 0 / 10%)        /* input border */
--ring:                oklch(0.72 0.22 160)      /* bright teal focus */
```

### Semantic (meaning-mapped)
```
--bg-base:        var(--background)       — page background
--bg-surface:     var(--card)             — card/panel background
--bg-elevated:    var(--accent)           — modal/dropdown background
--text-primary:   var(--foreground)       — primary text
--text-secondary: var(--muted-foreground) — secondary/muted text
--border:         var(--border)           — default border
--accent:         var(--primary)          — primary action/brand (teal/emerald)
--success:        emerald-400             — positive signal, status updates
--danger:         var(--destructive)      — error/loss signal
--warning:        amber-400              — urgency, caution
```

### Action Card Status Colors (Tailwind utility classes)

| Type     | Dot Color       | Tag Background     | Border              |
|----------|-----------------|--------------------|-----------------------|
| urgent   | `bg-amber-400`  | `bg-amber-400/10`  | warm-glow shadow      |
| action   | `bg-blue-400`   | `bg-blue-400/10`   | `border-blue-400/20`  |
| update   | `bg-emerald-400`| `bg-emerald-400/10`| default border        |
| info     | `bg-violet-400` | `bg-violet-400/10` | default border        |

### Chart Colors (5-color palette)
```
--chart-1: oklch(0.55 0.14 165)   /* teal (primary) */
--chart-2: oklch(0.55 0.12 45)    /* warm yellow */
--chart-3: oklch(0.50 0.08 260)   /* muted purple */
--chart-4: oklch(0.60 0.14 25)    /* warm orange */
--chart-5: oklch(0.55 0.10 200)   /* cyan */
```

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Display/H1 | DM Sans | 700–800 | 28–36px |
| H2 | DM Sans | 700 | 22–24px |
| H3 | DM Sans | 600 | 18–20px |
| Body | DM Sans | 400–500 | 14–16px |
| Small/Caption | DM Sans | 400 | 12–13px |
| Mono/Numbers | Geist Mono | 400–500 | inherit |
| Tags/Labels | DM Sans | 500–600 | 9–11px uppercase |

**Numbers rule**: Use `font-variant-numeric: tabular-nums` (`.tabular-nums` utility) for ALL numeric values — prices, metrics, counts, IDs. Geist Mono for code/terminal output.

**Line height**: 1.5 for body, 1.2–1.3 for headings.
**Max content width**: 1280px for dashboard, 720px for prose.

## Spacing (8px base)
```
xs:  4px  | sm:  8px  | md: 16px | lg: 24px
xl: 32px  | 2xl: 48px | 3xl: 64px
```

## Border Radius
Base: `--radius: 0.625rem` (10px)
```
sm:  6px  (calc(var(--radius) - 4px))
md:  8px  (calc(var(--radius) - 2px))
lg: 10px  (var(--radius))
xl: 14px  (calc(var(--radius) + 4px))
2xl: 18px
3xl: 22px
4xl: 26px
full: 9999px
```

## Effects

### Glassmorphism
```css
.glass {
  backdrop-filter: blur(16px) saturate(1.4);
}
.glass-subtle {
  backdrop-filter: blur(8px) saturate(1.2);
}
```

### Warm Glow (urgent cards)
```css
.warm-glow {
  box-shadow:
    0 0 0 1px oklch(0.72 0.22 160 / 20%),
    0 2px 16px oklch(0.72 0.22 160 / 12%);
}
```

### Gradient Text
```css
.gradient-text-warm {
  background: linear-gradient(135deg, oklch(0.92 0.01 230), oklch(0.72 0.22 160));
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

### Micro-Interactions (Framer Motion)
- Card hover: `scale(1.01)`, card tap: `scale(0.98)`
- Urgent dot: pulsing animation (1.4s ease-in-out infinite)
- Page transitions: fade + slide (200ms ease)

## Anti-Patterns (MUST NOT generate these)

### Domain-Specific (Restaurant SaaS Dashboard)
- ❌ **Purple/violet as primary accent** — teal/emerald is the brand. Violet is reserved ONLY for `info` card type tags.
- ❌ **Card-grid monotony** — avoid identical card layouts for every section. Mix KPI numbers, action cards, and data tables.
- ❌ **Decorative animations on data** — animations must not delay data visibility. Loading skeletons only.
- ❌ **Missing empty/error/loading states** — every async data view needs all three states.
- ❌ **Generic "Loading..." text** — use context-appropriate loading copy (see UX Writing).
- ❌ **Red for non-error UI** — red/destructive is reserved for errors and urgent alerts. Never decorative.
- ❌ **Fixed-width layouts** — must be responsive at 375px, 768px, 1024px, 1440px.
- ❌ **Solid color backgrounds on glass-capable surfaces** — use `.glass` or `.glass-subtle` for elevated surfaces in dark mode.

### Accessibility Anti-Patterns
- ❌ **`outline-none` without `focus-visible` replacement** — every interactive element needs a visible focus indicator.
- ❌ **Animations without `prefers-reduced-motion` respect** — all Framer Motion animations must check `useReducedMotion()`.
- ❌ **Icon-only buttons without `aria-label`** — every icon button needs an accessible name.
- ❌ **`div onClick` / `span onClick`** — use semantic `<button>` or `<a>` elements.
- ❌ **Touch targets < 24×24px** — minimum 24×24px with 8px gap between targets.

## Platform Notes (Web)
- **Dark mode**: dark-first, with light mode support. Theme stored in `localStorage("theme")`.
- **Theme toggle**: Flash-free via inline `<script>` in `<head>` (theme-script.tsx).
- **HTML class**: `dark` class on `<html>` element.
- **Component library**: shadcn/ui v4.0.8 (Radix UI headless primitives).
- **Icons**: lucide-react (24px default).
- **Animations**: Framer Motion (springs + transitions).
- **CSS**: Tailwind CSS 4.2.2 with `@theme inline` for token injection.
- **Responsive**: Tailwind breakpoints (`sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`).

## Component Library

**shadcn/ui v4.0.8** — 10 core components in `components/ui/`:
badge, button, input, scroll-area, separator, sheet, sidebar, skeleton, table, tooltip

**Custom components** in `components/`:
action-card, action-card-expanded, notification-panel, shell, app-sidebar, theme-toggle, expo-bar, chat-composer

## UX Writing

### Tone
Professional, helpful, time-aware. Restaurant operators are busy — copy must be scannable and action-oriented.

### Templates

**Error messages**: `[What happened] + [Why] + [What to do]`
- "Couldn't load today's orders. The server didn't respond. Tap to retry."
- "Failed to update inventory count. Check your connection and try again."

**Empty states**: `[What's missing] + [How to fill it]`
- "No orders yet today. They'll appear here in real time as they come in."
- "No action cards right now. The kitchen is running smoothly."
- "No prep tasks scheduled. Add items from the menu to start planning."

**Confirmation dialogs**: `[What will happen] + [Reversibility]`
- "Dismiss this card? You can find it later in the activity log."
- "Commit to this action? The kitchen team will be notified."

**Loading text** (context-appropriate, NOT "Loading..."):
- Orders: "Fetching today's orders…"
- Inventory: "Checking stock levels…"
- Action cards: "Scanning for issues…"
- Reports: "Crunching the numbers…"

**Button labels**: Verb-first, specific action.
- ✅ "Place Order", "Update Count", "Dismiss Card", "View Details"
- ❌ "Submit", "OK", "Click Here", "Go"

**Action card copy**:
- Urgent: imperative tone — "Reorder romaine lettuce — 2 days of stock left"
- Action: clear next step — "Approve Thursday's prep schedule"
- Update: past tense — "Delivery from Sysco arrived — 12 items received"
- Info: neutral — "Weekend forecast: 15% above average covers expected"

## Pre-Delivery Checklist

- [ ] Color contrast ≥ 4.5:1 for all text (verify OKLCH pairs in both modes)
- [ ] Focus-visible ring on ALL interactive elements (never `outline-none` alone)
- [ ] Touch targets ≥ 24×24px with 8px gap between targets
- [ ] All icon-only buttons have `aria-label`
- [ ] All inputs have associated `<label>` or `aria-label`
- [ ] Empty state, error state, loading state for all async data views
- [ ] `cursor-pointer` on all clickable non-button elements
- [ ] `prefers-reduced-motion` respected for all Framer Motion animations
- [ ] Dark mode AND light mode tested
- [ ] Responsive tested at 375px / 768px / 1024px / 1440px
- [ ] Numeric values use `tabular-nums` font variant
- [ ] Action card types use correct status colors (see table above)
