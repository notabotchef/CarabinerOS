import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div>
          <h1 className="text-sm font-semibold">Good morning</h1>
          <p className="text-xs text-muted-foreground">
            River North &middot; 3 locations monitored
          </p>
        </div>
      </header>

      <main className="flex-1 space-y-6 p-6">
        <DashboardTabs />
      </main>
    </div>
  );
}
