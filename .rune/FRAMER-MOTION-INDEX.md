# Framer-Motion File Index
**Generated:** 2026-03-31  
**Total Files:** 29  
**Package Version:** ^12.38.0  

Quick reference for all framer-motion usage in CarabinerOS frontend.

---

## COMPONENTS (12 files)

### Core UI Components
| File | Line | Imports | Purpose |
|------|------|---------|---------|
| `src/components/notification-panel.tsx` | 3 | `AnimatePresence, motion` | Card list animations, enter/exit |
| `src/components/action-card.tsx` | 3 | `motion` | Collapsed card slide animations |
| `src/components/action-card-expanded.tsx` | 4 | `motion` | Expanded card view transitions |
| `src/components/app-sidebar.tsx` | 6 | `motion, AnimatePresence` | Sidebar menu transitions |
| `src/components/top-bar.tsx` | 4 | `motion` | Header animations |
| `src/components/module-chat.tsx` | 4 | `motion, AnimatePresence` | Mini-chat message animations |

### Chat & Messaging
| File | Line | Imports | Purpose |
|------|------|---------|---------|
| `src/components/chat-composer.tsx` | 4 | `motion, AnimatePresence` | Composer input animations |
| `src/components/message-list.tsx` | 4 | `motion, AnimatePresence` | Message appear/disappear |
| `src/components/thoughts-stream.tsx` | 4 | `motion, AnimatePresence` | A0 thinking bubble animations |

### Specialized Components
| File | Line | Imports | Purpose |
|------|------|---------|---------|
| `src/components/expo-ticket.tsx` | 3 | `motion, AnimatePresence` | Expo notification cards |
| `src/components/solitaire-cards.tsx` | 4 | `motion, AnimatePresence, type Variants` | Complex staggered card animations |
| `src/components/home-view.tsx` | 4 | `motion, AnimatePresence` | Home screen animations |

### Submodules
| File | Line | Imports | Purpose |
|------|------|---------|---------|
| `src/components/reporting/revenue-charts.tsx` | 4 | `motion, AnimatePresence` | Chart transition animations |

---

## APP PAGES (17 files)

### Core Routes
| File | Line | Imports | Purpose |
|------|------|---------|---------|
| `src/app/orders/page.tsx` | 19 | `motion, AnimatePresence` | Order table row animations |
| `src/app/inventory/page.tsx` | 6 | `motion` | Inventory grid animations |
| `src/app/inventory/components/waste-log-table.tsx` | 7 | `motion` | Waste log row transitions |
| `src/app/menu/page.tsx` | 4 | `motion, AnimatePresence` | Menu item card animations |
| `src/app/recipes/page.tsx` | 7 | `motion` | Recipe list animations |
| `src/app/recipes/[id]/page.tsx` | 5 | `motion` | Recipe detail view animations |
| `src/app/prep/page.tsx` | 31 | `motion, AnimatePresence, type Variants` | Complex prep task animations |
| `src/app/reporting/page.tsx` | 4 | `motion, AnimatePresence` | Dashboard chart animations |

### Food Cost Module
| File | Line | Imports | Purpose |
|------|------|---------|---------|
| `src/app/food-cost/_components/budget-card.tsx` | 3 | `motion` | Budget card hover effects |
| `src/app/food-cost/_components/kpi-strip.tsx` | 3 | `motion` | KPI metric animations |
| `src/app/food-cost/_components/pressure-table.tsx` | 4 | `motion, AnimatePresence` | Pressure table row animations |

### Invoices Module
| File | Line | Imports | Purpose |
|------|------|---------|---------|
| `src/app/invoices/page.tsx` | 19 | `motion, AnimatePresence` | Invoice list animations |
| `src/app/invoices/components/invoice-detail-panel.tsx` | 4 | `motion, AnimatePresence` | Invoice detail slide-in |

### Marketing Module
| File | Line | Imports | Purpose |
|------|------|---------|---------|
| `src/app/marketing/page.tsx` | 17, 18 | `motion, AnimatePresence, type Variants` | Campaign animations + complex sequences |
| `src/app/marketing/components/campaign-detail-panel.tsx` | 4 | `motion, AnimatePresence` | Campaign detail animations |
| `src/app/marketing/components/content-calendar.tsx` | 4 | `motion` | Calendar grid animations |

---

## ANIMATION PATTERNS

### Common Uses

#### `motion` — Basic animations
- Spring animations (default config)
- Slide, fade, scale transitions
- Hover effects on cards

#### `AnimatePresence` — Entry/exit orchestration
- List item enter/exit animations
- Modal appear/disappear
- Conditional rendering with animation

#### `type Variants` — Complex sequences
Used in:
- `src/components/solitaire-cards.tsx` (staggered card reveal)
- `src/app/prep/page.tsx` (multi-stage task animations)
- `src/app/marketing/page.tsx` (campaign flow)

---

## UPGRADE NOTES

### Current Status
- ✓ Pinned to `^12.38.0` in `frontend/package.json`
- ✓ All imports are standard framer-motion exports
- ✓ No custom animation libraries or polyfills

### Migration Considerations
- No breaking changes expected in v12.x minor versions
- Watch for v13+ (not yet available, no known breaking changes)
- All component patterns align with framer-motion 12+ conventions

### Performance Notes
- `AnimatePresence` used 13 times — may trigger unmount/remount
- `motion` components in lists (orders, inventory) — consider `layoutId` for explicit layout animations
- `type Variants` only in 3 complex components — safe for now

---

## GREP COMMAND

To find all framer-motion usage:
```bash
grep -r "from.*framer-motion\|import.*framer-motion" frontend/src --include="*.ts*"
```

To see usage context:
```bash
grep -r "motion\|AnimatePresence" frontend/src --include="*.ts*" -A 2 -B 2
```

---

**Maintained by:** Scout skill  
**Last Updated:** 2026-03-31
