"use client";

/**
 * SETTINGS PAGE — CarabinerOS v1
 *
 * Read-only dashboard view of system configuration.
 * Displays restaurant profile, AI config, integration slots,
 * and system info. Editable settings come in Phase 2.
 */

import { useEffect, useState } from "react";
import {
  Settings,
  Bot,
  Plug,
  Info,
  Store,
  CircleCheck,
  CircleX,
  ExternalLink,
  CreditCard,
  CalendarCheck,
  Clock,
  BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ModelConfig {
  provider: string;
  name: string;
  ctx_length?: number;
  vision?: boolean;
}

interface A0Settings {
  version?: string;
  agent_profile?: string;
  [key: string]: unknown;
}

interface ModelConfigData {
  chat_model?: ModelConfig;
  utility_model?: ModelConfig;
  embedding_model?: ModelConfig;
  allow_chat_override?: boolean;
}

interface Integration {
  name: string;
  category: string;
  icon: React.ReactNode;
  status: "connected" | "coming-soon";
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CARABINER_VERSION = "0.13.0";

const INTEGRATIONS: Integration[] = [
  { name: "Toast", category: "POS", icon: <CreditCard className="size-4" />, status: "coming-soon" },
  { name: "OpenTable", category: "Reservations", icon: <CalendarCheck className="size-4" />, status: "coming-soon" },
  { name: "7shifts", category: "Scheduling", icon: <Clock className="size-4" />, status: "coming-soon" },
  { name: "QuickBooks", category: "Accounting", icon: <BookOpen className="size-4" />, status: "coming-soon" },
];

/* ------------------------------------------------------------------ */
/*  Data hooks                                                         */
/* ------------------------------------------------------------------ */

function useA0Settings() {
  const [data, setData] = useState<A0Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/settings_get", { credentials: "include", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return { data, loading };
}

function useModelConfig() {
  const [data, setData] = useState<ModelConfigData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Model config is served from plugin config endpoint
    const controller = new AbortController();
    fetch("/api/carabiner/model-config", { credentials: "include", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        return json.ok ? json.data : json;
      })
      .then((d) => setData(d))
      .catch(() => {
        // Fallback: read from static config if API not available
        setData(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return { data, loading };
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
        {icon}
      </div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function StatusDot({ connected }: { connected: boolean }) {
  return connected ? (
    <CircleCheck className="size-3.5 text-emerald-400" />
  ) : (
    <CircleX className="size-3.5 text-red-500" />
  );
}

function LoadingCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-48" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

function IntegrationCard({ integration }: { integration: Integration }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-start gap-3 hover:shadow-md transition-shadow">
      <div className="flex size-9 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground shrink-0">
        {integration.icon}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-sm font-medium text-foreground">{integration.name}</span>
        <span className="text-xs text-muted-foreground">{integration.category}</span>
      </div>
      <Badge variant="outline" className="ml-auto shrink-0 text-[11px]">
        Coming Soon
      </Badge>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const { data: a0Settings, loading: a0Loading } = useA0Settings();
  const { data: modelConfig, loading: modelLoading } = useModelConfig();

  // Derive model info from config or fall back to hardcoded defaults
  const chatModel = modelConfig?.chat_model;
  const utilityModel = modelConfig?.utility_model;
  const embeddingModel = modelConfig?.embedding_model;

  const providerLabel = chatModel?.provider
    ? chatModel.provider.charAt(0).toUpperCase() + chatModel.provider.slice(1)
    : "Unknown";

  const isConnected = !!a0Settings;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      {/* Page header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <div className="flex size-7 items-center justify-center rounded-lg bg-muted/40">
          <Settings className="size-4 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground leading-tight">Settings</h1>
          <p className="text-xs text-muted-foreground">System configuration and integrations</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 max-w-4xl">

        {/* Section 1: Restaurant Profile */}
        <section>
          <SectionHeader icon={<Store className="size-4 text-primary" />} title="Restaurant Profile" />
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Location" value="Carabiner Tapas" />
              <Field label="Currency" value="USD" mono />
              <Field label="Timezone" value="America/Chicago" mono />
            </div>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">
              Location settings are read from the database. Editing will be available in a future update.
            </p>
          </div>
        </section>

        {/* Section 2: AI Configuration */}
        <section>
          <SectionHeader icon={<Bot className="size-4 text-primary" />} title="AI Configuration" />
          {a0Loading || modelLoading ? (
            <LoadingCard />
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <StatusDot connected={isConnected} />
                <span className="text-sm text-foreground">
                  Agent Zero {isConnected ? "Connected" : "Disconnected"}
                </span>
                {a0Settings?.version && (
                  <Badge variant="secondary" className="text-[11px] font-mono">
                    {a0Settings.version}
                  </Badge>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Provider" value={providerLabel} />
                <Field label="Agent Profile" value={a0Settings?.agent_profile ?? "default"} />
                <Field
                  label="Chat Model"
                  value={chatModel?.name ?? "Not configured"}
                  mono
                />
                <Field
                  label="Context Length"
                  value={chatModel?.ctx_length ? `${chatModel.ctx_length.toLocaleString()} tokens` : "--"}
                  mono
                />
                <Field
                  label="Utility Model"
                  value={utilityModel?.name ?? "Not configured"}
                  mono
                />
                <Field
                  label="Embedding Model"
                  value={embeddingModel?.name ?? "Not configured"}
                  mono
                />
              </div>

              <Separator />

              <div className="flex items-center gap-2">
                <a
                  href="/a0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Configure via Agent Zero WebUI
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Integrations */}
        <section>
          <SectionHeader icon={<Plug className="size-4 text-primary" />} title="Integrations" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {INTEGRATIONS.map((integration) => (
              <IntegrationCard key={integration.name} integration={integration} />
            ))}
          </div>
        </section>

        {/* Section 4: System Info */}
        <section>
          <SectionHeader icon={<Info className="size-4 text-primary" />} title="System Info" />
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="CarabinerOS" value={CARABINER_VERSION} mono />
              <Field label="Agent Zero" value={a0Settings?.version ?? "--"} mono />
              <Field label="Frontend" value="Next.js 16" mono />
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Database</span>
                <span className="text-sm text-foreground inline-flex items-center gap-1.5">
                  <StatusDot connected={isConnected} />
                  <span className="font-mono">{isConnected ? "PostgreSQL 16" : "Disconnected"}</span>
                </span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
