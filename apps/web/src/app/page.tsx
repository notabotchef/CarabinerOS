"use client";

import { ChatView } from "@/components/chat/chat-view";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useLocations } from "@/hooks/use-api";

export default function HomePage() {
  const activeLocationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data: locations } = useLocations();
  const activeName = locations?.find((l) => l.id === activeLocationId)?.name;

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
      </header>
      <ChatView />
    </div>
  );
}
