# Phase 1: Framer Motion → Motion Migration

## Goal
Replace the legacy `framer-motion` package with `motion` and update all 29 import statements from `"framer-motion"` to `"motion/react"`. Zero behavior change — pure rename.

## Data Flow
```
package.json: framer-motion → motion
       ↓
29 component files: import { motion, AnimatePresence } from "framer-motion"
       ↓                          becomes
29 component files: import { motion, AnimatePresence } from "motion/react"
       ↓
pnpm build → verify no errors
```

## Code Contracts
```typescript
// BEFORE (every affected file)
import { motion } from "framer-motion";
import { motion, AnimatePresence } from "framer-motion";
import { motion, AnimatePresence, type Variants } from "framer-motion";

// AFTER (exact same exports, new path)
import { motion } from "motion/react";
import { motion, AnimatePresence } from "motion/react";
import { motion, AnimatePresence, type Variants } from "motion/react";
```

No API changes. `motion/react` re-exports all the same symbols.

## Tasks

### Wave 1 (parallel — no dependencies)
- [ ] Task 1a — Swap npm package
  - File: `frontend/package.json` (modify line 16)
  - touches: [frontend/package.json, frontend/pnpm-lock.yaml]
  - provides: [motion package available]
  - Test: N/A
  - Verify: `cd frontend && pnpm remove framer-motion && pnpm add motion && pnpm ls motion`
  - Commit: `chore(deps): replace framer-motion with motion`
  - Logic: Remove `framer-motion`, add `motion`. The `motion` package exports everything from `motion/react`.

### Wave 2 (depends on Wave 1)
- [ ] Task 2a — Update component imports (12 files)
  - depends_on: [Task 1a]
  - touches: [action-card.tsx, action-card-expanded.tsx, app-sidebar.tsx, chat-composer.tsx, expo-ticket.tsx, home-view.tsx, message-list.tsx, module-chat.tsx, notification-panel.tsx, solitaire-cards.tsx, thoughts-stream.tsx, top-bar.tsx]
  - provides: [updated component imports]
  - Files (all in `frontend/src/components/`):
    - `action-card.tsx:4`
    - `action-card-expanded.tsx` (find framer-motion import)
    - `app-sidebar.tsx` (find framer-motion import)
    - `chat-composer.tsx` (find framer-motion import)
    - `expo-ticket.tsx` (find framer-motion import)
    - `home-view.tsx` (find framer-motion import)
    - `message-list.tsx` (find framer-motion import)
    - `module-chat.tsx` (find framer-motion import)
    - `notification-panel.tsx` (find framer-motion import)
    - `solitaire-cards.tsx` (find framer-motion import)
    - `thoughts-stream.tsx` (find framer-motion import)
    - `top-bar.tsx` (find framer-motion import)
  - Test: N/A (build verification in Wave 3)
  - Verify: `grep -r "framer-motion" frontend/src/components/ | wc -l` → 0
  - Commit: `refactor(ui): migrate component imports from framer-motion to motion/react`
  - Logic: Find-replace `from "framer-motion"` → `from "motion/react"` in each file. Keep all named imports exactly as-is.

- [ ] Task 2b — Update page imports (17 files)
  - depends_on: [Task 1a]
  - touches: [reporting/page.tsx, prep/page.tsx, orders/page.tsx, inventory/page.tsx, recipes/page.tsx, recipes/[id]/page.tsx, menu/page.tsx, marketing/page.tsx, invoices/page.tsx, and subcomponents]
  - provides: [updated page imports]
  - Files (all in `frontend/src/app/`):
    - `reporting/page.tsx:5`
    - `prep/page.tsx:6`
    - `orders/page.tsx` (find framer-motion import)
    - `inventory/page.tsx` (find framer-motion import)
    - `inventory/components/waste-log-table.tsx` (find framer-motion import)
    - `recipes/page.tsx` (find framer-motion import)
    - `recipes/[id]/page.tsx:5`
    - `menu/page.tsx` (find framer-motion import)
    - `marketing/page.tsx` (find framer-motion import)
    - `marketing/components/content-calendar.tsx` (find framer-motion import)
    - `marketing/components/campaign-detail-panel.tsx` (find framer-motion import)
    - `invoices/page.tsx` (find framer-motion import)
    - `invoices/components/invoice-detail-panel.tsx` (find framer-motion import)
    - `food-cost/_components/kpi-strip.tsx` (find framer-motion import)
    - `food-cost/_components/pressure-table.tsx` (find framer-motion import)
    - `food-cost/_components/budget-card.tsx` (find framer-motion import)
    - `reporting/revenue-charts.tsx` (in components/reporting/)
  - Test: N/A (build verification in Wave 3)
  - Verify: `grep -r "framer-motion" frontend/src/app/ | wc -l` → 0
  - Commit: `refactor(ui): migrate page imports from framer-motion to motion/react`
  - Logic: Same find-replace. Keep all named imports exactly as-is.

### Wave 3 (depends on Wave 2)
- [ ] Task 3a — Full build verification
  - depends_on: [Task 2a, Task 2b]
  - File: N/A (verification only)
  - Test: `cd frontend && pnpm build`
  - Verify: `cd frontend && pnpm build 2>&1 | tail -5` → "✓ Compiled successfully"
  - Commit: N/A (no code change)
  - Logic: Build catches any missed imports, type errors, or API changes between packages.

- [ ] Task 3b — Zero remaining references check
  - depends_on: [Task 2a, Task 2b]
  - File: N/A (verification only)
  - Verify: `grep -r "framer-motion" frontend/ --include="*.ts" --include="*.tsx" | wc -l` → 0
  - Commit: N/A

## Failure Scenarios
| When | Then | Error Type |
|------|------|-----------|
| `motion` package missing an export that `framer-motion` had | Build error on import — check motion docs for renamed export | Build error |
| `type Variants` not in `motion/react` | Import from `motion` instead of `motion/react` | TypeScript error |
| `pnpm build` fails on unrelated issue | Isolate — check if error exists before this phase | Pre-existing |

## Rejection Criteria (DO NOT)
- ❌ DO NOT change any animation logic, variants, or component behavior
- ❌ DO NOT add new imports or remove existing ones — pure path rename only
- ❌ DO NOT update any other dependencies in this phase
- ❌ DO NOT touch backend files
- ❌ DO NOT use `from "motion"` — must be `from "motion/react"` for React components

## Cross-Phase Context
- **Assumes**: Nothing — this phase is fully independent
- **Exports for Phase 5**: Frontend builds cleanly with modern motion package

## Acceptance Criteria
- [ ] `framer-motion` removed from package.json
- [ ] `motion` added to package.json
- [ ] Zero grep hits for `"framer-motion"` in frontend/src/
- [ ] `pnpm build` succeeds with no errors
- [ ] All animations render identically (visual spot-check)

## Files Touched
- `frontend/package.json` — modify (swap dependency)
- `frontend/pnpm-lock.yaml` — auto-generated
- 29 `.tsx` files — modify (import path only)
