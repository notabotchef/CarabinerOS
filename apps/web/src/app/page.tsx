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
            <span className="text-xs">&#x2318;</span>K
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
