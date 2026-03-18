# Phase 3: Workspace Modules — Design Spec

## Goal

Build all 10 workspace module pages (Inbox, Orders, Inventory, Prep, Food Cost, Menu, Marketing, Locations, Admin + docked chat panel) so operators can view, filter, and interact with restaurant data served from the PostgreSQL API.

## Architecture

Workspace modules follow a composition pattern: a small set of reusable primitives (`WorkspaceTable`, `WorkspaceBoard`, `WorkspaceDetailPanel`, `WorkspaceKPICards`, `WorkspaceHeader`, `ChatDock`) are assembled by thin module page components. Each page reads `activeLocationId` from Zustand, passes it to a React Query hook, and renders the result through shared components.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Page layout | Full-width table, no right rail | Cleaner focus; cross-module context lives on Home dashboard. Migration plan listed "Right rail" as Phase 3 deliverable — replaced by ChatDock; migration plan updated accordingly. |
| Detail panel | Sheet with 2x2 data fields + narrative + CTA | High info density; data fields compensate for narrow table columns |
| Ask CarabinerOS | Opens docked chat panel with pre-filled prompt | Keeps workspace context visible; actual streaming is Phase 4 |
| Prep board | Kanban columns by service lane | Matches legacy layout; operators think in lanes, not statuses |
| Admin/Locations | Minimal placeholders | Functional but thin; built out in later phases |

## Tech Stack

- **TanStack Table** — headless table with sorting, column definitions
- **shadcn/ui** — Table, Sheet, ScrollArea, Skeleton (install: table, scroll-area)
- **React Query** — existing hooks in `hooks/use-api.ts`
- **Zustand** — existing store in `stores/workspace-store.ts`
- **Next.js App Router** — `(workspace)` route group with shared layout

## File Structure

### New Files

```
app/(workspace)/
├── layout.tsx                    # Shared workspace layout + ChatDock
├── inbox/page.tsx
├── orders/page.tsx
├── inventory/page.tsx
├── prep/page.tsx
├── food-cost/page.tsx
├── menu/page.tsx
├── marketing/page.tsx
├── locations/page.tsx
└── admin/page.tsx

components/workspace/
├── workspace-header.tsx          # Module title + location breadcrumb
├── workspace-kpi-cards.tsx       # Row of computed KPI cards
├── workspace-table.tsx           # TanStack Table wrapper (generic)
├── workspace-board.tsx           # Kanban board (Prep only)
├── workspace-detail-panel.tsx    # Sheet with data fields + narrative + CTA
├── chat-dock.tsx                 # Docked chat sidebar (placeholder for Phase 4)
└── columns/                      # Column definitions per module
    ├── inbox-columns.tsx
    ├── orders-columns.tsx
    ├── inventory-columns.tsx
    ├── food-cost-columns.tsx
    ├── menu-columns.tsx
    └── marketing-columns.tsx
```

### Modified Files

- `src/stores/workspace-store.ts` — add `chatPrompt: string | null` and `setChatPrompt()`. Remove `selectedItemId` and `setSelectedItem` — selection is per-page local state via `useState`, not global Zustand.
- `src/lib/api.ts` — move `InventoryItem`, `PrepTask`, `FoodCostItem`, `MenuItem`, `Campaign` type definitions here (currently inline in `use-api.ts`, not exported). All column definition files will import from `lib/api.ts`.
- `src/hooks/use-api.ts` — import types from `lib/api.ts` instead of defining inline.
- `src/app/page.tsx` — remains as-is (Home dashboard, outside workspace route group so ChatDock does not wrap it)

### shadcn Components to Install

- `table` — Table, TableHeader, TableRow, TableCell, etc.
- `scroll-area` — for Prep board column scrolling

## Component Specifications

### WorkspaceHeader

Props: `title: string`, `subtitle?: string`

Renders: SidebarTrigger + separator + module title + active location name (from Zustand → useLocations lookup).

### WorkspaceKPICards

Props: `cards: { label: string; value: string | number; delta?: string }[]`

Renders: responsive grid of Card components (same style as Home dashboard metrics). Each module page computes its own KPIs from query data and passes them as props.

### WorkspaceTable (Generic)

Props:
- `columns: ColumnDef<T>[]` — TanStack Table column definitions
- `data: T[]`
- `isLoading: boolean`
- `onRowClick: (item: T) => void`

Renders: shadcn Table with header row, data rows, skeleton loading state. Row click calls `onRowClick` which sets `selectedItemId` in Zustand.

### WorkspaceBoard (Prep only)

Props:
- `items: PrepTask[]`
- `isLoading: boolean`
- `groupBy: string` (default: `"service_lane"`)
- `onCardClick: (item: PrepTask) => void`

Renders: horizontal flex of columns. Each column is a service lane with a header (name + count) and vertical stack of cards. Cards show: readiness badge, task name (bold), station, shortage warning.

### WorkspaceDetailPanel

Props:
- `open: boolean`
- `onClose: () => void`
- `title: string`
- `fields: { label: string; value: string }[]` — 2x2 data grid
- `statusBadge?: { label: string; variant: string }`
- `summary: string | null`
- `detailPoints: string[] | null`
- `prompt: string | null`

Renders: shadcn Sheet (side="right"). Contains:
1. Status badge + metadata line
2. 2x2 grid of data fields (label + value)
3. Summary paragraph
4. Bulleted detail points
5. Divider
6. "Ask CarabinerOS" button — on click: `setChatPrompt(prompt)` + `setChatOpen(true)`

### ChatDock

Props: none (reads from Zustand: `isChatOpen`, `chatPrompt`)

Renders: conditional right sidebar (width ~380px). Contains:
- Header: "CarabinerOS" + close button
- Pre-filled prompt in a textarea (editable)
- "Send" button (disabled, placeholder — Phase 4 wires actual streaming)
- Empty message area with "Chat responses will appear here" placeholder

The dock shares the viewport with the workspace table — table shrinks when dock opens.

## Module Page Specifications

Each table module page follows this template (illustrative — each module maps its own title field and data fields):

```tsx
"use client";

export default function ModulePage() {
  const locationId = useWorkspaceStore(s => s.activeLocationId);
  const { data, isLoading } = useModuleHook(locationId);
  // Selection is local state, not Zustand — each page manages its own
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = data?.find(d => d.id === selectedId);

  const kpis = computeKPIs(data);

  return (
    <>
      <WorkspaceHeader title="Module Name" />
      <div className="p-6 space-y-6">
        <WorkspaceKPICards cards={kpis} />
        <WorkspaceTable
          columns={moduleColumns}
          data={data ?? []}
          isLoading={isLoading}
          onRowClick={(item) => setSelectedId(item.id)}
        />
      </div>
      <WorkspaceDetailPanel
        open={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem?.vendor ?? selectedItem?.item_name ?? ""} // each module maps its own title
        fields={buildFields(selectedItem)}
        summary={selectedItem?.summary}
        detailPoints={selectedItem?.detail_points}
        prompt={selectedItem?.prompt}
      />
    </>
  );
}
```

### Per-Module Details

**Inbox**
- Hook: `useInbox(locationId)`
- Columns: Title, Priority (badge), Owner, Status, Module (badge)
- KPIs: Total count, High priority count, "Needs review" count
- Detail fields: priority, owner, status, module

**Orders**
- Hook: `useOrders(locationId)`
- Columns: Vendor, Channel, Status (badge), Total, ETA, Summary (truncated)
- KPIs: Ready to send count, Total dollar value (sum), Drafting count
- Detail fields: vendor, channel, total, eta

**Inventory**
- Hook: `useInventory(locationId)`
- Columns: Item Name, On Hand, Par, Variance (colored +/-), Summary (truncated)
- KPIs: Below par count, Over par count, Total items
- Detail fields: item_name, on_hand, par, variance

**Prep** (Board)
- Hook: `usePrep(locationId)`
- Columns by `service_lane`: Brunch, Dinner, Happy hour, etc.
- Cards: readiness badge, task (bold), station, shortage (if any)
- KPIs: Ready count, At risk count, Blocked count
- Detail fields: service_lane, station, readiness, shortage

**Food Cost**
- Hook: `useFoodCost(locationId)`
- Columns: Menu Item, Pressure, Cost %, Action, Summary (truncated)
- KPIs: Total alerts, Avg cost % (computed), Above-target count
- Detail fields: menu_item_name, pressure, current_cost_pct, action

**Menu**
- Hook: `useMenu(locationId)`
- Columns: Item, Category, Performance (badge), Margin %, Recommendation, Summary (truncated)
- KPIs: Stars count, Puzzles count, Plowhorses count, Dogs count
- Detail fields: item_name, category, performance, margin_pct

**Marketing**
- Hook: `useMarketing(locationId)`
- Columns: Campaign, Channel, Stage (badge), Deliverable, Summary (truncated)
- KPIs: Drafting count, Research count, Ready for review count
- Detail fields: campaign_name, channel, stage, deliverable

**Locations** (read-only table, no detail panel)
- Hook: `useLocations()`
- Columns: Name, City, Status (badge), Sales Delta, Labor Delta
- KPIs: Total locations, Stable count, Attention count
- No detail panel, no "Ask CarabinerOS"

**Admin** (placeholder)
- No table, no hooks
- Card with "Settings & configuration coming in a future update"
- Lists execution mode and connector status from HQ data

## Data Flow

```
User navigates to /orders
  → (workspace)/layout.tsx renders WorkspaceHeader + ChatDock
  → orders/page.tsx reads activeLocationId from Zustand
  → useOrders(locationId) fires GET /api/orders?location_id=...
  → WorkspaceKPICards computes KPIs from order data
  → WorkspaceTable renders rows with orders-columns definitions
  → User clicks row → setSelectedId(order.id)
  → WorkspaceDetailPanel opens as Sheet
  → User clicks "Ask CarabinerOS"
  → setChatPrompt(order.prompt) + setChatOpen(true)
  → ChatDock opens with prompt pre-filled
```

Socket.IO `workspace_update` events invalidate React Query cache → table auto-refreshes.

## Loading & Error States

- **Loading**: WorkspaceTable shows Skeleton rows (3 rows). WorkspaceBoard shows Skeleton cards. KPIs show Skeleton blocks.
- **Error**: Toast notification + "Failed to load data" message with retry button.
- **Empty**: "No items found" centered message with suggestion to use a different location or ask CarabinerOS.

## Accessibility

- Table rows are focusable via keyboard. Enter/Space opens the detail panel.
- shadcn Sheet handles Escape to close natively.
- KPI cards and badges use semantic HTML and ARIA labels where needed.

## Known Limitations (Deferred)

- **Pagination**: Not implemented. Current seed data is small (3 items per module per location). Pagination and virtualization are deferred to Phase 11.
- **URL state sync**: Opening a detail panel does not update the URL. Refreshing the page loses selection context.
- **Mobile/tablet**: Responsive behavior is deferred to Phase 11. Layout is desktop-first.
- **Chat "Send" button**: Disabled in Phase 3. Clicking shows a toast explaining streaming comes in Phase 4.

## Exit Criteria

1. All 9 module pages render with data from the API
2. Location switcher filters all tables/boards
3. Clicking a row opens the detail panel with correct data
4. "Ask CarabinerOS" opens the docked chat panel with the item's prompt
5. Loading skeletons display while data fetches
6. Prep module renders as Kanban board grouped by service lane
7. Locations page shows read-only table, Admin shows placeholder
