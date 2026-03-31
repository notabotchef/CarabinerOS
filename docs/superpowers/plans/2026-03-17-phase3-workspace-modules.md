# Phase 3: Workspace Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all 10 workspace module pages with reusable table/board/detail-panel components, wired to the live API with location filtering and a docked chat panel.

**Architecture:** Shared workspace primitives (WorkspaceTable, WorkspaceBoard, WorkspaceDetailPanel, WorkspaceKPICards, WorkspaceHeader, ChatDock) live in `src/components/workspace/`. Each module page is a thin composition that imports a React Query hook, computes KPIs, defines columns, and renders the shared components. A `(workspace)` route group provides the shared layout with ChatDock.

**Tech Stack:** Next.js 16 App Router, TanStack Table, shadcn/ui (Table, Sheet, ScrollArea, Skeleton), React Query, Zustand, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-17-phase3-workspace-modules-design.md`

---

## File Structure

### New Files
```
src/app/(workspace)/layout.tsx                    — shared workspace layout with ChatDock
src/app/(workspace)/inbox/page.tsx                — inbox module page
src/app/(workspace)/orders/page.tsx               — orders module page
src/app/(workspace)/inventory/page.tsx            — inventory module page
src/app/(workspace)/prep/page.tsx                 — prep module page (board)
src/app/(workspace)/food-cost/page.tsx            — food cost module page
src/app/(workspace)/menu/page.tsx                 — menu module page
src/app/(workspace)/marketing/page.tsx            — marketing module page
src/app/(workspace)/locations/page.tsx            — locations page (read-only)
src/app/(workspace)/admin/page.tsx                — admin placeholder
src/components/workspace/workspace-header.tsx     — module title + location breadcrumb
src/components/workspace/workspace-kpi-cards.tsx  — row of computed KPI cards
src/components/workspace/workspace-table.tsx      — TanStack Table wrapper (generic)
src/components/workspace/workspace-board.tsx      — kanban board (prep only)
src/components/workspace/workspace-detail-panel.tsx — Sheet with fields + narrative + CTA
src/components/workspace/chat-dock.tsx            — docked chat sidebar placeholder
src/components/workspace/columns/inbox-columns.tsx
src/components/workspace/columns/orders-columns.tsx
src/components/workspace/columns/inventory-columns.tsx
src/components/workspace/columns/food-cost-columns.tsx
src/components/workspace/columns/menu-columns.tsx
src/components/workspace/columns/marketing-columns.tsx
```

### Modified Files
```
src/lib/api.ts                    — add InventoryItem, PrepTask, FoodCostItem, MenuItem, Campaign types
src/hooks/use-api.ts              — import types from lib/api.ts instead of inline definitions
src/stores/workspace-store.ts     — add chatPrompt/setChatPrompt, remove selectedItemId/setSelectedItem
```

---

## Task 1: Install shadcn components + add types to api.ts

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/hooks/use-api.ts`
- Modify: `src/stores/workspace-store.ts`

- [ ] **Step 1: Install shadcn table and scroll-area**

```bash
cd apps/web && npx shadcn@latest add table scroll-area -y
```

- [ ] **Step 2: Add missing types to `src/lib/api.ts`**

Add these exports after the existing `Order` interface:

```typescript
export interface InventoryItem {
  id: string;
  location_id: string;
  item_name: string;
  on_hand: string;
  par: string;
  variance: string;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

export interface PrepTask {
  id: string;
  location_id: string;
  service_lane: string;
  task: string;
  station: string;
  readiness: string;
  shortage: string | null;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

export interface FoodCostItem {
  id: string;
  location_id: string;
  menu_item_name: string;
  pressure: string;
  current_cost_pct: string;
  action: string;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

export interface MenuItem {
  id: string;
  location_id: string;
  item_name: string;
  category: string;
  performance: string;
  margin_pct: string;
  recommendation: string;
  recipe: Record<string, unknown> | null;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}

export interface Campaign {
  id: string;
  location_id: string;
  campaign_name: string;
  channel: string;
  stage: string;
  deliverable: string;
  summary: string | null;
  detail_points: string[] | null;
  prompt: string | null;
}
```

- [ ] **Step 3: Update `src/hooks/use-api.ts` to import from api.ts**

Replace inline interface definitions with imports:

```typescript
import type { InventoryItem, PrepTask, FoodCostItem, MenuItem, Campaign } from "@/lib/api";
```

Remove the 5 inline interface blocks.

- [ ] **Step 4: Update `src/stores/workspace-store.ts`**

Replace full file contents:

```typescript
import { create } from "zustand";

interface WorkspaceState {
  activeLocationId: string | null;
  activeModule: string;
  isChatOpen: boolean;
  chatPrompt: string | null;

  setActiveLocation: (id: string | null) => void;
  setActiveModule: (module: string) => void;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;
  setChatPrompt: (prompt: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeLocationId: null,
  activeModule: "home",
  isChatOpen: false,
  chatPrompt: null,

  setActiveLocation: (id) => set({ activeLocationId: id }),
  setActiveModule: (module) => set({ activeModule: module }),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setChatPrompt: (prompt) => set({ chatPrompt: prompt }),
}));
```

- [ ] **Step 5: Verify build passes**

```bash
cd apps/web && pnpm build
```
Expected: build succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/hooks/use-api.ts apps/web/src/stores/workspace-store.ts apps/web/src/components/ui/table.tsx apps/web/src/components/ui/scroll-area.tsx apps/web/pnpm-lock.yaml
git commit -m "feat: add workspace types, shadcn table/scroll-area, update store"
```

---

## Task 2: WorkspaceHeader + WorkspaceKPICards

**Files:**
- Create: `src/components/workspace/workspace-header.tsx`
- Create: `src/components/workspace/workspace-kpi-cards.tsx`

- [ ] **Step 1: Create WorkspaceHeader**

```typescript
// src/components/workspace/workspace-header.tsx
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

interface WorkspaceHeaderProps {
  title: string;
  subtitle?: string;
}

export function WorkspaceHeader({ title, subtitle }: WorkspaceHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div>
        <h1 className="text-sm font-semibold">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create WorkspaceKPICards**

```typescript
// src/components/workspace/workspace-kpi-cards.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KPICard {
  label: string;
  value: string | number;
  delta?: string;
}

interface WorkspaceKPICardsProps {
  cards: KPICard[];
}

export function WorkspaceKPICards({ cards }: WorkspaceKPICardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            {card.delta && (
              <p className="text-xs text-muted-foreground">{card.delta}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/workspace/workspace-header.tsx apps/web/src/components/workspace/workspace-kpi-cards.tsx
git commit -m "feat: add WorkspaceHeader and WorkspaceKPICards components"
```

---

## Task 3: WorkspaceTable (generic TanStack Table wrapper)

**Files:**
- Create: `src/components/workspace/workspace-table.tsx`

- [ ] **Step 1: Install TanStack Table**

```bash
cd apps/web && pnpm add @tanstack/react-table
```

- [ ] **Step 2: Create WorkspaceTable**

```typescript
// src/components/workspace/workspace-table.tsx
"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkspaceTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  isLoading: boolean;
  onRowClick?: (item: T) => void;
}

export function WorkspaceTable<T>({
  columns,
  data,
  isLoading,
  onRowClick,
}: WorkspaceTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-24" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3].map((row) => (
              <TableRow key={row}>
                {columns.map((_, i) => (
                  <TableCell key={i}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border py-12 text-center">
        <p className="text-sm text-muted-foreground">No items found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Try selecting a different location or ask CarabinerOS to generate data.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={onRowClick ? "cursor-pointer" : ""}
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/workspace/workspace-table.tsx apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "feat: add WorkspaceTable with TanStack Table, skeleton loading, keyboard a11y"
```

---

## Task 4: WorkspaceDetailPanel

**Files:**
- Create: `src/components/workspace/workspace-detail-panel.tsx`

- [ ] **Step 1: Create WorkspaceDetailPanel**

```typescript
// src/components/workspace/workspace-detail-panel.tsx
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface DetailField {
  label: string;
  value: string;
}

interface WorkspaceDetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  statusBadge?: { label: string; color?: string };
  metaLine?: string;
  fields: DetailField[];
  summary: string | null;
  detailPoints: string[] | null;
  prompt: string | null;
}

export function WorkspaceDetailPanel({
  open,
  onClose,
  title,
  statusBadge,
  metaLine,
  fields,
  summary,
  detailPoints,
  prompt,
}: WorkspaceDetailPanelProps) {
  const { setChatOpen, setChatPrompt } = useWorkspaceStore();

  function handleAskCarabiner() {
    if (prompt) {
      setChatPrompt(prompt);
      setChatOpen(true);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {statusBadge && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{statusBadge.label}</Badge>
              {metaLine && (
                <span className="text-xs text-muted-foreground">{metaLine}</span>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Data fields grid */}
          {fields.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {fields.map((f) => (
                <div
                  key={f.label}
                  className="rounded-md border bg-muted/50 px-3 py-2"
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {f.label}
                  </div>
                  <div className="text-sm font-medium mt-0.5">{f.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Summary
              </div>
              <p className="text-sm leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Detail points */}
          {detailPoints && detailPoints.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Details
              </div>
              <ul className="list-disc pl-4 space-y-1">
                {detailPoints.map((point, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ask CarabinerOS */}
          {prompt && (
            <>
              <Separator />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Ask CarabinerOS
                </div>
                <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground mb-2">
                  {prompt}
                </div>
                <Button
                  onClick={handleAskCarabiner}
                  className="w-full"
                  size="sm"
                >
                  Ask CarabinerOS &rarr;
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/workspace/workspace-detail-panel.tsx
git commit -m "feat: add WorkspaceDetailPanel with data fields, narrative, Ask CarabinerOS CTA"
```

---

## Task 5: ChatDock

**Files:**
- Create: `src/components/workspace/chat-dock.tsx`

- [ ] **Step 1: Create ChatDock**

```typescript
// src/components/workspace/chat-dock.tsx
"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function ChatDock() {
  const { isChatOpen, chatPrompt, setChatOpen, setChatPrompt } =
    useWorkspaceStore();

  if (!isChatOpen) return null;

  return (
    <div className="w-[380px] shrink-0 border-l flex flex-col bg-background">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <span className="text-sm font-semibold">CarabinerOS</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setChatOpen(false);
            setChatPrompt(null);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground text-center">
          Chat responses will appear here.
          <br />
          <span className="text-xs">Streaming comes in Phase 4.</span>
        </p>
      </div>

      <div className="border-t p-4 space-y-2">
        <textarea
          className="w-full rounded-md border bg-muted/50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          rows={3}
          value={chatPrompt ?? ""}
          onChange={(e) => setChatPrompt(e.target.value)}
          placeholder="Ask CarabinerOS anything..."
        />
        <Button className="w-full" size="sm" disabled>
          Send
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/workspace/chat-dock.tsx
git commit -m "feat: add ChatDock placeholder for docked chat panel"
```

---

## Task 6: Workspace layout + WorkspaceBoard

**Files:**
- Create: `src/app/(workspace)/layout.tsx`
- Create: `src/components/workspace/workspace-board.tsx`

- [ ] **Step 1: Create workspace layout**

```typescript
// src/app/(workspace)/layout.tsx
import { ChatDock } from "@/components/workspace/chat-dock";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-auto">{children}</div>
      <ChatDock />
    </div>
  );
}
```

- [ ] **Step 2: Create WorkspaceBoard**

```typescript
// src/components/workspace/workspace-board.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { PrepTask } from "@/lib/api";

interface WorkspaceBoardProps {
  items: PrepTask[];
  isLoading: boolean;
  onCardClick?: (item: PrepTask) => void;
}

function readinessBadgeVariant(readiness: string) {
  switch (readiness.toLowerCase()) {
    case "ready":
      return "default" as const;
    case "at risk":
      return "secondary" as const;
    case "blocked":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function WorkspaceBoard({
  items,
  isLoading,
  onCardClick,
}: WorkspaceBoardProps) {
  const lanes = items.reduce<Record<string, PrepTask[]>>((acc, item) => {
    const lane = item.service_lane;
    if (!acc[lane]) acc[lane] = [];
    acc[lane].push(item);
    return acc;
  }, {});

  const laneNames = Object.keys(lanes).length > 0
    ? Object.keys(lanes)
    : ["Brunch", "Dinner", "Happy hour"];

  if (isLoading) {
    return (
      <div className="flex gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 space-y-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto">
      {laneNames.map((lane) => {
        const laneItems = lanes[lane] ?? [];
        return (
          <div key={lane} className="min-w-[280px] flex-1">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold">{lane}</h3>
              <Badge variant="outline" className="text-xs">
                {laneItems.length}
              </Badge>
            </div>
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-2">
                {laneItems.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No tasks
                  </p>
                )}
                {laneItems.map((item) => (
                  <Card
                    key={item.id}
                    className={onCardClick ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}
                    onClick={() => onCardClick?.(item)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && onCardClick) {
                        e.preventDefault();
                        onCardClick(item);
                      }
                    }}
                    tabIndex={onCardClick ? 0 : undefined}
                  >
                    <CardContent className="p-3 space-y-1">
                      <Badge variant={readinessBadgeVariant(item.readiness)}>
                        {item.readiness}
                      </Badge>
                      <p className="text-sm font-medium">{item.task}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.station}
                      </p>
                      {item.shortage && item.shortage !== "No shortage" && (
                        <p className="text-xs text-destructive">
                          {item.shortage}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(workspace\)/layout.tsx apps/web/src/components/workspace/workspace-board.tsx
git commit -m "feat: add workspace layout with ChatDock and WorkspaceBoard kanban component"
```

---

## Task 7: Column definitions for all table modules

**Files:**
- Create: `src/components/workspace/columns/inbox-columns.tsx`
- Create: `src/components/workspace/columns/orders-columns.tsx`
- Create: `src/components/workspace/columns/inventory-columns.tsx`
- Create: `src/components/workspace/columns/food-cost-columns.tsx`
- Create: `src/components/workspace/columns/menu-columns.tsx`
- Create: `src/components/workspace/columns/marketing-columns.tsx`

- [ ] **Step 1: Create all column definition files**

Each file exports a `columns` array of `ColumnDef` for its module. Example pattern (repeat for each):

```typescript
// src/components/workspace/columns/inbox-columns.tsx
"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { InboxItem } from "@/lib/api";

function priorityVariant(p: string) {
  return p.toLowerCase() === "high" ? "destructive" as const : "secondary" as const;
}

export const inboxColumns: ColumnDef<InboxItem>[] = [
  { accessorKey: "title", header: "Title" },
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ row }) => (
      <Badge variant={priorityVariant(row.getValue("priority"))}>{row.getValue("priority")}</Badge>
    ),
  },
  { accessorKey: "owner", header: "Owner" },
  { accessorKey: "status", header: "Status" },
  {
    accessorKey: "module",
    header: "Module",
    cell: ({ row }) => <Badge variant="outline">{row.getValue("module")}</Badge>,
  },
];
```

```typescript
// src/components/workspace/columns/orders-columns.tsx
"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/lib/api";

function statusVariant(s: string) {
  if (s.toLowerCase().includes("ready")) return "default" as const;
  if (s.toLowerCase().includes("draft")) return "secondary" as const;
  return "outline" as const;
}

export const ordersColumns: ColumnDef<Order>[] = [
  { accessorKey: "vendor", header: "Vendor", cell: ({ row }) => <span className="font-medium">{row.getValue("vendor")}</span> },
  { accessorKey: "channel", header: "Channel" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={statusVariant(row.getValue("status"))}>{row.getValue("status")}</Badge> },
  { accessorKey: "total", header: "Total" },
  { accessorKey: "eta", header: "ETA" },
  { accessorKey: "summary", header: "Summary", cell: ({ row }) => <span className="text-muted-foreground text-xs line-clamp-1">{row.getValue("summary")}</span> },
];
```

```typescript
// src/components/workspace/columns/inventory-columns.tsx
"use client";

import { type ColumnDef } from "@tanstack/react-table";
import type { InventoryItem } from "@/lib/api";

export const inventoryColumns: ColumnDef<InventoryItem>[] = [
  { accessorKey: "item_name", header: "Item", cell: ({ row }) => <span className="font-medium">{row.getValue("item_name")}</span> },
  { accessorKey: "on_hand", header: "On Hand" },
  { accessorKey: "par", header: "Par" },
  { accessorKey: "variance", header: "Variance", cell: ({ row }) => { const v = row.getValue("variance") as string; const isNeg = v.startsWith("-"); return <span className={isNeg ? "text-destructive font-medium" : "text-emerald-600 font-medium"}>{v}</span>; } },
  { accessorKey: "summary", header: "Summary", cell: ({ row }) => <span className="text-muted-foreground text-xs line-clamp-1">{row.getValue("summary")}</span> },
];
```

```typescript
// src/components/workspace/columns/food-cost-columns.tsx
"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { FoodCostItem } from "@/lib/api";

export const foodCostColumns: ColumnDef<FoodCostItem>[] = [
  { accessorKey: "menu_item_name", header: "Menu Item", cell: ({ row }) => <span className="font-medium">{row.getValue("menu_item_name")}</span> },
  { accessorKey: "pressure", header: "Pressure", cell: ({ row }) => <span className="text-destructive font-medium">{row.getValue("pressure")}</span> },
  { accessorKey: "current_cost_pct", header: "Cost %" },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "summary", header: "Summary", cell: ({ row }) => <span className="text-muted-foreground text-xs line-clamp-1">{row.getValue("summary")}</span> },
];
```

```typescript
// src/components/workspace/columns/menu-columns.tsx
"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { MenuItem } from "@/lib/api";

function perfVariant(p: string) {
  switch (p.toLowerCase()) {
    case "star": return "default" as const;
    case "puzzle": return "secondary" as const;
    case "plowhorse": return "outline" as const;
    default: return "destructive" as const;
  }
}

export const menuColumns: ColumnDef<MenuItem>[] = [
  { accessorKey: "item_name", header: "Item", cell: ({ row }) => <span className="font-medium">{row.getValue("item_name")}</span> },
  { accessorKey: "category", header: "Category" },
  { accessorKey: "performance", header: "Performance", cell: ({ row }) => <Badge variant={perfVariant(row.getValue("performance"))}>{row.getValue("performance")}</Badge> },
  { accessorKey: "margin_pct", header: "Margin" },
  { accessorKey: "recommendation", header: "Recommendation" },
  { accessorKey: "summary", header: "Summary", cell: ({ row }) => <span className="text-muted-foreground text-xs line-clamp-1">{row.getValue("summary")}</span> },
];
```

```typescript
// src/components/workspace/columns/marketing-columns.tsx
"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { Campaign } from "@/lib/api";

function stageVariant(s: string) {
  switch (s.toLowerCase()) {
    case "ready for review": return "default" as const;
    case "drafting": return "secondary" as const;
    default: return "outline" as const;
  }
}

export const marketingColumns: ColumnDef<Campaign>[] = [
  { accessorKey: "campaign_name", header: "Campaign", cell: ({ row }) => <span className="font-medium">{row.getValue("campaign_name")}</span> },
  { accessorKey: "channel", header: "Channel" },
  { accessorKey: "stage", header: "Stage", cell: ({ row }) => <Badge variant={stageVariant(row.getValue("stage"))}>{row.getValue("stage")}</Badge> },
  { accessorKey: "deliverable", header: "Deliverable" },
  { accessorKey: "summary", header: "Summary", cell: ({ row }) => <span className="text-muted-foreground text-xs line-clamp-1">{row.getValue("summary")}</span> },
];
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/workspace/columns/
git commit -m "feat: add TanStack Table column definitions for all 6 table modules"
```

---

## Task 8: Module pages — Inbox, Orders, Inventory

**Files:**
- Create: `src/app/(workspace)/inbox/page.tsx`
- Create: `src/app/(workspace)/orders/page.tsx`
- Create: `src/app/(workspace)/inventory/page.tsx`

- [ ] **Step 1: Create Inbox page**

```typescript
// src/app/(workspace)/inbox/page.tsx
"use client";

import { useState } from "react";
import { useInbox } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import { inboxColumns } from "@/components/workspace/columns/inbox-columns";
import type { InboxItem } from "@/lib/api";

export default function InboxPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useInbox(locationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    { label: "Total", value: items.length },
    { label: "High priority", value: items.filter((i) => i.priority.toLowerCase() === "high").length },
    { label: "Needs review", value: items.filter((i) => i.status.toLowerCase().includes("review")).length },
  ];

  return (
    <>
      <WorkspaceHeader title="Inbox" subtitle="Operational exceptions needing attention" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={inboxColumns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: InboxItem) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.title ?? ""}
        statusBadge={selectedItem ? { label: selectedItem.priority } : undefined}
        metaLine={selectedItem ? `${selectedItem.status} · ${selectedItem.module}` : undefined}
        fields={selectedItem ? [
          { label: "Priority", value: selectedItem.priority },
          { label: "Owner", value: selectedItem.owner ?? "Unassigned" },
          { label: "Status", value: selectedItem.status },
          { label: "Module", value: selectedItem.module },
        ] : []}
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
      />
    </>
  );
}
```

- [ ] **Step 2: Create Orders page**

```typescript
// src/app/(workspace)/orders/page.tsx
"use client";

import { useState } from "react";
import { useOrders } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import { ordersColumns } from "@/components/workspace/columns/orders-columns";
import type { Order } from "@/lib/api";

export default function OrdersPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useOrders(locationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    { label: "Ready to send", value: items.filter((i) => i.status.toLowerCase().includes("ready")).length },
    { label: "Total value", value: items.reduce((sum, i) => { const n = parseFloat(i.total.replace(/[$,]/g, "")); return sum + (isNaN(n) ? 0 : n); }, 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) },
    { label: "Drafting", value: items.filter((i) => i.status.toLowerCase().includes("draft")).length },
  ];

  return (
    <>
      <WorkspaceHeader title="Orders" subtitle="Vendor orders and replenishment" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={ordersColumns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: Order) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.vendor ?? ""}
        statusBadge={selectedItem ? { label: selectedItem.status } : undefined}
        metaLine={selectedItem ? `${selectedItem.channel} · ${selectedItem.total}` : undefined}
        fields={selectedItem ? [
          { label: "Vendor", value: selectedItem.vendor },
          { label: "Channel", value: selectedItem.channel },
          { label: "Total", value: selectedItem.total },
          { label: "ETA", value: selectedItem.eta ?? "—" },
        ] : []}
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
      />
    </>
  );
}
```

- [ ] **Step 3: Create Inventory page**

```typescript
// src/app/(workspace)/inventory/page.tsx
"use client";

import { useState } from "react";
import { useInventory } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import { inventoryColumns } from "@/components/workspace/columns/inventory-columns";
import type { InventoryItem } from "@/lib/api";

export default function InventoryPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = useInventory(locationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    { label: "Below par", value: items.filter((i) => i.variance.startsWith("-")).length },
    { label: "Over par", value: items.filter((i) => i.variance.startsWith("+")).length },
    { label: "Total items", value: items.length },
  ];

  return (
    <>
      <WorkspaceHeader title="Inventory" subtitle="Par levels and variance tracking" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={inventoryColumns}
          data={items}
          isLoading={isLoading}
          onRowClick={(item: InventoryItem) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.item_name ?? ""}
        fields={selectedItem ? [
          { label: "Item", value: selectedItem.item_name },
          { label: "On Hand", value: selectedItem.on_hand },
          { label: "Par", value: selectedItem.par },
          { label: "Variance", value: selectedItem.variance },
        ] : []}
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
      />
    </>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(workspace\)/inbox/ apps/web/src/app/\(workspace\)/orders/ apps/web/src/app/\(workspace\)/inventory/
git commit -m "feat: add Inbox, Orders, Inventory workspace pages"
```

---

## Task 9: Module pages — Prep (board), Food Cost, Menu, Marketing

**Files:**
- Create: `src/app/(workspace)/prep/page.tsx`
- Create: `src/app/(workspace)/food-cost/page.tsx`
- Create: `src/app/(workspace)/menu/page.tsx`
- Create: `src/app/(workspace)/marketing/page.tsx`

- [ ] **Step 1: Create Prep page (board layout)**

```typescript
// src/app/(workspace)/prep/page.tsx
"use client";

import { useState } from "react";
import { usePrep } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceBoard } from "@/components/workspace/workspace-board";
import { WorkspaceDetailPanel } from "@/components/workspace/workspace-detail-panel";
import type { PrepTask } from "@/lib/api";

export default function PrepPage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data, isLoading } = usePrep(locationId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find((d) => d.id === selectedId);

  const items = data ?? [];
  const kpis = [
    { label: "Ready", value: items.filter((i) => i.readiness.toLowerCase() === "ready").length },
    { label: "At risk", value: items.filter((i) => i.readiness.toLowerCase() === "at risk").length },
    { label: "Blocked", value: items.filter((i) => i.readiness.toLowerCase() === "blocked").length },
  ];

  return (
    <>
      <WorkspaceHeader title="Prep" subtitle="Prep tasks by service lane" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceBoard
          items={items}
          isLoading={isLoading}
          onCardClick={(item: PrepTask) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.task ?? ""}
        statusBadge={selectedItem ? { label: selectedItem.readiness } : undefined}
        fields={selectedItem ? [
          { label: "Lane", value: selectedItem.service_lane },
          { label: "Station", value: selectedItem.station },
          { label: "Readiness", value: selectedItem.readiness },
          { label: "Shortage", value: selectedItem.shortage ?? "None" },
        ] : []}
        summary={selectedItem?.summary ?? null}
        detailPoints={selectedItem?.detail_points ?? null}
        prompt={selectedItem?.prompt ?? null}
      />
    </>
  );
}
```

- [ ] **Step 2: Create Food Cost page**

Follow the same pattern as Inbox/Orders/Inventory using `useFoodCost`, `foodCostColumns`, and fields: `menu_item_name`, `pressure`, `current_cost_pct`, `action`. KPIs: Total alerts, Avg cost % (computed from data), Above-target count (items with pressure containing "+").

- [ ] **Step 3: Create Menu page**

Same pattern using `useMenu`, `menuColumns`, fields: `item_name`, `category`, `performance`, `margin_pct`. KPIs: Stars/Puzzles/Plowhorses/Dogs counts by `performance` field.

- [ ] **Step 4: Create Marketing page**

Same pattern using `useMarketing`, `marketingColumns`, fields: `campaign_name`, `channel`, `stage`, `deliverable`. KPIs: Drafting/Research/Ready for review counts by `stage` field.

- [ ] **Step 5: Verify build**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(workspace\)/prep/ apps/web/src/app/\(workspace\)/food-cost/ apps/web/src/app/\(workspace\)/menu/ apps/web/src/app/\(workspace\)/marketing/
git commit -m "feat: add Prep (board), Food Cost, Menu, Marketing workspace pages"
```

---

## Task 10: Locations + Admin pages

**Files:**
- Create: `src/app/(workspace)/locations/page.tsx`
- Create: `src/app/(workspace)/admin/page.tsx`

- [ ] **Step 1: Create Locations page (read-only)**

```typescript
// src/app/(workspace)/locations/page.tsx
"use client";

import { useLocations } from "@/hooks/use-api";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { WorkspaceKPICards } from "@/components/workspace/workspace-kpi-cards";
import { WorkspaceTable } from "@/components/workspace/workspace-table";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { Location } from "@/lib/api";

function statusVariant(s: string) {
  switch (s) {
    case "Stable": return "default" as const;
    case "Attention": return "destructive" as const;
    default: return "secondary" as const;
  }
}

const locationColumns: ColumnDef<Location>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span> },
  { accessorKey: "city", header: "City" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant={statusVariant(row.getValue("status"))}>{row.getValue("status")}</Badge> },
  { accessorKey: "sales_delta", header: "Sales Delta" },
  { accessorKey: "labor_delta", header: "Labor Delta" },
];

export default function LocationsPage() {
  const { data, isLoading } = useLocations();
  const items = data ?? [];
  const kpis = [
    { label: "Total locations", value: items.length },
    { label: "Stable", value: items.filter((l) => l.status === "Stable").length },
    { label: "Attention", value: items.filter((l) => l.status === "Attention").length },
  ];

  return (
    <>
      <WorkspaceHeader title="Locations" subtitle="Multi-location overview" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable columns={locationColumns} data={items} isLoading={isLoading} />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create Admin placeholder**

```typescript
// src/app/(workspace)/admin/page.tsx
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <>
      <WorkspaceHeader title="Admin" subtitle="Settings & configuration" />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              Configuration and administration features are coming in a future update.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This page will include execution mode settings, connector configuration,
              user management, and organization preferences.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(workspace\)/locations/ apps/web/src/app/\(workspace\)/admin/
git commit -m "feat: add Locations (read-only table) and Admin (placeholder) pages"
```

---

## Task 11: Final integration test + Phase 3 commit

- [ ] **Step 1: Start engine and frontend**

```bash
# Terminal 1
cd engine && python3 main.py

# Terminal 2
cd apps/web && pnpm dev
```

- [ ] **Step 2: Verify all routes**

```bash
# Health check
curl -s http://localhost:8000/api/health

# Test each page loads
for route in inbox orders inventory prep food-cost menu marketing locations admin; do
  echo "=== /$route ==="
  curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/$route
done
```

Expected: all return HTTP 200.

- [ ] **Step 3: Verify build passes**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 4: Final commit for Phase 3**

```bash
git add -A
git commit -m "Phase 3 complete: all 10 workspace modules with tables, board, detail panels, chat dock"
```
