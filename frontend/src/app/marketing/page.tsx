"use client";

import { useWorkspace } from "@/hooks/use-workspace";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  reach: number;
  engagement: number;
}

function statusVariant(status: string) {
  switch (status.toLowerCase()) {
    case "active":
    case "running":
      return "default" as const;
    case "draft":
    case "paused":
      return "secondary" as const;
    case "completed":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-sm text-foreground leading-tight">
          {campaign.name}
        </h3>
        <Badge variant={statusVariant(campaign.status)}>
          {campaign.status}
        </Badge>
      </div>

      <Badge variant="outline">{campaign.channel}</Badge>

      <div className="flex items-center gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
        <span className="tabular-nums">
          <span className="font-medium text-foreground">
            {campaign.reach?.toLocaleString() ?? "0"}
          </span>{" "}
          reach
        </span>
        <span className="tabular-nums">
          <span className="font-medium text-foreground">
            {campaign.engagement?.toLocaleString() ?? "0"}
          </span>{" "}
          engagement
        </span>
      </div>
    </div>
  );
}

function CampaignCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <div className="flex gap-4 pt-2 border-t border-border">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export default function MarketingPage() {
  const { data, loading, error } = useWorkspace<Campaign>("/api/campaigns");

  return (
    <div className="flex flex-col h-dvh">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-bold text-foreground">Marketing</h1>
          <p className="text-sm text-muted-foreground">
            Campaign management and performance
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground mb-4">
            No data available — API endpoint not connected yet
          </div>
        )}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="size-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-sm font-medium text-muted-foreground">
              No campaigns yet
            </h3>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Create your first campaign to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
