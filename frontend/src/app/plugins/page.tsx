"use client";

/**
 * PLUGINS PAGE — CarabinerOS
 *
 * Showcase of installed plugins and the upcoming integration marketplace.
 * Phase 1: read-only display of current A0 plugins + coming-soon cards.
 * Phase 2: OAuth connection flows for third-party integrations.
 */

import { Puzzle, ExternalLink, Code2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface InstalledPlugin {
  name: string;
  title: string;
  description: string;
  version: string;
  alwaysEnabled: boolean;
  enabled: boolean;
}

const INSTALLED_PLUGINS: InstalledPlugin[] = [
  {
    name: "carabiner",
    title: "CarabinerOS",
    description: "Restaurant management platform — DB, API routes, and domain logic.",
    version: "0.13.0",
    alwaysEnabled: true,
    enabled: true,
  },
  {
    name: "_model_config",
    title: "Model Config",
    description: "LLM model selection, presets, and routing configuration.",
    version: "1.0.0",
    alwaysEnabled: false,
    enabled: true,
  },
];

interface MarketplaceIntegration {
  name: string;
  category: string;
  description: string;
  color: string; // Tailwind bg class for the logo circle
  letter: string;
}

const MARKETPLACE: MarketplaceIntegration[] = [
  {
    name: "Toast POS",
    category: "Point of Sale",
    description: "Sync sales, menu items, and checks in real-time",
    color: "bg-orange-500",
    letter: "T",
  },
  {
    name: "OpenTable",
    category: "Reservations",
    description: "Import covers forecast and guest data",
    color: "bg-red-500",
    letter: "O",
  },
  {
    name: "7shifts",
    category: "Scheduling",
    description: "Labor cost sync and shift management",
    color: "bg-violet-500",
    letter: "7",
  },
  {
    name: "Square",
    category: "Payments",
    description: "Transaction data and payment processing",
    color: "bg-emerald-500",
    letter: "S",
  },
  {
    name: "Google Business",
    category: "Reviews",
    description: "Monitor reviews and respond via AI",
    color: "bg-blue-500",
    letter: "G",
  },
  {
    name: "QuickBooks",
    category: "Accounting",
    description: "Auto-sync invoices and P&L data",
    color: "bg-green-600",
    letter: "Q",
  },
  {
    name: "Uber Eats",
    category: "Delivery",
    description: "Third-party delivery order management",
    color: "bg-black dark:bg-white/20",
    letter: "U",
  },
  {
    name: "DoorDash",
    category: "Delivery",
    description: "Delivery marketplace integration",
    color: "bg-red-600",
    letter: "D",
  },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function InstalledPluginCard({ plugin }: { plugin: InstalledPlugin }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {/* Icon */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Puzzle className="size-5 text-primary" />
          </div>
          {/* Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{plugin.title}</span>
              <span className="text-[11px] font-mono text-muted-foreground">v{plugin.version}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {plugin.description}
            </p>
          </div>
        </div>
        {/* Badge */}
        {plugin.alwaysEnabled ? (
          <Badge className="shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
            Always Enabled
          </Badge>
        ) : plugin.enabled ? (
          <Badge className="shrink-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
            Enabled
          </Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            Disabled
          </Badge>
        )}
      </div>
    </div>
  );
}

function MarketplaceCard({ integration }: { integration: MarketplaceIntegration }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm opacity-85 transition-all duration-200 hover:opacity-100 hover:shadow-md">
      <div className="flex items-start gap-3">
        {/* Logo placeholder */}
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${integration.color}`}
        >
          {integration.letter}
        </div>
        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">{integration.name}</span>
            <Badge className="shrink-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
              Coming Soon
            </Badge>
          </div>
          <Badge variant="outline" className="mb-2 text-[11px]">
            {integration.category}
          </Badge>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {integration.description}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PluginsPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/60">
        <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10">
          <Puzzle className="size-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Plugins</h1>
          <p className="text-xs text-muted-foreground">
            Extend CarabinerOS with integrations
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 max-w-5xl">
        {/* Section 1: Installed Plugins */}
        <section className="space-y-4">
          <SectionHeader
            title="Installed Plugins"
            subtitle="Plugins currently loaded in your CarabinerOS instance"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INSTALLED_PLUGINS.map((plugin) => (
              <InstalledPluginCard key={plugin.name} plugin={plugin} />
            ))}
          </div>
        </section>

        {/* Section 2: Integration Marketplace */}
        <section className="space-y-4">
          <SectionHeader
            title="Integration Marketplace"
            subtitle="Connect third-party services via OAuth MCP servers"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MARKETPLACE.map((integration) => (
              <MarketplaceCard key={integration.name} integration={integration} />
            ))}
          </div>
        </section>

        {/* Section 3: Build Your Own */}
        <section>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                <Code2 className="size-5 text-violet-500" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Build Your Own
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                  Build custom integrations with the CarabinerOS Plugin SDK.
                  The self-extending architecture lets Agent Zero create MCP
                  servers and plugin manifests on the fly — your AI assistant
                  can wire up new data sources without leaving the dashboard.
                </p>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                  <ExternalLink className="size-3" />
                  Documentation coming soon
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
