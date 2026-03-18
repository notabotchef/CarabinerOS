# Phase 1: Chat UI Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the chat from a basic text interface into a premium action-engine experience — action cards rail, voice input, enhanced status pills, polished message rendering, and notifications.

**Architecture:** All changes are frontend-only in `apps/web/`. The backend (Phase 2) runs in a parallel branch. Where backend events don't exist yet, use mock data / simulated Socket.IO events so the UI can be built and tested independently. When the branches merge, the real backend events will slot into the same interfaces.

**Branch:** `ui/phase1-chat-overhaul`

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind 4, shadcn/ui, Framer Motion, Zustand, Socket.IO client, Web Speech API

**Verification:** `cd apps/web && npx next build` (type-check + build). No test framework exists yet for frontend.

**Spec:** `docs/superpowers/specs/2026-03-18-carabineros-roadmap-to-launch-design.md` (Phase 1)

---

## File Structure

### New Files
- `apps/web/src/components/chat/action-card.tsx` — Single action card component
- `apps/web/src/components/chat/action-cards-rail.tsx` — Right-side rail container for action cards
- `apps/web/src/components/chat/inline-action-card.tsx` — Compact action card rendered inline within chat messages
- `apps/web/src/components/chat/voice-input.tsx` — Voice-to-text microphone button + recording UI
- `apps/web/src/components/chat/chat-status-chain.tsx` — Enhanced status pill showing agent delegation chain
- `apps/web/src/components/chat/message-copy-button.tsx` — Copy-to-clipboard button for agent messages
- `apps/web/src/components/notifications/notification-bell.tsx` — Header notification bell with unread count
- `apps/web/src/components/notifications/notification-panel.tsx` — Dropdown panel listing notifications
- `apps/web/src/stores/notification-store.ts` — Zustand store for notifications + action cards
- `apps/web/src/types/speech.d.ts` — SpeechRecognition Web API type declarations

### Modified Files
- `apps/web/src/components/chat/chat-composer.tsx` — Add voice input button, integrate new status chain
- `apps/web/src/components/chat/chat-message.tsx` — Add timestamps, copy button, brand treatment, inline action cards
- `apps/web/src/components/chat/chat-view.tsx` — Integrate action cards rail layout
- `apps/web/src/components/chat/chat-status-pill.tsx` — Replace with enhanced chain component
- `apps/web/src/components/workspace/chat-dock.tsx` — Adjust layout for action cards rail
- `apps/web/src/app/page.tsx` — Add notification bell to header
- `apps/web/src/app/layout.tsx` — Nothing needed (providers already in place)
- `apps/web/src/hooks/use-socket.ts` — Listen for `action_card` events
- `apps/web/src/stores/workspace-store.ts` — Add action cards state
- `apps/web/src/lib/chat-helpers.ts` — Add action card type definitions
- `apps/web/src/components/app-sidebar.tsx` — Improve conversation list persistence
- `packages/api-types/src/index.ts` — Add ActionCard type

---

## Task 1: Action Card Types & Store

**Files:**
- Modify: `packages/api-types/src/index.ts`
- Create: `apps/web/src/stores/notification-store.ts`

- [ ] **Step 1: Add ActionCard type to api-types**

Add to `packages/api-types/src/index.ts` after the existing types:

```typescript
export interface ActionCardField {
  label: string
  value: string
  highlight?: "success" | "warning" | "danger"
}

export interface ActionCard {
  id: string
  module: "inventory" | "orders" | "prep" | "food-cost" | "menu" | "marketing" | "invoices" | "recipes" | "reporting"
  action: string
  title: string
  fields: ActionCardField[]
  timestamp: string
  itemId?: string
  status?: "completed" | "pending" | "error"
}

export interface Notification {
  id: string
  type: "task_completed" | "price_alert" | "shortage" | "delivery"
  title: string
  message: string
  module?: string
  itemId?: string
  timestamp: string
  read: boolean
}
```

- [ ] **Step 2: Create notification store**

Create `apps/web/src/stores/notification-store.ts`:

```typescript
"use client"

import { create } from "zustand"
import type { ActionCard, Notification } from "@carabiner-os/api-types"

interface NotificationState {
  actionCards: ActionCard[]
  notifications: Notification[]
  unreadCount: number

  addActionCard: (card: ActionCard) => void
  dismissActionCard: (id: string) => void
  clearActionCards: () => void

  addNotification: (notification: Notification) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearNotifications: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  actionCards: [],
  notifications: [],
  unreadCount: 0,

  addActionCard: (card) =>
    set((state) => ({
      actionCards: [card, ...state.actionCards],
    })),

  dismissActionCard: (id) =>
    set((state) => ({
      actionCards: state.actionCards.filter((c) => c.id !== id),
    })),

  clearActionCards: () => set({ actionCards: [] }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    })),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
}))
```

- [ ] **Step 3: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/api-types/src/index.ts apps/web/src/stores/notification-store.ts
git commit -m "feat: add ActionCard/Notification types and notification store"
```

---

## Task 2: Action Card Component

**Files:**
- Create: `apps/web/src/components/chat/action-card.tsx`

- [ ] **Step 1: Create ActionCard component**

Create `apps/web/src/components/chat/action-card.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActionCard as ActionCardType } from "@carabiner-os/api-types"

const MODULE_COLORS: Record<string, { bg: string; border: string; badge: string; text: string }> = {
  inventory: { bg: "bg-amber-500/5", border: "border-amber-500/20", badge: "bg-amber-500/15 text-amber-500", text: "text-amber-500" },
  orders: { bg: "bg-blue-500/5", border: "border-blue-500/20", badge: "bg-blue-500/15 text-blue-500", text: "text-blue-500" },
  prep: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", badge: "bg-emerald-500/15 text-emerald-500", text: "text-emerald-500" },
  "food-cost": { bg: "bg-red-500/5", border: "border-red-500/20", badge: "bg-red-500/15 text-red-500", text: "text-red-500" },
  menu: { bg: "bg-purple-500/5", border: "border-purple-500/20", badge: "bg-purple-500/15 text-purple-500", text: "text-purple-500" },
  marketing: { bg: "bg-pink-500/5", border: "border-pink-500/20", badge: "bg-pink-500/15 text-pink-500", text: "text-pink-500" },
  invoices: { bg: "bg-cyan-500/5", border: "border-cyan-500/20", badge: "bg-cyan-500/15 text-cyan-500", text: "text-cyan-500" },
  recipes: { bg: "bg-orange-500/5", border: "border-orange-500/20", badge: "bg-orange-500/15 text-orange-500", text: "text-orange-500" },
  reporting: { bg: "bg-indigo-500/5", border: "border-indigo-500/20", badge: "bg-indigo-500/15 text-indigo-500", text: "text-indigo-500" },
}

interface ActionCardProps {
  card: ActionCardType
  onDismiss: (id: string) => void
}

export function ActionCard({ card, onDismiss }: ActionCardProps) {
  const router = useRouter()
  const colors = MODULE_COLORS[card.module] ?? MODULE_COLORS.inventory

  const handleClick = () => {
    const path = `/workspace/${card.module}`
    router.push(card.itemId ? `${path}?item=${card.itemId}` : path)
  }

  const timeAgo = () => {
    const diff = Date.now() - new Date(card.timestamp).getTime()
    if (diff < 60_000) return "just now"
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    return `${Math.floor(diff / 3_600_000)}h ago`
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn(
        "relative cursor-pointer rounded-xl border p-3 transition-colors hover:brightness-110",
        colors.bg,
        colors.border
      )}
      onClick={handleClick}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDismiss(card.id)
        }}
        className="absolute right-2 top-2 rounded-md p-0.5 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100 [div:hover>&]:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>

      <div className="mb-2 flex items-center justify-between">
        <span className={cn("rounded px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide", colors.badge)}>
          {card.module.replace("-", " ")}
          {card.status === "completed" && " ✓"}
        </span>
        <span className="text-[0.65rem] text-muted-foreground">{timeAgo()}</span>
      </div>

      <div className="mb-2 text-sm font-semibold">{card.title}</div>

      <div className="grid grid-cols-2 gap-1 text-[0.8rem]">
        {card.fields.map((field) => (
          <div key={field.label} className="text-muted-foreground">
            {field.label}:{" "}
            <strong
              className={cn(
                field.highlight === "success" && "text-emerald-500",
                field.highlight === "warning" && "text-amber-500",
                field.highlight === "danger" && "text-red-500",
                !field.highlight && "text-foreground"
              )}
            >
              {field.value}
            </strong>
          </div>
        ))}
      </div>

      <div className="mt-2 text-right text-[0.7rem] text-muted-foreground/50">
        Click to open in {card.module.replace("-", " ")} →
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/chat/action-card.tsx
git commit -m "feat: add ActionCard component with module colors and navigation"
```

---

## Task 3: Action Cards Rail

**Files:**
- Create: `apps/web/src/components/chat/action-cards-rail.tsx`

- [ ] **Step 1: Create ActionCardsRail component**

Create `apps/web/src/components/chat/action-cards-rail.tsx`:

```tsx
"use client"

import { AnimatePresence } from "framer-motion"
import { useNotificationStore } from "@/stores/notification-store"
import { ActionCard } from "./action-card"
import { ScrollArea } from "@/components/ui/scroll-area"

export function ActionCardsRail() {
  const { actionCards, dismissActionCard } = useNotificationStore()

  if (actionCards.length === 0) return null

  return (
    <div className="w-[280px] shrink-0 border-l bg-background/50">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Actions
        </span>
        <span className="text-xs text-muted-foreground">
          {actionCards.length}
        </span>
      </div>
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-2 p-2">
          <AnimatePresence mode="popLayout">
            {actionCards.map((card) => (
              <ActionCard
                key={card.id}
                card={card}
                onDismiss={dismissActionCard}
              />
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/chat/action-cards-rail.tsx
git commit -m "feat: add ActionCardsRail container with animated list"
```

---

## Task 4: Integrate Action Cards into Chat Layout

**Files:**
- Modify: `apps/web/src/components/chat/chat-view.tsx`
- Modify: `apps/web/src/components/workspace/chat-dock.tsx`
- Modify: `apps/web/src/hooks/use-socket.ts`

- [ ] **Step 1: Add action_card event listener to use-socket.ts**

In `apps/web/src/hooks/use-socket.ts`, add import and listener for action card events. After the existing `workspace_update` listener block, add:

```typescript
// Add import at top
import { useNotificationStore } from "@/stores/notification-store"

// Inside useEffect, after workspace_update listener:
socket.on("action_card", (data: any) => {
  const { addActionCard } = useNotificationStore.getState()
  addActionCard({
    id: data.id || crypto.randomUUID(),
    module: data.module,
    action: data.action,
    title: data.title,
    fields: data.fields || [],
    timestamp: data.timestamp || new Date().toISOString(),
    itemId: data.item_id,
    status: data.status || "completed",
  })
})
```

Add cleanup in the return function:
```typescript
socket.off("action_card")
```

- [ ] **Step 2: Integrate rail into ChatView**

In `apps/web/src/components/chat/chat-view.tsx`, add the action cards rail alongside the chat.

Add import:
```typescript
import { ActionCardsRail } from "./action-cards-rail"
import { useNotificationStore } from "@/stores/notification-store"
```

The ChatView has a `compact` prop (used when rendered inside the ChatDock). The rail should ONLY appear when `compact` is false (i.e., the full home page chat). In the ChatDock, the rail would be too cramped.

Wrap the existing return JSX in a flex container:
```tsx
// At the top of the component:
const { actionCards } = useNotificationStore()
const showRail = !compact && actionCards.length > 0

// Wrap the return:
return (
  <div className="flex flex-1 overflow-hidden">
    <div className="flex flex-1 flex-col">
      {/* ...existing chat content (empty state or active state)... */}
    </div>
    {showRail && <ActionCardsRail />}
  </div>
)
```

The existing two return paths (empty state lines ~116-161, active state lines ~164-198) both go inside the inner `flex-1 flex-col` div. The outer flex container adds the rail when cards exist.

- [ ] **Step 3: Adjust ChatDock for action cards**

In `apps/web/src/components/workspace/chat-dock.tsx`, the dock renders `ChatView compact={true}`. Since the rail only appears when `compact` is false, the dock width stays at `w-[400px]` — no change needed.

However, add a Sonner toast notification when action cards arrive in dock mode, so the user knows something happened even without the rail visible:

```typescript
import { toast } from "sonner"
import { useNotificationStore } from "@/stores/notification-store"

// Inside ChatDock, add useEffect to watch for new cards:
const { actionCards } = useNotificationStore()
const prevCountRef = useRef(actionCards.length)

useEffect(() => {
  if (actionCards.length > prevCountRef.current && isChatOpen) {
    const newest = actionCards[0]
    toast.success(`${newest.module}: ${newest.title}`, {
      description: "Click to view details",
      action: { label: "Open", onClick: () => router.push(`/workspace/${newest.module}`) },
    })
  }
  prevCountRef.current = actionCards.length
}, [actionCards.length])
```

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-socket.ts apps/web/src/components/chat/chat-view.tsx apps/web/src/components/workspace/chat-dock.tsx
git commit -m "feat: integrate action cards rail into chat layout with Socket.IO listener"
```

---

## Task 5: Voice-to-Text Input

**Files:**
- Create: `apps/web/src/components/chat/voice-input.tsx`
- Modify: `apps/web/src/components/chat/chat-composer.tsx`

- [ ] **Step 1: Create VoiceInput component**

Create `apps/web/src/components/chat/voice-input.tsx`:

```tsx
"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Mic, MicOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface VoiceInputProps {
  onTranscript: (text: string) => void
  onInterim?: (text: string) => void
  disabled?: boolean
}

export function VoiceInput({ onTranscript, onInterim, disabled }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)
  }, [])

  const stop = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const start = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ""
      let final = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      if (interim) onInterim?.(interim)

      if (final) {
        onTranscript(final)
        // Reset silence timer on each final result
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = setTimeout(stop, 2000)
      }
    }

    recognition.onerror = () => stop()
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)

    // Auto-stop after 2s of silence
    silenceTimerRef.current = setTimeout(stop, 5000)
  }, [onTranscript, onInterim, stop])

  const toggle = useCallback(() => {
    if (isListening) stop()
    else start()
  }, [isListening, start, stop])

  useEffect(() => () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    recognitionRef.current?.stop()
  }, [])

  if (!isSupported) return null

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full transition-all",
        isListening
          ? "bg-red-500/15 text-red-500 animate-pulse"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
      title={isListening ? "Stop recording" : "Voice input"}
    >
      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  )
}
```

- [ ] **Step 2: Add SpeechRecognition type declaration**

Create `apps/web/src/types/speech.d.ts`:

```typescript
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface Window {
  SpeechRecognition: new () => SpeechRecognition
  webkitSpeechRecognition: new () => SpeechRecognition
}
```

- [ ] **Step 3: Integrate VoiceInput into ChatComposer**

In `apps/web/src/components/chat/chat-composer.tsx`, add the voice input button next to the send button:

Add import:
```typescript
import { VoiceInput } from "./voice-input"
```

Add the `VoiceInput` component in the composer controls area, between the attach button and the textarea. Pass `onTranscript` to append text to the input value and `onInterim` to show interim text as a preview.

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/voice-input.tsx apps/web/src/types/speech.d.ts apps/web/src/components/chat/chat-composer.tsx
git commit -m "feat: add voice-to-text input with Web Speech API"
```

---

## Task 6: Enhanced Agent Status Chain

**Files:**
- Create: `apps/web/src/components/chat/chat-status-chain.tsx`
- Modify: `apps/web/src/lib/chat-helpers.ts`
- Modify: `apps/web/src/components/chat/chat-composer.tsx`

- [ ] **Step 1: Extend StatusPayload in chat-helpers.ts**

In `apps/web/src/lib/chat-helpers.ts`, update the `StatusPayload` interface and add a chain type:

```typescript
export interface StatusStep {
  agent: string
  action: string
  target?: string
  timestamp: number
}

export interface StatusPayload {
  state: "thinking" | "delegating" | "tool_calling" | "completed" | "error"
  text: string
  role: string
  chain?: StatusStep[]
}
```

Update `deriveConversationStatus` to populate the chain from structured status events when available.

- [ ] **Step 2: Create ChatStatusChain component**

Create `apps/web/src/components/chat/chat-status-chain.tsx`:

```tsx
"use client"

import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import type { StatusPayload } from "@/lib/chat-helpers"

const STATE_STYLES = {
  thinking: "border-amber-500/20 bg-amber-500/5 text-amber-500",
  delegating: "border-blue-500/20 bg-blue-500/5 text-blue-500",
  tool_calling: "border-purple-500/20 bg-purple-500/5 text-purple-500",
  completed: "border-emerald-500/20 bg-emerald-500/5 text-emerald-500",
  error: "border-red-500/20 bg-red-500/5 text-red-500",
}

const DOT_COLORS = {
  thinking: "bg-amber-500",
  delegating: "bg-blue-500",
  tool_calling: "bg-purple-500",
  completed: "bg-emerald-500",
  error: "bg-red-500",
}

interface ChatStatusChainProps {
  status: StatusPayload | null
}

export function ChatStatusChain({ status }: ChatStatusChainProps) {
  if (!status) return null

  // Show completion summary briefly before fading
  if (status.state === "completed") {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 3, duration: 0.5 }}
        className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs", STATE_STYLES.completed)}
      >
        <span className={cn("inline-flex h-2 w-2 rounded-full", DOT_COLORS.completed)} />
        <span className="opacity-80">{status.text}</span>
      </motion.div>
    )
  }

  const style = STATE_STYLES[status.state] ?? STATE_STYLES.thinking
  const dotColor = DOT_COLORS[status.state] ?? DOT_COLORS.thinking
  const isActive = status.state !== "completed" && status.state !== "error"

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status.text}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className={cn(
          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
          style
        )}
      >
        <span className="relative flex h-2 w-2">
          {isActive && (
            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", dotColor)} />
          )}
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotColor)} />
        </span>

        <span className="font-medium">{status.role}</span>

        {status.chain && status.chain.length > 1 && (
          <span className="flex items-center gap-1 text-[0.7rem] opacity-70">
            {status.chain.map((step, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span>→</span>}
                <span>{step.agent}</span>
              </span>
            ))}
          </span>
        )}

        <span className="opacity-80">{status.text}</span>
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 3: Replace ChatStatusPill usage in ChatComposer**

In `apps/web/src/components/chat/chat-composer.tsx`, replace the import and usage of `ChatStatusPill` with `ChatStatusChain`:

```typescript
import { ChatStatusChain } from "./chat-status-chain"
```

Replace the `<ChatStatusPill>` usage with `<ChatStatusChain status={streamingStatus} />`.

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/chat-status-chain.tsx apps/web/src/lib/chat-helpers.ts apps/web/src/components/chat/chat-composer.tsx
git commit -m "feat: enhanced status chain with color states and delegation trail"
```

---

## Task 7: Chat Message Polish

**Files:**
- Create: `apps/web/src/components/chat/message-copy-button.tsx`
- Modify: `apps/web/src/components/chat/chat-message.tsx`

- [ ] **Step 1: Create copy button component**

Create `apps/web/src/components/chat/message-copy-button.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

export function MessageCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
      title="Copy message"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}
```

- [ ] **Step 2: Create InlineActionCard for embedding in messages**

Create `apps/web/src/components/chat/inline-action-card.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { ActionCard } from "@carabiner-os/api-types"

const MODULE_COLORS: Record<string, string> = {
  inventory: "border-amber-500/20 bg-amber-500/5",
  orders: "border-blue-500/20 bg-blue-500/5",
  prep: "border-emerald-500/20 bg-emerald-500/5",
  "food-cost": "border-red-500/20 bg-red-500/5",
  menu: "border-purple-500/20 bg-purple-500/5",
  marketing: "border-pink-500/20 bg-pink-500/5",
  invoices: "border-cyan-500/20 bg-cyan-500/5",
  recipes: "border-orange-500/20 bg-orange-500/5",
  reporting: "border-indigo-500/20 bg-indigo-500/5",
}

export function InlineActionCard({ card }: { card: ActionCard }) {
  const router = useRouter()
  const colors = MODULE_COLORS[card.module] ?? MODULE_COLORS.inventory

  return (
    <div
      className={cn("my-2 cursor-pointer rounded-lg border p-2.5 transition-colors hover:brightness-110", colors)}
      onClick={() => router.push(`/workspace/${card.module}${card.itemId ? `?item=${card.itemId}` : ""}`)}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium uppercase tracking-wide opacity-60">{card.module.replace("-", " ")} ✓</span>
        <span className="opacity-40">→ open</span>
      </div>
      <div className="mt-1 text-sm font-semibold">{card.title}</div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {card.fields.slice(0, 4).map((f) => (
          <span key={f.label}>{f.label}: <strong className="text-foreground">{f.value}</strong></span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Enhance ChatMessageBubble**

In `apps/web/src/components/chat/chat-message.tsx`, update the component. The current component is ~43 lines. Replace with:

```tsx
"use client"

import ReactMarkdown from "react-markdown"
import { MessageCopyButton } from "./message-copy-button"
import { InlineActionCard } from "./inline-action-card"
import type { ActionCard } from "@carabiner-os/api-types"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
  timestamp?: string
  actionCard?: ActionCard
}

export function ChatMessageBubble({ role, content, isStreaming, timestamp, actionCard }: ChatMessageProps) {
  const timeLabel = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null

  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">
          <p className="text-sm">{content}</p>
          {timeLabel && <p className="mt-1 text-right text-[0.6rem] opacity-50">{timeLabel}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="group flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-card text-xs font-bold text-primary">
        C
      </div>
      <div className="max-w-[85%] space-y-1">
        <div className="rounded-2xl rounded-bl-sm border border-l-2 border-l-primary/30 bg-card px-4 py-3">
          <div className="prose prose-sm prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-table:text-sm prose-th:border prose-th:px-2 prose-th:py-1 prose-td:border prose-td:px-2 prose-td:py-1">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
          {isStreaming && (
            <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary/60" />
          )}
        </div>
        {actionCard && <InlineActionCard card={actionCard} />}
        <div className="flex items-center gap-2 px-1">
          {timeLabel && <span className="text-[0.6rem] text-muted-foreground/50">{timeLabel}</span>}
          <div className="opacity-0 transition-opacity group-hover:opacity-100">
            <MessageCopyButton text={content} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

Key changes from current:
- Added `timestamp` prop with time display
- Added `actionCard` prop for inline cards below the message
- Added `MessageCopyButton` (visible on hover via group-hover)
- Added left border accent `border-l-2 border-l-primary/30`
- Added CarabinerOS "C" avatar icon
- Added proper table styles in prose classes

- [ ] **Step 3: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/chat/message-copy-button.tsx apps/web/src/components/chat/chat-message.tsx
git commit -m "feat: polish chat messages with timestamps, copy button, and brand treatment"
```

---

## Task 8: Chat History Persistence

**Files:**
- Modify: `apps/web/src/components/app-sidebar.tsx` (ChatHistory section)
- Modify: `apps/web/src/stores/workspace-store.ts`
- Modify: `apps/web/src/components/chat/chat-view.tsx`

- [ ] **Step 1: Fix conversation restore on page load**

In `apps/web/src/stores/workspace-store.ts`, add persistence of `activeContextId` to localStorage:

```typescript
// In the store, after setActiveContextId:
setActiveContextId: (id) => {
  if (id) localStorage.setItem("carabiner_active_context", id)
  else localStorage.removeItem("carabiner_active_context")
  set({ activeContextId: id })
},
```

- [ ] **Step 2: Auto-restore conversation on mount**

In `apps/web/src/components/chat/chat-view.tsx`, add a `useEffect` that:
1. On mount, reads `carabiner_active_context` from localStorage
2. If found and no active context, fetches messages via `apiGet` and calls `loadConversation`
3. This ensures chat persists across page refreshes

- [ ] **Step 3: Auto-title conversations**

In `apps/web/src/components/app-sidebar.tsx`, update the conversation list to show the first user message as the title (truncated to 40 chars) instead of raw context IDs.

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/stores/workspace-store.ts apps/web/src/components/chat/chat-view.tsx apps/web/src/components/app-sidebar.tsx
git commit -m "feat: persist chat history across page refreshes with auto-restore"
```

---

## Task 9: Notification Bell & Panel

**Files:**
- Create: `apps/web/src/components/notifications/notification-bell.tsx`
- Create: `apps/web/src/components/notifications/notification-panel.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Create NotificationBell component**

Create `apps/web/src/components/notifications/notification-bell.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Bell } from "lucide-react"
import { useNotificationStore } from "@/stores/notification-store"
import { NotificationPanel } from "./notification-panel"

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { unreadCount } = useNotificationStore()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </div>
  )
}
```

- [ ] **Step 2: Create NotificationPanel component**

Create `apps/web/src/components/notifications/notification-panel.tsx`:

```tsx
"use client"

import { useEffect, useRef } from "react"
import { useNotificationStore } from "@/stores/notification-store"
import { ScrollArea } from "@/components/ui/scroll-area"

interface NotificationPanelProps {
  onClose: () => void
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, markRead, markAllRead } = useNotificationStore()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-10 z-50 w-80 rounded-xl border bg-popover p-0 shadow-xl"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Notifications</span>
        {notifications.length > 0 && (
          <button onClick={markAllRead} className="text-xs text-primary hover:underline">
            Mark all read
          </button>
        )}
      </div>
      <ScrollArea className="max-h-80">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          <div className="divide-y">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`cursor-pointer px-3 py-2.5 transition-colors hover:bg-muted/50 ${
                  !n.read ? "bg-primary/5" : ""
                }`}
                onClick={() => markRead(n.id)}
              >
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-xs text-muted-foreground">{n.message}</div>
                <div className="mt-1 text-[0.65rem] text-muted-foreground/60">
                  {new Date(n.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
```

- [ ] **Step 3: Add NotificationBell to home page header**

In `apps/web/src/app/page.tsx`, import and add `NotificationBell` next to the theme toggle in the header.

- [ ] **Step 4: Add notification listener to use-socket.ts**

In `apps/web/src/hooks/use-socket.ts`, add a listener for `notification` events:

```typescript
socket.on("notification", (data: any) => {
  const { addNotification } = useNotificationStore.getState()
  addNotification({
    id: data.id || crypto.randomUUID(),
    type: data.type || "task_completed",
    title: data.title,
    message: data.message,
    module: data.module,
    itemId: data.item_id,
    timestamp: data.timestamp || new Date().toISOString(),
    read: false,
  })
})
```

- [ ] **Step 5: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/notifications/ apps/web/src/app/page.tsx apps/web/src/hooks/use-socket.ts
git commit -m "feat: notification bell with unread count and notification panel"
```

---

## Task 10: Mobile-Responsive Chat

**Files:**
- Modify: `apps/web/src/components/chat/chat-view.tsx`
- Modify: `apps/web/src/components/chat/chat-composer.tsx`
- Modify: `apps/web/src/components/chat/action-cards-rail.tsx`
- Modify: `apps/web/src/components/workspace/chat-dock.tsx`

- [ ] **Step 1: Make chat full-screen on mobile**

In `apps/web/src/components/chat/chat-view.tsx`, add responsive classes:
- On mobile (`md:` breakpoint), chat takes full viewport height
- Action cards rail hides on mobile (shown below chat as a horizontal scroll instead)

- [ ] **Step 2: Adjust composer for mobile**

In `apps/web/src/components/chat/chat-composer.tsx`:
- Voice input button gets larger touch target on mobile (`h-10 w-10 md:h-8 md:w-8`)
- Suggested prompts scroll horizontally on mobile

- [ ] **Step 3: Stack action cards on mobile**

In `apps/web/src/components/chat/action-cards-rail.tsx`:
- On mobile, render as a horizontal scrollable strip below the chat instead of a side rail
- Use `flex-row overflow-x-auto md:flex-col md:overflow-y-auto` pattern

- [ ] **Step 4: ChatDock mobile behavior**

In `apps/web/src/components/workspace/chat-dock.tsx`:
- On mobile, chat dock becomes a full-screen overlay (Sheet component from shadcn)
- Use the existing Sheet component that's already installed

- [ ] **Step 5: Verify build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/chat/ apps/web/src/components/workspace/chat-dock.tsx
git commit -m "feat: mobile-responsive chat with full-screen mode and touch targets"
```

---

## Task 11: Final Integration & Polish

**Files:**
- Modify: Various files for final integration

- [ ] **Step 1: Clear action cards on new conversation**

In `apps/web/src/components/app-sidebar.tsx`, in `handleNewChat()`, call `useNotificationStore.getState().clearActionCards()` when starting a new conversation.

- [ ] **Step 2: Wire up conversation clearing to notification store**

In `apps/web/src/stores/workspace-store.ts`, in `clearMessages()`, also trigger `useNotificationStore.getState().clearActionCards()`.

- [ ] **Step 3: Verify full build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds with zero errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: final Phase 1 integration — action cards clear on new chat"
```
