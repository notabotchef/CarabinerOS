import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { fetchAPI, type HQPayload } from "@/lib/api";

export default async function HomePage() {
  let hq: HQPayload | null = null;
  try {
    hq = await fetchAPI<HQPayload>("/api/hq");
  } catch {
    // API unavailable — will render with fallback data
  }

  const locationCount = hq?.locations.length ?? 3;
  const activeName = hq?.locations.find(
    (l) => l.slug === hq?.active_location_id
  )?.name ?? "River North";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div>
          <h1 className="text-sm font-semibold">Good morning</h1>
          <p className="text-xs text-muted-foreground">
            {activeName} &middot; {locationCount} locations monitored
          </p>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-6">
        <DashboardTabs hq={hq} />
      </main>
    </div>
  );
}
