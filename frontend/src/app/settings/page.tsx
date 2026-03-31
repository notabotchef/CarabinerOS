"use client";

/**
 * SETTINGS BRIDGE — CarabinerOS Phase 1
 *
 * Embeds the Agent Zero webui settings panel (/a0/) inside the
 * Next.js shell. The sidebar and TopBar remain visible; the webui
 * loads inside a full-height iframe.
 *
 * Phase 2 will replace this with a native Next.js settings page.
 * See .rune/plan-frontend-consolidation-phase2.md
 */

import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Bridge header — signals to users that this is a bridged panel */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-card/60">
        <div className="flex size-6 items-center justify-center rounded-md bg-muted/40">
          <Settings className="size-3.5 text-muted-foreground" />
        </div>
        <div>
          <span className="text-sm font-medium text-foreground">Settings</span>
          <span className="ml-2 text-xs text-muted-foreground/60 font-mono">Agent Zero</span>
        </div>
      </div>

      {/* iframe bridge — full height within the shell */}
      <iframe
        src="/a0/"
        className="flex-1 w-full border-0"
        title="Agent Zero Settings"
        allow="clipboard-read; clipboard-write"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
