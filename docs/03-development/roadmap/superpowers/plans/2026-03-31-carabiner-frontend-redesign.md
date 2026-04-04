# CarabinerOS Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the CarabinerOS frontend from a generic AI dashboard into a distinctive, restaurant-native interface with chat-forward home page, AI co-pilot sidebar, persistent bottom chatbar, and consistent typography.

**Architecture:** Hybrid Core + Custom Wings — core modules (Orders, Inventory, Prep, Invoices, Food Cost, Reporting) share a consistent shell (content + right sidebar + bottom chatbar), while creative modules (Menu, Recipes, Marketing) get custom layouts. The existing `module-chat.tsx` component is reused as the bottom chatbar foundation.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Framer Motion, shadcn/ui, Socket.IO client

---

## File Structure

### New Files to Create
- `frontend/src/components/bottom-chatbar.tsx` — Persistent bottom chatbar for all module pages
- `frontend/src/components/sidebar-copilot.tsx` — Right sidebar AI co-pilot panel
- `frontend/src/components/sidebar-copilot-header.tsx` — Sidebar header with close button
- `frontend/src/components/sidebar-copilot-insights.tsx` — AI insights section
- `frontend/src/components/sidebar-copilot-context.tsx` — Context data section
- `frontend/src/components/sidebar-copilot-actions.tsx` — Quick actions section
- `frontend/src/components/home-view.tsx` — Redesigned home page (replaces existing)
- `frontend/src/components/daily-briefing.tsx` — Daily briefing card component
- `frontend/src/components/prep-kanban.tsx` — Kanban board for Prep page
- `frontend/src/components/menu-matrix.tsx` — Menu engineering 2×2 matrix
- `frontend/src/components/recipe-card.tsx` — Recipe card for cookbook layout
- `frontend/src/components/marketing-dashboard.tsx` — Marketing campaign dashboard
- `frontend/src/lib/typography-lint.ts` — Typography enforcement utility
- `frontend/src/hooks/use-sidebar-copilot.ts` — Sidebar state management hook
- `frontend/src/hooks/use-typography-enforcement.ts` — Typography audit hook

### Files to Modify
- `frontend/src/components/shell.tsx` — Add bottom chatbar, restructure layout
- `frontend/src/components/top-bar.tsx` — Minor adjustments for new shell
- `frontend/src/components/app-sidebar.tsx` — No changes needed (already good)
- `frontend/src/app/page.tsx` — Replace with new home page
- `frontend/src/app/orders/page.tsx` — Add sidebar integration
- `frontend/src/app/inventory/page.tsx` — Add sidebar integration
- `frontend/src/app/prep/page.tsx` — Redesign as Kanban
- `frontend/src/app/invoices/page.tsx` — Add sidebar integration
- `frontend/src/app/food-cost/page.tsx` — Add sidebar integration
- `frontend/src/app/reporting/page.tsx` — Add sidebar integration
- `frontend/src/app/menu/page.tsx` — Redesign as matrix
- `frontend/src/app/recipes/page.tsx` — Redesign as cookbook
- `frontend/src/app/marketing/page.tsx` — Redesign as dashboard
- `frontend/src/app/globals.css` — Add sidebar animations, chatbar styles
- `frontend/src/app/layout.tsx` — Verify shell wrapping
- `DESIGN_TOKENS.md` — Add typography enforcement rules

---

## Chunk 1: Foundation — Shell, Bottom Chatbar, Typography

### Task 1.1: Create Bottom Chatbar Component

**Files:**
- Create: `frontend/src/components/bottom-chatbar.tsx`

**Context:** The existing `module-chat.tsx` component already handles module-specific chat with context, localStorage persistence, and message history. We'll create a new `bottom-chatbar.tsx` that wraps a simplified version of this for the persistent footer.

- [ ] **Step 1: Create bottom-chatbar.tsx**

```tsx
"use client";

import { useState, useCallback, useEffect, useRef, useMemo, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUp, Paperclip, Loader2 } from "lucide-react";
import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";

/* Context-aware placeholder prompts per module */
const MODULE_PROMPTS: Record<string, string> = {
  home: "Ask CarabinerOS anything…",
  orders: "Ask about orders…",
  inventory: "Check inventory levels…",
  prep: "Update prep status…",
  invoices: "Process this invoice…",
  "food-cost": "Why is food cost high?…",
  menu: "Analyze menu performance…",
  recipes: "Cost out a recipe…",
  marketing: "Generate a campaign…",
  reporting: "Run a P&L report…",
  settings: "Change settings…",
  plugins: "Manage plugins…",
};

interface BottomChatbarProps {
  moduleId: string;
}

export function BottomChatbar({ moduleId }: BottomChatbarProps) {
  const { snapshot, subscribe } = useSocketContext();
  const { sendMessage, messages, loading, createNewChat, resetChat } = useChat(snapshot);

  const [value, setValue] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const placeholder = MODULE_PROMPTS[moduleId] ?? MODULE_PROMPTS.home;

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const doSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (!hasStarted) {
        const newCtxId = await createNewChat();
        if (newCtxId) {
          subscribe(newCtxId);
        }
        setHasStarted(true);

        await sendMessage(trimmed);
        setValue("");
        return;
      }

      await sendMessage(trimmed);
      setValue("");
    },
    [hasStarted, createNewChat, sendMessage, subscribe],
  );

  const handleSubmit = useCallback(() => {
    doSend(value);
  }, [value, doSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      doSend(`[Attached: ${file.name}]`);
      e.target.value = "";
    }
  };

  // Filter messages: only show user messages and assistant responses
  const filteredMessages = useMemo(() => {
    const firstUserIdx = messages.findIndex((m) => m.role === "user");
    if (firstUserIdx === -1) return [];
    return messages.slice(firstUserIdx).filter((m) => {
      if (m.role !== "assistant") return true;
      const lower = m.content.toLowerCase();
      if (lower.includes("welcome to carabiner")) return false;
      if (lower.includes("how can i help")) return false;
      return true;
    });
  }, [messages]);

  return (
    <div className="border-t border-border bg-card/80 glass-subtle">
      {/* Messages area (collapsible) */}
      <AnimatePresence>
        {filteredMessages.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              className="max-h-[200px] overflow-y-auto px-4 py-2 flex flex-col gap-2"
            >
              {filteredMessages.slice(-3).map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      msg.role === "user"
                        ? "bg-primary/10 rounded-lg px-3 py-1.5 text-xs max-w-[80%]"
                        : "bg-muted/20 rounded-lg px-3 py-1.5 text-xs max-w-[80%]"
                    }
                  >
                    <span className="text-foreground">{msg.content}</span>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  <span className="text-[10px] font-mono">Working…</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Attachment button */}
        <button
          onClick={handleAttachClick}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors"
          title="Attach file"
        >
          <Paperclip className="size-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.csv,.xlsx,.xls,.doc,.docx,.txt"
          onChange={handleFileChange}
        />

        {/* Input */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className="
              w-full rounded-2xl border border-border bg-card/80
              px-4 py-2.5 pr-10 text-sm text-foreground
              placeholder:text-muted-foreground/40
              outline-none transition-all duration-200
              focus:border-primary/50 focus:ring-2 focus:ring-primary/25
              focus:shadow-[0_0_20px_oklch(0.72_0.22_160_/_0.12)]
              hover:border-primary/25
            "
          />
          <motion.button
            onClick={handleSubmit}
            disabled={!value.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="
              absolute right-1.5 top-1/2 -translate-y-1/2
              size-7 rounded-lg flex items-center justify-center
              bg-gradient-to-br from-primary to-primary/80 text-primary-foreground
              hover:shadow-[0_0_12px_oklch(0.72_0.22_160_/_0.3)]
              disabled:opacity-20 disabled:shadow-none
              transition-all duration-200
            "
          >
            <ArrowUp className="size-3.5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `cd frontend && pnpm build`
Expected: No TypeScript errors related to bottom-chatbar.tsx

---

### Task 1.2: Create Sidebar Co-Pilot Component

**Files:**
- Create: `frontend/src/components/sidebar-copilot.tsx`
- Create: `frontend/src/components/sidebar-copilot-header.tsx`
- Create: `frontend/src/components/sidebar-copilot-insights.tsx`
- Create: `frontend/src/components/sidebar-copilot-context.tsx`
- Create: `frontend/src/components/sidebar-copilot-actions.tsx`
- Create: `frontend/src/hooks/use-sidebar-copilot.ts`

- [ ] **Step 1: Create use-sidebar-copilot hook**

```tsx
"use client";

import { useState, useCallback } from "react";

export interface CopilotItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  status?: string;
  data?: Record<string, string>;
  insights?: { text: string; actions: string[] }[];
  actions?: { label: string; variant: "primary" | "secondary" }[];
}

interface UseSidebarCopilotReturn {
  isOpen: boolean;
  selectedItem: CopilotItem | null;
  openItem: (item: CopilotItem) => void;
  close: () => void;
}

export function useSidebarCopilot(): UseSidebarCopilotReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CopilotItem | null>(null);

  const openItem = useCallback((item: CopilotItem) => {
    setSelectedItem(item);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedItem(null);
  }, []);

  return { isOpen, selectedItem, openItem, close };
}
```

- [ ] **Step 2: Create sidebar-copilot-header.tsx**

```tsx
"use client";

import { X } from "lucide-react";

interface SidebarCopilotHeaderProps {
  title: string;
  subtitle?: string;
  status?: string;
  onClose: () => void;
}

export function SidebarCopilotHeader({ title, subtitle, status, onClose }: SidebarCopilotHeaderProps) {
  return (
    <div className="flex items-start justify-between px-4 py-3 border-b border-border">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-foreground truncate">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
        {status && (
          <span className="inline-block mt-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-primary/80">
            {status}
          </span>
        )}
      </div>
      <button
        onClick={onClose}
        className="size-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/10 transition-colors ml-2 shrink-0"
        title="Close"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create sidebar-copilot-insights.tsx**

```tsx
"use client";

import { Sparkles } from "lucide-react";

interface SidebarCopilotInsightsProps {
  insights: { text: string; actions: string[] }[];
  onAction?: (action: string) => void;
}

export function SidebarCopilotInsights({ insights, onAction }: SidebarCopilotInsightsProps) {
  if (insights.length === 0) return null;

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="size-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80">
          AI Insights
        </span>
      </div>
      {insights.map((insight, i) => (
        <div key={i} className="mb-3 last:mb-0">
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
            {insight.text}
          </p>
          {insight.actions.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {insight.actions.map((action) => (
                <button
                  key={action}
                  onClick={() => onAction?.(action)}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create sidebar-copilot-context.tsx**

```tsx
"use client";

interface SidebarCopilotContextProps {
  data: Record<string, string>;
}

export function SidebarCopilotContextData({ data }: SidebarCopilotContextProps) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="px-4 py-3 border-b border-border">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 block">
        Details
      </span>
      {entries.map(([key, value]) => (
        <div key={key} className="flex justify-between text-[11px] py-1.5 border-b border-border/30 last:border-none">
          <span className="text-muted-foreground/70">{key}</span>
          <span className="font-mono font-semibold tabular-nums text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create sidebar-copilot-actions.tsx**

```tsx
"use client";

interface SidebarCopilotActionsProps {
  actions: { label: string; variant: "primary" | "secondary" }[];
  onAction?: (label: string) => void;
}

export function SidebarCopilotActions({ actions, onAction }: SidebarCopilotActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="px-4 py-3">
      <div className="flex flex-col gap-1.5">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => onAction?.(action.label)}
            className={`w-full text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
              action.variant === "primary"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create sidebar-copilot.tsx (main component)**

```tsx
"use client";

import { motion, AnimatePresence } from "motion/react";
import { SidebarCopilotHeader } from "./sidebar-copilot-header";
import { SidebarCopilotInsights } from "./sidebar-copilot-insights";
import { SidebarCopilotContextData } from "./sidebar-copilot-context";
import { SidebarCopilotActions } from "./sidebar-copilot-actions";
import { useSidebarCopilot, type CopilotItem } from "./use-sidebar-copilot";

interface SidebarCopilotProps {
  children?: React.ReactNode;
}

export function SidebarCopilot({ children }: SidebarCopilotProps) {
  const { isOpen, selectedItem, openItem, close } = useSidebarCopilot();

  if (!isOpen || !selectedItem) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-[320px] shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden"
        >
          <SidebarCopilotHeader
            title={selectedItem.title}
            subtitle={selectedItem.subtitle}
            status={selectedItem.status}
            onClose={close}
          />

          <div className="flex-1 overflow-y-auto">
            {selectedItem.insights && selectedItem.insights.length > 0 && (
              <SidebarCopilotInsights
                insights={selectedItem.insights}
                onAction={(action) => console.log("Action:", action)}
              />
            )}

            {selectedItem.data && Object.keys(selectedItem.data).length > 0 && (
              <SidebarCopilotContextData data={selectedItem.data} />
            )}

            {selectedItem.actions && selectedItem.actions.length > 0 && (
              <SidebarCopilotActions
                actions={selectedItem.actions}
                onAction={(label) => console.log("Action:", label)}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Re-export hook and types for use in module pages
export { useSidebarCopilot, type CopilotItem };
```

- [ ] **Step 7: Verify components compile**

Run: `cd frontend && pnpm build`
Expected: No TypeScript errors

---

### Task 1.3: Update Shell to Include Bottom Chatbar and Sidebar

**Files:**
- Modify: `frontend/src/components/shell.tsx`

- [ ] **Step 1: Update shell.tsx to include bottom chatbar and sidebar slot**

```tsx
"use client";

import { createContext, useContext, useState, useCallback, type ReactNode, type MouseEvent } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { NotificationPanel } from "@/components/notification-panel";
import { BottomChatbar } from "@/components/bottom-chatbar";
import { useActionCards } from "@/hooks/use-action-cards";
import { useSocketContext } from "@/components/socket-provider";

interface ShellContextValue {
  openSidebar: () => void;
  closeSidebar: () => void;
  sidebarHidden: boolean;
  newChatPending: boolean;
  requestNewChat: () => void;
  consumeNewChat: () => void;
  moduleId: string;
  setModuleId: (id: string) => void;
}

const ShellContext = createContext<ShellContextValue>({
  openSidebar: () => {},
  closeSidebar: () => {},
  sidebarHidden: true,
  newChatPending: false,
  requestNewChat: () => {},
  consumeNewChat: () => {},
  moduleId: "home",
  setModuleId: () => {},
});

export function useShell() {
  return useContext(ShellContext);
}

export function Shell({ children }: { children: ReactNode }) {
  const [sidebarHidden, setSidebarHidden] = useState(true);
  const [newChatPending, setNewChatPending] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [moduleId, setModuleId] = useState("home");

  const { notifications } = useSocketContext();
  const actionCards = useActionCards(notifications);

  const openSidebar = useCallback(() => setSidebarHidden(false), []);
  const closeSidebar = useCallback(() => setSidebarHidden(true), []);
  const requestNewChat = useCallback(() => setNewChatPending(true), []);
  const consumeNewChat = useCallback(() => setNewChatPending(false), []);

  const handleMainClick = useCallback((e: MouseEvent) => {
    if (sidebarHidden) return;
    const target = e.target as HTMLElement;
    const interactive = target.closest("a, button, input, textarea, select, [role='button'], [tabindex]");
    if (!interactive) closeSidebar();
  }, [sidebarHidden, closeSidebar]);

  return (
    <ShellContext.Provider value={{ openSidebar, closeSidebar, sidebarHidden, newChatPending, requestNewChat, consumeNewChat, moduleId, setModuleId }}>
      <AppSidebar hidden={sidebarHidden} />
      <main className="flex-1 flex flex-col min-h-dvh overflow-hidden relative" onClick={handleMainClick}>
        <TopBar
          unreadCount={actionCards.unreadCount}
          lastCardType={actionCards.lastCardType}
          onBellClick={() => { setNotifOpen(true); actionCards.markAllRead(); }}
        />
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            {children}
          </div>
        </div>
        <BottomChatbar moduleId={moduleId} />
        <NotificationPanel
          open={notifOpen}
          onOpenChange={setNotifOpen}
          cards={actionCards.sortedCards}
          urgentBanner={actionCards.urgentBanner}
          unreadCount={actionCards.unreadCount}
          expandedCardId={actionCards.expandedCardId}
          expandedCard={actionCards.expandedCardId ? actionCards.sortedCards.find(c => c.id === actionCards.expandedCardId) ?? null : null}
          chatThread={actionCards.chatThread}
          chatLoading={actionCards.chatLoading}
          onExpand={actionCards.expandCard}
          onCollapse={actionCards.collapseCard}
          onCommit={actionCards.commitCard}
          onDismiss={actionCards.dismissCard}
          onSendMessage={actionCards.sendCardMessage}
        />
      </main>
    </ShellContext.Provider>
  );
}
```

- [ ] **Step 2: Verify shell compiles**

Run: `cd frontend && pnpm build`
Expected: No TypeScript errors

---

### Task 1.4: Typography Audit & Enforcement

**Files:**
- Create: `frontend/src/lib/typography-lint.ts`
- Modify: All module pages to enforce font-mono on numbers

- [ ] **Step 1: Create typography-lint.ts utility**

```ts
/**
 * Typography enforcement utility for CarabinerOS.
 * 
 * Rules:
 * - DM Sans (default) for ALL text: headings, body, labels, descriptions
 * - Geist Mono (font-mono) for ALL numbers: prices, %, dates, times, quantities, KPIs
 * 
 * Usage: Wrap numeric values with <span className="font-mono tabular-nums">{value}</span>
 * 
 * Banned: Any explicit font-family other than DM Sans or Geist Mono.
 */

export const TYPOGRAPHY_RULES = {
  text: {
    font: "DM Sans",
    tailwind: "default (no class needed)",
    useFor: "Headings, body, labels, descriptions, buttons",
  },
  numbers: {
    font: "Geist Mono",
    tailwind: "font-mono tabular-nums",
    useFor: "Prices, percentages, dates, times, quantities, KPIs, axis labels",
  },
} as const;

/**
 * Format a numeric value with proper typography classes.
 * Use this for all numbers in the UI.
 */
export function formatNumber(value: string | number, className?: string): string {
  return `<span class="font-mono tabular-nums ${className || ''}">${value}</span>`;
}

/**
 * Format a currency value with proper typography classes.
 */
export function formatCurrency(value: number): string {
  const formatted = value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `<span class="font-mono tabular-nums">${formatted}</span>`;
}

/**
 * Format a percentage value with proper typography classes.
 */
export function formatPercent(value: number): string {
  return `<span class="font-mono tabular-nums">${value.toFixed(1)}%</span>`;
}
```

- [ ] **Step 2: Audit and fix font violations in existing pages**

Search for font violations:
```bash
cd frontend && grep -rn "font-sans\|font-inter\|font-['" src/ --include="*.tsx"
```

Fix any violations by:
- Removing explicit `font-sans` or `font-inter` classes (DM Sans is default)
- Adding `font-mono tabular-nums` to all numeric displays
- Adding `font-mono tabular-nums` to all price/percentage/date displays

- [ ] **Step 3: Update DESIGN_TOKENS.md with enforcement rules**

Add to DESIGN_TOKENS.md:
```markdown
## Typography Enforcement

**Rules:**
- DM Sans is the default font — no class needed for text
- Geist Mono (`font-mono tabular-nums`) MUST be used for ALL numeric values
- Banned: `font-sans`, `font-inter`, `font-['Inter']`, or any explicit font-family
- If a number doesn't use `font-mono`, it's a bug

**Quick reference:**
- Prices: `<span className="font-mono tabular-nums">$1,240</span>`
- Percentages: `<span className="font-mono tabular-nums">28.4%</span>`
- Dates/Times: `<span className="font-mono tabular-nums">2:00 PM</span>`
- Quantities: `<span className="font-mono tabular-nums">142</span>`
- KPIs: `<span className="font-mono tabular-nums">142/185</span>`
```

- [ ] **Step 4: Verify build passes**

Run: `cd frontend && pnpm build`
Expected: No errors

---

### Task 1.5: Update globals.css with Sidebar and Chatbar Styles

**Files:**
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Add sidebar and chatbar styles**

Add to globals.css:
```css
/* ── Sidebar Copilot ── */
.sidebar-copilot {
  width: 320px;
  border-left: 1px solid var(--border);
  background: var(--card);
  overflow: hidden;
}

/* ── Bottom Chatbar ── */
.bottom-chatbar {
  height: 72px;
  border-top: 1px solid var(--border);
  background: oklch(from var(--card) l c h / 0.8);
  backdrop-filter: blur(8px) saturate(1.2);
  -webkit-backdrop-filter: blur(8px) saturate(1.2);
}

/* ── Module page layout ── */
.module-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.module-page-content {
  flex: 1;
  overflow: auto;
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd frontend && pnpm build`
Expected: No errors

---

## Chunk 2: Home Page Redesign

### Task 2.1: Redesign Home View

**Files:**
- Modify: `frontend/src/components/home-view.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Redesign home-view.tsx**

The home page should be chat-forward with:
- Large centered greeting
- Large chat composer (primary interaction)
- Daily Briefing card (AI-generated insights)
- KPI Solitaire cards (operational metrics)
- No sidebar on home page

Key changes:
- Keep the existing greeting logic
- Make the chat composer larger and more prominent
- Keep the Daily Briefing card (already well-designed)
- Keep the SolitaireCards (already good)
- Ensure bottom chatbar is visible but doesn't compete with the main composer

- [ ] **Step 2: Update page.tsx to set moduleId**

```tsx
"use client";

import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";
import { HomeView } from "@/components/home-view";
import { useShell } from "@/components/shell";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const { newChatPending, consumeNewChat, setModuleId } = useShell();
  const { snapshot, subscribe } = useSocketContext();
  const { sendMessage, resetChat, createNewChat } = useChat(snapshot);
  const creatingChatRef = useRef(false);
  const sendingRef = useRef(false);

  // Set module ID for bottom chatbar context
  useEffect(() => {
    setModuleId("home");
  }, [setModuleId]);

  // ... rest of existing logic ...

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      <HomeView onSend={handleSend} />
    </div>
  );
}
```

- [ ] **Step 3: Verify home page renders**

Run: `cd frontend && pnpm dev`
Expected: Home page shows greeting, chat composer, daily briefing, KPI cards, bottom chatbar

---

## Chunk 3: Core Module Sidebar Integration

### Task 3.1: Orders Page Sidebar Integration

**Files:**
- Modify: `frontend/src/app/orders/page.tsx`

- [ ] **Step 1: Add sidebar integration to Orders page**

Add to Orders page:
- Import `useSidebarCopilot` and `SidebarCopilot`
- Add `setModuleId("orders")` on mount
- On row click, call `openItem()` with order details
- Render `<SidebarCopilot />` alongside the main content

- [ ] **Step 2: Verify Orders page with sidebar**

Run: `cd frontend && pnpm dev`
Expected: Orders page shows pipeline, table, bottom chatbar. Clicking a row opens sidebar with order details.

---

### Task 3.2: Inventory Page Sidebar Integration

**Files:**
- Modify: `frontend/src/app/inventory/page.tsx`

- [ ] **Step 1: Add sidebar integration to Inventory page**

Same pattern as Orders:
- Add `setModuleId("inventory")` on mount
- On row click, open sidebar with item details
- Render `<SidebarCopilot />` alongside content

- [ ] **Step 2: Verify Inventory page with sidebar**

---

### Task 3.3: Food Cost Page Sidebar Integration

**Files:**
- Modify: `frontend/src/app/food-cost/page.tsx`

- [ ] **Step 1: Add sidebar integration**

Same pattern. On dish/item click, open sidebar with cost analysis.

---

### Task 3.4: Reporting Page Sidebar Integration

**Files:**
- Modify: `frontend/src/app/reporting/page.tsx`

- [ ] **Step 1: Add sidebar integration**

Same pattern. On P&L row click, open sidebar with category analysis.

---

### Task 3.5: Prep Page Redesign as Kanban

**Files:**
- Create: `frontend/src/components/prep-kanban.tsx`
- Modify: `frontend/src/app/prep/page.tsx`

- [ ] **Step 1: Create prep-kanban.tsx**

Create a 4-column Kanban board:
- Not Started | In Progress | Ready | Blocked
- Cards with station, item, quantity, urgency
- Drag-and-drop between columns (optional, can be phase 2)
- Card click opens sidebar

- [ ] **Step 2: Update prep/page.tsx to use Kanban**

Replace existing table layout with Kanban board.

---

### Task 3.6: Invoices Page Sidebar Integration

**Files:**
- Modify: `frontend/src/app/invoices/page.tsx`

- [ ] **Step 1: Add sidebar integration**

Same pattern. On invoice click, open sidebar with PO comparison.

---

## Chunk 4: Custom Module Layouts

### Task 4.1: Menu Page — Menu Engineering Matrix

**Files:**
- Create: `frontend/src/components/menu-matrix.tsx`
- Modify: `frontend/src/app/menu/page.tsx`

- [ ] **Step 1: Create menu-matrix.tsx**

Create a 2×2 matrix component:
- Y-axis: Profitability (Low → High)
- X-axis: Popularity (Low → High)
- Quadrants: Stars, Plowhorses, Puzzles, Dogs
- Dishes plotted as bubbles
- Click opens sidebar

- [ ] **Step 2: Update menu/page.tsx**

Replace table with matrix layout.

---

### Task 4.2: Recipes Page — Cookbook Layout

**Files:**
- Create: `frontend/src/components/recipe-card.tsx`
- Modify: `frontend/src/app/recipes/page.tsx`

- [ ] **Step 1: Create recipe-card.tsx**

Create a recipe card component with:
- Dish name, cost, margin %, category badge
- Hover effects
- Click opens sidebar with full recipe

- [ ] **Step 2: Update recipes/page.tsx**

Replace table with grid of recipe cards.

---

### Task 4.3: Marketing Page — Campaign Dashboard

**Files:**
- Create: `frontend/src/components/marketing-dashboard.tsx`
- Modify: `frontend/src/app/marketing/page.tsx`

- [ ] **Step 1: Create marketing-dashboard.tsx**

Create a campaign dashboard with:
- KPI strip
- Social Media + Email campaign cards
- Content calendar
- Click opens sidebar

- [ ] **Step 2: Update marketing/page.tsx**

Replace existing layout with dashboard.

---

## Chunk 5: Polish & Testing

### Task 5.1: Cross-Browser Testing

- [ ] **Step 1: Test in Chrome, Firefox, Safari**

Verify all pages render correctly.

### Task 5.2: Responsive Design

- [ ] **Step 1: Test on mobile breakpoints**

Ensure sidebar becomes full-screen overlay on mobile.

### Task 5.3: Performance Optimization

- [ ] **Step 1: Run Lighthouse audit**

Target: 90+ on Performance, Accessibility, Best Practices.

---

## Execution Order

1. **Chunk 1** (Foundation) — Must be complete before any other chunk
2. **Chunk 2** (Home Page) — Can start after Chunk 1
3. **Chunk 3** (Core Modules) — Can start after Chunk 1, parallel with Chunk 2
4. **Chunk 4** (Custom Modules) — Can start after Chunk 1, parallel with Chunks 2-3
5. **Chunk 5** (Polish) — Must be last, after all other chunks

---

*End of plan.*
