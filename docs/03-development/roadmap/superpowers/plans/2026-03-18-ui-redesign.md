# CarabinerOS UI Redesign — 5-Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform CarabinerOS from default shadcn template to a premium, hospitality-native, AI-forward operations platform — "Linear for restaurants."

**Architecture:** 5 independent phases, each in its own git branch, designed to minimize file conflicts. Each phase touches different files. Phases merge into main one-by-one in order. The app uses Next.js 15 + React 19 + shadcn/ui (base-nova style) + Tailwind 4 + Zustand + Socket.IO.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4, shadcn/ui (base-nova), Lucide icons, Framer Motion (new), cmdk (new), Sonner (new), Zustand, Recharts

**Verification:** No test framework exists yet. Each phase verifies via `cd apps/web && npx next build` (type-check + build). Phases that add new packages must run `pnpm install` first.

---

## Phase 1: Brand Identity + Sidebar Icons

**Branch:** `ui/phase1-brand-identity`
**Scope:** New color system (warm zinc + orange accent), real Lucide icons in sidebar, typography fixes. Chat accent color changes are handled by Phase 4.
**Files touched:** `globals.css`, `app-sidebar.tsx`

### Task 1.1: Warm Dark Mode Color System

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Replace the dark mode CSS variables with warm zinc + orange palette**

Replace the `.dark { ... }` block in `globals.css` with:

```css
.dark {
  --background: oklch(0.145 0.005 60);
  --foreground: oklch(0.96 0 0);
  --card: oklch(0.19 0.005 60);
  --card-foreground: oklch(0.96 0 0);
  --popover: oklch(0.19 0.005 60);
  --popover-foreground: oklch(0.96 0 0);
  --primary: oklch(0.65 0.17 45);
  --primary-foreground: oklch(0.16 0 0);
  --secondary: oklch(0.24 0.005 60);
  --secondary-foreground: oklch(0.96 0 0);
  --muted: oklch(0.24 0.005 60);
  --muted-foreground: oklch(0.65 0 0);
  --accent: oklch(0.24 0.005 60);
  --accent-foreground: oklch(0.96 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 8%);
  --input: oklch(1 0 0 / 12%);
  --ring: oklch(0.65 0.17 45);
  --chart-1: oklch(0.65 0.17 45);
  --chart-2: oklch(0.7 0.15 145);
  --chart-3: oklch(0.6 0.12 250);
  --chart-4: oklch(0.75 0.1 60);
  --chart-5: oklch(0.55 0.15 310);
  --radius: 0.625rem;
  --sidebar: oklch(0.16 0.005 60);
  --sidebar-foreground: oklch(0.96 0 0);
  --sidebar-primary: oklch(0.65 0.17 45);
  --sidebar-primary-foreground: oklch(0.96 0 0);
  --sidebar-accent: oklch(0.22 0.005 60);
  --sidebar-accent-foreground: oklch(0.96 0 0);
  --sidebar-border: oklch(1 0 0 / 8%);
  --sidebar-ring: oklch(0.65 0.17 45);
}
```

Key changes: backgrounds have subtle warm hue (hue 60), primary is now warm orange `oklch(0.65 0.17 45)`, ring matches primary, chart colors are diverse and warm-friendly.

- [ ] **Step 2: Update light mode `:root` to match warm palette**

Replace the `:root { ... }` block with:

```css
:root {
  --background: oklch(0.985 0.002 60);
  --foreground: oklch(0.145 0.005 60);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0.005 60);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0.005 60);
  --primary: oklch(0.55 0.2 40);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.96 0.002 60);
  --secondary-foreground: oklch(0.205 0.005 60);
  --muted: oklch(0.96 0.002 60);
  --muted-foreground: oklch(0.5 0 0);
  --accent: oklch(0.96 0.002 60);
  --accent-foreground: oklch(0.205 0.005 60);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.9 0.002 60);
  --input: oklch(0.9 0.002 60);
  --ring: oklch(0.55 0.2 40);
  --chart-1: oklch(0.55 0.2 40);
  --chart-2: oklch(0.6 0.18 145);
  --chart-3: oklch(0.5 0.15 250);
  --chart-4: oklch(0.65 0.12 60);
  --chart-5: oklch(0.45 0.15 310);
  --radius: 0.625rem;
  --sidebar: oklch(0.975 0.002 60);
  --sidebar-foreground: oklch(0.145 0.005 60);
  --sidebar-primary: oklch(0.55 0.2 40);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.96 0.002 60);
  --sidebar-accent-foreground: oklch(0.205 0.005 60);
  --sidebar-border: oklch(0.9 0.002 60);
  --sidebar-ring: oklch(0.55 0.2 40);
}
```

- [ ] **Step 3: Add tabular-nums utility to globals.css**

Add to the `@layer base` block:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  }
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
}
```

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(ui): warm hospitality color system — orange primary, warm zinc neutrals"
```

### Task 1.2: Real Lucide Icons in Sidebar

**Files:**
- Modify: `apps/web/src/components/app-sidebar.tsx`

- [ ] **Step 1: Add Lucide icon imports and replace text icons**

Replace the icon imports section and MODULES array. Add these imports at the top:

```tsx
import {
  Home,
  Inbox,
  ShoppingCart,
  Receipt,
  Warehouse,
  ChefHat,
  DollarSign,
  UtensilsCrossed,
  BarChart3,
  Megaphone,
  MapPin,
  Settings,
  type LucideIcon,
} from "lucide-react";
```

Replace the MODULES constant:

```tsx
const MODULES: readonly { id: string; label: string; href: string; icon: LucideIcon; badge?: number }[] = [
  { id: "home", label: "Home", href: "/", icon: Home },
  { id: "inbox", label: "Inbox", href: "/inbox", icon: Inbox, badge: 3 },
  { id: "orders", label: "Orders", href: "/orders", icon: ShoppingCart },
  { id: "invoices", label: "Invoices", href: "/invoices", icon: Receipt },
  { id: "inventory", label: "Inventory", href: "/inventory", icon: Warehouse },
  { id: "prep", label: "Prep", href: "/prep", icon: ChefHat },
  { id: "food-cost", label: "Food Cost", href: "/food-cost", icon: DollarSign },
  { id: "menu", label: "Menu", href: "/menu", icon: UtensilsCrossed },
  { id: "reporting", label: "Reporting", href: "/reporting", icon: BarChart3 },
  { id: "marketing", label: "Marketing", href: "/marketing", icon: Megaphone },
  { id: "locations", label: "Locations", href: "/locations", icon: MapPin },
  { id: "admin", label: "Admin", href: "/admin", icon: Settings },
];
```

- [ ] **Step 2: Update the sidebar render to use Lucide components**

In the `SidebarMenuButton` render, replace the text-icon span:

```tsx
{/* Old: */}
<span className="flex h-5 w-5 items-center justify-center rounded text-xs font-medium">
  {mod.icon}
</span>

{/* New: */}
<mod.icon className="size-4" />
```

- [ ] **Step 3: Update the header logo to use brand color**

Replace the header div:

```tsx
<div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
  C
</div>
```

This now uses the CSS variable `bg-primary` which is our new warm orange.

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app-sidebar.tsx
git commit -m "feat(ui): replace text icons with Lucide icons in sidebar"
```

---

## Phase 2: Motion + Premium Polish

**Branch:** `ui/phase2-motion-polish`
**Scope:** Add Framer Motion + Sonner dependencies, animated number tickers on KPI cards, layout animations on tables, layered shadows, staggered detail panel animations.
**Files touched:** `package.json` (add deps), new `components/ui/animated-number.tsx`, `workspace-kpi-cards.tsx`, `workspace-table.tsx`, `workspace-detail-panel.tsx`

### Task 2.1: Install Framer Motion + Sonner

**Files:**
- Modify: `apps/web/package.json` (via pnpm)

- [ ] **Step 1: Install dependencies**

```bash
cd apps/web && pnpm add framer-motion sonner
```

- [ ] **Step 2: Verify install**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml ../../pnpm-lock.yaml
git commit -m "chore: add framer-motion and sonner dependencies"
```

### Task 2.2: Animated Number Component

**Files:**
- Create: `apps/web/src/components/ui/animated-number.tsx`

- [ ] **Step 1: Create the animated number component**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useTransform, animate, motion } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  formatOptions?: Intl.NumberFormatOptions;
}

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  duration = 1,
  className,
  formatOptions,
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(0);
  const prevValue = useRef(0);

  const displayed = useTransform(motionValue, (v) => {
    const formatted = formatOptions
      ? v.toLocaleString("en-US", formatOptions)
      : Math.round(v).toLocaleString("en-US");
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: "easeOut",
    });
    prevValue.current = value;
    return controls.stop;
  }, [value, duration, motionValue]);

  return (
    <motion.span className={className}>
      {displayed}
    </motion.span>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/animated-number.tsx
git commit -m "feat(ui): add AnimatedNumber component with Framer Motion"
```

### Task 2.3: Premium KPI Cards with Animation

**Files:**
- Modify: `apps/web/src/components/workspace/workspace-kpi-cards.tsx`

- [ ] **Step 1: Add motion imports and upgrade the KPI card component**

Replace the entire file contents with:

```tsx
"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";

interface KPICard {
  label: string;
  value: string | number;
  delta?: string;
}

interface WorkspaceKPICardsProps {
  cards: KPICard[];
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, type: "spring", stiffness: 300, damping: 30 },
  }),
};

function parseNumericValue(val: string | number): { num: number; prefix: string; suffix: string } | null {
  if (typeof val === "number") return { num: val, prefix: "", suffix: "" };
  const match = String(val).match(/^([^0-9-]*)([0-9,.]+)(.*)$/);
  if (!match) return null;
  const num = parseFloat(match[2].replace(/,/g, ""));
  if (isNaN(num)) return null;
  return { num, prefix: match[1], suffix: match[3] };
}

export function WorkspaceKPICards({ cards }: WorkspaceKPICardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => {
        const parsed = parseNumericValue(card.value);
        return (
          <motion.div
            key={card.label}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
          >
            <Card className="shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.04),0_12px_24px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_6px_12px_rgba(0,0,0,0.06),0_16px_32px_rgba(0,0,0,0.08)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {parsed ? (
                    <AnimatedNumber
                      value={parsed.num}
                      prefix={parsed.prefix}
                      suffix={parsed.suffix}
                    />
                  ) : (
                    card.value
                  )}
                </div>
                {card.delta && (
                  <p className="text-xs text-muted-foreground tabular-nums">{card.delta}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/workspace/workspace-kpi-cards.tsx
git commit -m "feat(ui): animated KPI cards with number tickers and layered shadows"
```

### Task 2.4: Table Row Animations

**Files:**
- Modify: `apps/web/src/components/workspace/workspace-table.tsx`

- [ ] **Step 1: Add motion to table rows**

Add import at the top of workspace-table.tsx:

```tsx
import { motion, AnimatePresence } from "framer-motion";
```

Replace the `<TableBody>` section (the part that renders rows) with animated rows. Replace the `table.getRowModel().rows.map(...)` block with:

```tsx
<AnimatePresence mode="popLayout">
  {table.getRowModel().rows.map((row) => (
    <motion.tr
      key={row.id}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ type: "spring", stiffness: 400, damping: 35 }}
      className={`border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted ${onRowClick ? "cursor-pointer" : ""}`}
      onClick={() => onRowClick?.(row.original)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onRowClick) {
          e.preventDefault();
          onRowClick(row.original);
        }
      }}
      tabIndex={onRowClick ? 0 : undefined}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </motion.tr>
  ))}
</AnimatePresence>
```

Note: We're using `motion.tr` directly instead of wrapping `<TableRow>` to avoid nesting issues. The motion.tr gets the same classes as TableRow.

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/workspace/workspace-table.tsx
git commit -m "feat(ui): animated table rows with spring physics"
```

### Task 2.5: Premium Detail Panel

**Files:**
- Modify: `apps/web/src/components/workspace/workspace-detail-panel.tsx`

- [ ] **Step 1: Add motion to detail panel fields**

Add import at top:

```tsx
import { motion } from "framer-motion";
```

Wrap the fields grid with staggered animation. Replace:

```tsx
{fields.length > 0 && (
  <div className="grid grid-cols-2 gap-2">
    {fields.map((f) => (
```

With:

```tsx
{fields.length > 0 && (
  <div className="grid grid-cols-2 gap-2">
    {fields.map((f, i) => (
      <motion.div
        key={f.label}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 30 }}
      >
```

And close the motion.div after the existing field div. The field element becomes:

```tsx
<motion.div
  key={f.label}
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 30 }}
>
  <div className="rounded-md border bg-muted/50 px-3 py-2">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
      {f.label}
    </div>
    <div className="text-sm font-medium mt-0.5 tabular-nums">{f.value}</div>
  </div>
</motion.div>
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/workspace/workspace-detail-panel.tsx
git commit -m "feat(ui): staggered field animations in detail panel"
```

---

## Phase 3: Command Palette (Cmd+K)

**Branch:** `ui/phase3-command-palette`
**Scope:** Install cmdk, build a command palette with module navigation + entity search + AI routing.
**Files touched:** `package.json` (add cmdk), new `components/command-palette.tsx`, `app/layout.tsx` (add palette to root)

### Task 3.1: Install cmdk

**Files:**
- Modify: `apps/web/package.json` (via pnpm)

- [ ] **Step 1: Install cmdk**

```bash
cd apps/web && pnpm add cmdk@1
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml ../../pnpm-lock.yaml
git commit -m "chore: add cmdk dependency for command palette"
```

### Task 3.2: Build Command Palette Component

**Files:**
- Create: `apps/web/src/components/command-palette.tsx`

- [ ] **Step 1: Create the command palette**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  Home,
  Inbox,
  ShoppingCart,
  Receipt,
  Warehouse,
  ChefHat,
  DollarSign,
  UtensilsCrossed,
  BarChart3,
  Megaphone,
  MapPin,
  Settings,
  MessageSquare,
  Search,
  type LucideIcon,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  group: string;
  keywords?: string;
  action?: () => void;
}

const NAVIGATION_ITEMS: CommandItem[] = [
  { id: "home", label: "Home", href: "/", icon: Home, group: "Navigation" },
  { id: "inbox", label: "Inbox", href: "/inbox", icon: Inbox, group: "Navigation" },
  { id: "orders", label: "Orders", href: "/orders", icon: ShoppingCart, group: "Navigation", keywords: "purchase vendor" },
  { id: "invoices", label: "Invoices", href: "/invoices", icon: Receipt, group: "Navigation", keywords: "bills payments ap" },
  { id: "inventory", label: "Inventory", href: "/inventory", icon: Warehouse, group: "Navigation", keywords: "stock count" },
  { id: "prep", label: "Prep Lists", href: "/prep", icon: ChefHat, group: "Navigation", keywords: "kitchen preparation" },
  { id: "food-cost", label: "Food Cost", href: "/food-cost", icon: DollarSign, group: "Navigation", keywords: "cogs margin" },
  { id: "menu", label: "Menu", href: "/menu", icon: UtensilsCrossed, group: "Navigation", keywords: "dishes items" },
  { id: "reporting", label: "Reporting", href: "/reporting", icon: BarChart3, group: "Navigation", keywords: "analytics reports" },
  { id: "marketing", label: "Marketing", href: "/marketing", icon: Megaphone, group: "Navigation", keywords: "campaigns" },
  { id: "locations", label: "Locations", href: "/locations", icon: MapPin, group: "Navigation", keywords: "restaurants sites" },
  { id: "admin", label: "Admin", href: "/admin", icon: Settings, group: "Navigation", keywords: "settings config" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  // Cmd+K handler
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      setSearch("");
      if (item.action) {
        item.action();
      } else if (item.href) {
        router.push(item.href);
      }
    },
    [router],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative mx-auto mt-[20vh] max-w-lg px-4">
        <Command
          className="rounded-xl border bg-popover shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_16px_rgba(0,0,0,0.1),0_24px_48px_rgba(0,0,0,0.12)] overflow-hidden"
          shouldFilter={true}
        >
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search modules, actions, or ask a question..."
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No results found. Try asking CarabinerOS...
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-xs text-muted-foreground px-2 py-1.5">
              {NAVIGATION_ITEMS.map((item) => (
                <Command.Item
                  key={item.id}
                  value={`${item.label} ${item.keywords ?? ""}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground transition-colors"
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {search.length > 2 && (
              <Command.Group heading="Ask CarabinerOS" className="text-xs text-muted-foreground px-2 py-1.5">
                <Command.Item
                  value={`ask agent ${search}`}
                  onSelect={() => {
                    setOpen(false);
                    setSearch("");
                    router.push("/");
                    // Route to chat — the workspace store will pick up the prompt
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground transition-colors"
                >
                  <MessageSquare className="size-4 text-primary" />
                  <span>
                    Ask: <span className="text-muted-foreground">&ldquo;{search}&rdquo;</span>
                  </span>
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>

          <div className="border-t px-4 py-2 text-[10px] text-muted-foreground flex gap-3">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> select</span>
            <span><kbd className="font-mono">esc</kbd> close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/command-palette.tsx
git commit -m "feat(ui): command palette component with Cmd+K, navigation, and AI routing"
```

### Task 3.3: Wire Command Palette into Root Layout

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Import and add CommandPalette to the layout**

Add import at the top of layout.tsx:

```tsx
import { CommandPalette } from "@/components/command-palette";
```

Add `<CommandPalette />` inside the `<SidebarProvider>` wrapper, after `<AppSidebar>` and before the main content div:

```tsx
<SidebarProvider defaultOpen={false}>
  <AppSidebar locations={locations} orgName={orgName} />
  <CommandPalette />
  <div className="flex flex-1 flex-col overflow-hidden h-dvh">{children}</div>
</SidebarProvider>
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat(ui): wire Cmd+K command palette into root layout"
```

---

## Phase 4: Chat UX Evolution

**Branch:** `ui/phase4-chat-evolution`
**Scope:** Evolve chat from basic bubbles to a multi-mode command center panel. Better agent status, structured responses, GM personality.
**Files touched:** `chat-dock.tsx`, `chat-view.tsx`, `chat-message.tsx`, `chat-composer.tsx`, `chat-status-pill.tsx`

### Task 4.1: Redesigned Chat Status Pill

**Files:**
- Modify: `apps/web/src/components/chat/chat-status-pill.tsx`

- [ ] **Step 1: Read current file to understand structure**

Read: `apps/web/src/components/chat/chat-status-pill.tsx`

- [ ] **Step 2: Rewrite with premium styling and role display**

Replace entire file with:

```tsx
"use client";

import type { StatusPayload } from "@/lib/chat-helpers";

interface ChatStatusPillProps {
  status: StatusPayload | null;
}

export function ChatStatusPill({ status }: ChatStatusPillProps) {
  if (!status) return null;

  const stateStyles = {
    thinking: "border-primary/20 bg-primary/5 text-primary",
    waiting: "border-border bg-muted text-muted-foreground",
    error: "border-destructive/20 bg-destructive/5 text-destructive",
  };

  return (
    <div className="flex justify-start">
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${stateStyles[status.state]}`}
      >
        {status.state === "thinking" && (
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-40" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
        )}
        {status.state === "error" && (
          <span className="size-2 rounded-full bg-destructive" />
        )}
        <span className="font-medium">{status.role}</span>
        <span className="text-muted-foreground">{status.text}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/chat/chat-status-pill.tsx
git commit -m "feat(ui): redesigned chat status pill with pulsing indicator and role display"
```

### Task 4.2: Premium Chat Messages

**Files:**
- Modify: `apps/web/src/components/chat/chat-message.tsx`

- [ ] **Step 1: Upgrade chat message styling**

Replace entire file with:

```tsx
"use client";

import Markdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessageBubble({ role, content, isStreaming }: ChatMessageProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end animate-in slide-in-from-bottom-2 fade-in duration-200">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 bg-primary text-primary-foreground">
          <p className="text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border bg-card px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">
            C
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            CarabinerOS
          </span>
        </div>
        <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_ul]:my-1 [&_li]:my-0 [&_p]:my-1 [&_strong]:text-foreground [&_code]:text-primary [&_code]:bg-primary/10 [&_code]:px-1 [&_code]:rounded">
          <Markdown>{content}</Markdown>
        </div>
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 animate-blink rounded-sm" />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/chat/chat-message.tsx
git commit -m "feat(ui): premium chat messages with brand avatar and improved styling"
```

### Task 4.3: Upgraded Chat Composer

**Files:**
- Modify: `apps/web/src/components/chat/chat-composer.tsx`

- [ ] **Step 1: Improve composer styling**

In chat-composer.tsx, update the outer wrapper div to have a subtle border glow on focus-within:

Replace:
```tsx
<div className="relative flex items-center gap-2 rounded-2xl border bg-card p-2">
```

With:
```tsx
<div className="relative flex items-center gap-2 rounded-2xl border bg-card p-2 transition-shadow focus-within:shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_0_12px_hsl(var(--primary)/0.1)]">
```

Update the send button to use CSS classes instead of inline style. Replace the entire send button element:

```tsx
<button
  type="button"
  onClick={handleSend}
  disabled={disabled}
  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:opacity-90 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 self-center"
  aria-label="Send message"
>
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
</button>
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/chat/chat-composer.tsx
git commit -m "feat(ui): enhanced chat composer with focus glow and animated send button"
```

### Task 4.4: Multi-Mode Chat Dock

**Files:**
- Modify: `apps/web/src/components/workspace/chat-dock.tsx`

- [ ] **Step 1: Upgrade chat dock with mode tabs**

Replace entire file:

```tsx
"use client";

import { useState } from "react";
import { X, MessageSquare, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ChatView } from "@/components/chat/chat-view";

type DockMode = "chat" | "activity";

export function ChatDock() {
  const { isChatOpen, setChatOpen, setChatPrompt } = useWorkspaceStore();
  const [mode, setMode] = useState<DockMode>("chat");

  if (!isChatOpen) return null;

  return (
    <div className="w-[400px] shrink-0 border-l flex flex-col bg-background">
      {/* Header with mode tabs */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode("chat")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              mode === "chat"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="size-3.5" />
            Chat
          </button>
          <button
            onClick={() => setMode("activity")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              mode === "activity"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="size-3.5" />
            Activity
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => {
            setChatOpen(false);
            setChatPrompt(null);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === "chat" && <ChatView compact />}
        {mode === "activity" && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Activity className="size-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Activity Feed</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Agent actions and system events will appear here as you interact with CarabinerOS.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/workspace/chat-dock.tsx
git commit -m "feat(ui): multi-mode chat dock with Chat and Activity tabs"
```

---

## Phase 5: Dashboard Bento Grid + Home Redesign

**Branch:** `ui/phase5-bento-dashboard`
**Scope:** Replace flat card grid on home with asymmetric bento layout, AI morning briefing card, hero metrics.
**Files touched:** new `components/dashboard/bento-grid.tsx`, new `components/dashboard/ai-briefing-card.tsx`, `dashboard/metric-cards.tsx`, `hooks/use-api.ts` (add useMetrics), `app/page.tsx` (home page only — not the chat-view which Phase 4 owns)

### Task 5.1: Bento Grid Container

**Files:**
- Create: `apps/web/src/components/dashboard/bento-grid.tsx`

- [ ] **Step 1: Create the bento grid layout component**

```tsx
import { type ReactNode } from "react";

interface BentoItemProps {
  children: ReactNode;
  className?: string;
  span?: "1x1" | "2x1" | "1x2" | "2x2";
}

const spanClasses = {
  "1x1": "",
  "2x1": "sm:col-span-2",
  "1x2": "sm:row-span-2",
  "2x2": "sm:col-span-2 sm:row-span-2",
};

export function BentoItem({ children, className = "", span = "1x1" }: BentoItemProps) {
  return (
    <div className={`${spanClasses[span]} ${className}`}>
      {children}
    </div>
  );
}

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export function BentoGrid({ children, className = "" }: BentoGridProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/bento-grid.tsx
git commit -m "feat(ui): bento grid layout component with span variants"
```

### Task 5.2: AI Morning Briefing Card

**Files:**
- Create: `apps/web/src/components/dashboard/ai-briefing-card.tsx`

- [ ] **Step 1: Create the AI briefing card**

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { X, Sparkles } from "lucide-react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTimeContext(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Here's what needs your attention before service.";
  if (hour < 16) return "Lunch service update — here's what's happening.";
  if (hour < 21) return "Dinner prep is underway. Key items to watch.";
  return "Wrapping up the day. Quick summary.";
}

interface AIBriefingCardProps {
  locationName?: string;
  insights?: string[];
}

const FALLBACK_INSIGHTS = [
  "Produce delivery from Coastal confirmed for 2 PM — 3 items on backorder.",
  "Food cost trending at 31.2% this week, down from 33.8% last week.",
  "Friday reservations at 92% capacity — consider adding a prep cook.",
];

export function AIBriefingCard({ locationName, insights }: AIBriefingCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const items = insights ?? FALLBACK_INSIGHTS;

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        aria-label="Dismiss briefing"
      >
        <X className="size-3.5" />
      </button>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {getGreeting()}{locationName ? `, ${locationName}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">{getTimeContext()}</p>
          </div>
        </div>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/40" />
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/ai-briefing-card.tsx
git commit -m "feat(ui): AI morning briefing card with time-aware greeting and insights"
```

### Task 5.3: Upgraded Metric Cards for Bento

**Files:**
- Modify: `apps/web/src/components/dashboard/metric-cards.tsx`

- [ ] **Step 1: Redesign metric cards with hero number pattern**

Replace entire file:

```tsx
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  ClipboardCheck,
  PackageSearch,
  DollarSign,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import type { Metric } from "@/lib/api";

const ICON_MAP: Record<string, LucideIcon> = {
  "Orders ready": ClipboardCheck,
  "Inventory risks": PackageSearch,
  "Food cost alerts": DollarSign,
  "Campaign ideas": Lightbulb,
};

const FALLBACK_METRICS = [
  { label: "Orders ready", value: "08", delta: "+3 today" },
  { label: "Inventory risks", value: "05", delta: "2 critical" },
  { label: "Food cost alerts", value: "03", delta: "1 new" },
  { label: "Campaign ideas", value: "12", delta: "for next launch" },
];

interface MetricCardsProps {
  metrics: Metric[] | null;
}

export function MetricCards({ metrics }: MetricCardsProps) {
  const data = metrics ?? FALLBACK_METRICS;

  return (
    <>
      {data.map((m) => {
        const Icon = ICON_MAP[m.label] ?? Lightbulb;
        const isPositive = m.delta.startsWith("+") || m.delta.includes("launch");
        return (
          <Card
            key={m.label}
            className="shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_6px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5"
          >
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </span>
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="size-4 text-primary" />
                </div>
              </div>
              <div className="text-3xl font-bold tabular-nums tracking-tight">{m.value}</div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1 tabular-nums">
                {isPositive ? (
                  <TrendingUp className="size-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="size-3 text-amber-500" />
                )}
                {m.delta}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
```

Note: Removed the wrapping grid div — the parent BentoGrid now handles layout. Each card is a standalone fragment child.

- [ ] **Step 2: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/metric-cards.tsx
git commit -m "feat(ui): premium metric cards with hero numbers, layered shadows, hover lift"
```

### Task 5.4: Redesigned Home Page with Bento Layout

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Rewrite the home page with bento dashboard above the chat**

Replace entire file:

```tsx
"use client";

import { ChatView } from "@/components/chat/chat-view";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useLocations, useMetrics } from "@/hooks/use-api";
import { BentoGrid, BentoItem } from "@/components/dashboard/bento-grid";
import { AIBriefingCard } from "@/components/dashboard/ai-briefing-card";
import { MetricCards } from "@/components/dashboard/metric-cards";

export default function HomePage() {
  const activeLocationId = useWorkspaceStore((s) => s.activeLocationId);
  const messages = useWorkspaceStore((s) => s.messages);
  const { data: locations } = useLocations();
  const { data: metrics } = useMetrics(activeLocationId);
  const activeName = locations?.find((l) => l.id === activeLocationId)?.name;

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <span className="text-sm font-semibold">CarabinerOS</span>
        {activeName && (
          <>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{activeName}</span>
          </>
        )}
        <div className="ml-auto">
          <kbd className="hidden sm:inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-[10px] text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </header>

      {/* Show bento dashboard when no active conversation */}
      {!hasMessages && (
        <div className="p-6 pb-2">
          <BentoGrid>
            <BentoItem span="2x1">
              <AIBriefingCard locationName={activeName} />
            </BentoItem>
            <MetricCards metrics={metrics ?? null} />
          </BentoGrid>
        </div>
      )}

      <ChatView />
    </div>
  );
}
```

- [ ] **Step 2: Add useMetrics hook to use-api.ts**

The `useMetrics` hook does not exist yet. Add it to `apps/web/src/hooks/use-api.ts`. Add this import at the top alongside the existing type imports:

```tsx
import type { Metric } from "@/lib/api";
```

(If `Metric` is already imported, skip.) Then add this hook after the existing `useInvoices` function:

```tsx
export function useMetrics(locationId?: string | null) {
  return useQuery<Metric[]>({
    queryKey: ["metrics", locationId],
    queryFn: () =>
      apiFetch(`/api/metrics${locationId ? `?location_id=${locationId}` : ""}`),
    retry: false,
  });
}
```

Note: The API endpoint may not exist yet. The `retry: false` prevents hammering a missing endpoint. The home page uses `metrics ?? null` which falls back to `FALLBACK_METRICS` in the MetricCards component.

- [ ] **Step 3: Verify build**

```bash
cd apps/web && npx next build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/components/dashboard/
git commit -m "feat(ui): bento grid home page with AI briefing card and metric tiles"
```

---

## Merge Order

Merge phases into main in this order to minimize conflicts:

1. **Phase 1** (brand identity) — foundational colors + sidebar icons, no deps on other phases
2. **Phase 2** (motion) — adds framer-motion + sonner deps, builds on Phase 1 colors
3. **Phase 3** (command palette) — adds cmdk dep + layout.tsx tweak. After merge, run `pnpm install` to regenerate lockfile if Phase 2's lockfile changes conflict.
4. **Phase 4** (chat UX) — touches chat components exclusively (including the accent color changes)
5. **Phase 5** (bento dashboard) — touches home page, dashboard components, and adds useMetrics hook

Each merge: `git merge --no-ff ui/phaseN-*` then verify with `cd apps/web && pnpm install && npx next build`.
