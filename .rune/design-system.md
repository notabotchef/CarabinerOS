# Design System: CarabinerOS — Reporting Charts
Last Updated: 2026-03-24
Platform: web (Next.js 16, React 19, Tailwind CSS 4, Recharts)
Domain: Restaurant Operations Dashboard
Style: Midnight Kitchen — KDS meets luxury dark dashboard

## Domain Classification

**Restaurant Ops / Data-Dense Dark** — not SaaS, not fintech. The user is a head chef glancing at a screen during a 300-cover Saturday service. Every design choice must pass the "3-second scan" test: can the chef read the story without leaning in?

## Color Tokens — Charts Only

All colors expressed as hex for Recharts SVG (oklch doesn't work in SVG attributes).

### Chart Palette (Dark Mode)
```
Chart background:     transparent (inherits card bg oklch(0.20 0.025 250) ≈ #1a2030)
Grid:                 rgba(255,255,255,0.04)   — barely visible, just enough to guide the eye
Axis text:            rgba(255,255,255,0.30)   — whisper-quiet, never competes with data
Axis line:            none                      — remove all axis lines, ticks enough

Revenue fill:         #34d399 → transparent     — emerald-400, TWO-stop gradient (top 25% opacity → 0%)
Revenue stroke:       #34d399                   — 2px, no glow
COGS area:            #f59e0b at 8% opacity     — amber ghost under revenue to show the spread

Food cost line:       #f59e0b                   — amber-500, 2.5px stroke
Food cost dot:        conditional:
                        in-range (28-32%):  #34d399 (emerald)
                        above 32%:          #ef4444 (red-500)
                        below 28%:          #3b82f6 (blue-500, rare but possible)
Target zone:          #34d399 at 5% opacity     — barely-there green band, NOT a heavy box

Bar fill:             #34d399                   — single color, NO per-bar opacity games
Bar hover:            #5eead4                   — teal-300, subtle brighten on hover only
Bar radius:           [6, 6, 0, 0]              — generous top rounding
Bar gap:              35% category gap           — breathing room, not packed

Budget line:          rgba(255,255,255,0.15)    — white at 15%, dashed 6 4, NOT teal
Tooltip bg:           #141b27                   — darker than card, not lighter
Tooltip border:       rgba(255,255,255,0.06)
Tooltip shadow:       0 8px 32px rgba(0,0,0,0.5) — substantial shadow, feels like it floats
```

### What Was Wrong Before
- `TEAL = "#3dd68c"` — wrong green, too neon/saturated. Use `#34d399` (Tailwind emerald-400)
- Grid at 5% with dashed lines — looks like graph paper. Use 4% solid, horizontal only
- Axis text at 35% — too bright, competes with data. Drop to 30%
- Budget line in teal — confused with revenue. Use neutral white at 15%
- Bar chart with opacity scaling per bar — gimmicky, makes weak days harder to read
- Tooltips with 8px border-radius — too rounded for the card aesthetic. Use 10px with a real shadow
- Chart height 220px — too short. Use 260px minimum for readability
- `type="monotone"` curve — too wavy for financial data. Use `type="natural"` for area, `type="linear"` for food cost (precision matters)

## Typography — Charts

| Element | Font | Weight | Size | Color |
|---------|------|--------|------|-------|
| Axis labels | Geist Mono | 400 | 10px | rgba(255,255,255,0.30) |
| Tooltip title (date) | Geist Mono | 500 | 10px | rgba(255,255,255,0.45) |
| Tooltip values | Geist Mono | 600 | 12px | rgba(255,255,255,0.90) |
| Tooltip labels | Geist Sans | 400 | 10px | rgba(255,255,255,0.50) |
| Chart card title | Geist Sans | 600 | 13px | foreground at 85% |
| Chart card subtitle | Geist Mono | 400 | 10px | muted-foreground at 45% |
| Reference line label | Geist Mono | 500 | 9px | respective color at 50% |
| KPI inline sparkline | — | — | — | same color as KPI accent |

## Chart Layout

### DO NOT show all 3 charts at once in a row
A chef doesn't need 3 charts simultaneously. Use a **single hero chart** with **tab switcher**.

```
┌─────────────────────────────────────────────────┐
│  [Revenue ▾]  [Food Cost %]  [By Day]           │  ← pill tabs, left-aligned
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │                                             │ │
│  │         HERO CHART (280px tall)             │ │
│  │         Full width, single focus            │ │
│  │                                             │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Revenue: $146K  │  Avg: $4.7K/day  │  Peak: Sat │  ← contextual summary bar
└─────────────────────────────────────────────────┘
```

**Why:** One large chart is dramatically more readable than three small ones. The tab interface lets the chef focus on what matters right now. The summary bar gives the "3-second scan" answer without reading the chart at all.

### Chart Card Container
- Border: `border-border/40` (lighter than normal cards — charts need breathing room)
- Background: transparent (let page bg show through, avoids double-card nesting)
- Padding: `px-0 pt-5 pb-4` (chart bleeds to card edges horizontally for max data space)
- Tab pills: inside the card header, small rounded pills with `bg-secondary/60` inactive, `bg-primary/15 text-primary` active
- Summary bar: bottom border-t, 3-col grid with monospace values, muted labels

### Revenue Chart (Area) — "Service Pace"
- `type="natural"` for smooth but not wavy curves
- Gradient: emerald-400 from 25% opacity at top → 0% at baseline
- Stroke: emerald-400, 2px, NO animation on stroke (distracting)
- Active dot: 5px radius, white ring (2px), emerald fill
- Budget reference line: white at 15% opacity, dashed `6 4`, label "Target" at right in white/30%
- Y-axis: `$0k` `$3k` `$6k` `$9k` — whole numbers only, no decimals
- X-axis: show every 3rd date label to avoid crowding → `interval={2}`

### Food Cost % Chart (Line) — "The Number"
- `type="linear"` — this is a precision metric, no smoothing
- Target zone: emerald at 5% opacity between 28% and 32%
- Reference lines at 28% and 32%: emerald dashed, 1px, very subtle
- Line: amber-500, 2.5px stroke
- Dots: 4px, colored by threshold (emerald in-range, red above, blue below)
- Active dot: 6px with white 2px ring
- Y-axis: domain [24, 38] fixed — gives context even when data is tight
- Label "Target 28-32%" at top-right of zone, emerald at 40%

### Revenue by Day (Bar) — "The Week"
- Vertical bars, generous 35% gap
- ALL bars same color (emerald-400) at same opacity — no intensity scaling
- Hover: bar brightens to teal-300, cursor shows revenue
- Rounded top: [6, 6, 0, 0]
- X-axis: Mon Tue Wed Thu Fri Sat Sun
- Y-axis: `$0k` format
- NO grid lines for this chart — the bars ARE the visual

## Tooltip Design — "Kitchen Ticket"

The tooltip should feel like a small paper kitchen ticket, not a default browser tooltip.

```
┌──────────────────────────┐
│  MAR 15                  │  ← date in mono, muted
│                          │
│  Revenue    $6,240       │  ← label (sans) + value (mono bold)
│  COGS       $1,890       │
│  Net Profit $2,180       │
│                          │
│  ■ 30.3% food cost       │  ← small colored dot + inline stat
└──────────────────────────┘
```

- Background: `#141b27` (darker than card)
- Border: `1px solid rgba(255,255,255,0.06)`
- Shadow: `0 8px 32px rgba(0,0,0,0.5)` — float off the surface
- Border-radius: `10px`
- Padding: `12px 16px`
- Max width: `200px`
- Custom tooltip component (NOT Recharts default `contentStyle`)
- Labels left-aligned, values right-aligned, tabular nums
- Date formatted as `MAR 15` (short month + day), not `03-15`

## Summary Bar (below chart)

Three key stats in a horizontal strip:
```
Total: $146,200  │  Avg/Day: $4,716  │  Peak: Saturday $9,234
```
- Font: Geist Mono 500, 12px
- Labels: muted-foreground at 40%, uppercase, 10px
- Values: foreground at 85%, tabular-nums
- Separator: `border-l border-border/30`
- Different stats per chart tab:
  - Revenue: Total, Avg/Day, Peak Day
  - Food Cost: Avg %, Best Day, Worst Day
  - By Day: Busiest, Slowest, Weekend vs Weekday

## Animations

- Chart mount: `opacity 0→1` over 400ms with `ease-out`. NO y-translation (charts shouldn't slide).
- Tab switch: chart cross-fades with 150ms duration (AnimatePresence mode="wait")
- Bar hover: 150ms fill transition (CSS, not JS)
- Active dot: appears instantly (no animation — precision tool)
- NO: line drawing animations, count-up animations, bouncing dots

## Anti-Patterns (MUST NOT)

- ❌ Three small charts side by side — unreadable at a glance, feels like a dashboard template
- ❌ Per-bar opacity scaling — makes low days harder to read, which is backwards (you want to see weak days clearly)
- ❌ Neon green (`#3dd68c`) — too saturated for data viz. Use Tailwind emerald-400 (`#34d399`)
- ❌ Budget line in brand color — confused with data. Use neutral white at low opacity
- ❌ `type="monotone"` for financial data — implies false smoothness between data points
- ❌ Dashed grid lines — graph paper aesthetic, not premium. Use solid at 4%
- ❌ Default Recharts tooltip styling via `contentStyle` — always use a custom `content` component
- ❌ Chart height under 240px — data becomes unreadable
- ❌ Axis labels on every data point — visual noise. Use intervals
- ❌ Animation on data change — financial data should update instantly, not animate
- ❌ Light text on dark bg below 3:1 contrast for any data-carrying element

## UX Writing — Charts

| Context | Copy |
|---------|------|
| Empty state | "No data for this period" (not "No data available") |
| Loading | Skeleton pulse matching chart dimensions, no text |
| Error | "Couldn't load financial data. Check your connection." |
| Tab labels | "Revenue" / "Food Cost %" / "By Day" (short, no articles) |
| Summary label | "TOTAL" "AVG/DAY" "PEAK" — uppercase mono, terse |
| Tooltip date | "MAR 15" format (not ISO, not long-form) |

## Pre-Delivery Checklist

- [ ] Single hero chart with tab switcher, NOT 3 side-by-side
- [ ] Custom tooltip component, NOT Recharts default contentStyle
- [ ] Emerald-400 (#34d399) for revenue, NOT neon green
- [ ] Budget line in white/15%, NOT brand color
- [ ] Chart height >= 260px
- [ ] Summary bar with contextual stats per tab
- [ ] Food cost dots colored by threshold
- [ ] Y-axis with clean $Xk formatting
- [ ] X-axis with interval to prevent label crowding
- [ ] `type="natural"` for area, `type="linear"` for food cost line
- [ ] Tooltip shadow and dark bg (darker than card)
- [ ] No per-bar opacity gimmicks
- [ ] Animations: fade only, no slides or draws
- [ ] Tab switch: AnimatePresence cross-fade
- [ ] All monospace numbers use Geist Mono
- [ ] Responsive: charts fill container width at all breakpoints
