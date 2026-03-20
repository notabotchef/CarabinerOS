"use client";

import { useState, useEffect } from "react";
import type { A0Snapshot, ChefStatus } from "@/lib/types";

interface ExpoState {
  text: string | null;
  active: boolean;
}

/** Strip Agent Zero's internal heading prefixes like "icon://chat A0: Responding" */
function cleanProgressText(raw: string): string {
  // Remove "icon://<name> " prefix
  let text = raw.replace(/^icon:\/\/\S+\s*/, "");
  // Replace agent name prefix like "A0: " with something friendlier
  text = text.replace(/^A\d+:\s*/, "");
  return text || "Working...";
}

export function useExpoStream(snapshot: A0Snapshot | null, chefStatus: ChefStatus | null): ExpoState {
  const [expo, setExpo] = useState<ExpoState>({ text: null, active: false });

  useEffect(() => {
    if (!chefStatus) return;

    if (chefStatus.active) {
      setExpo({ text: chefStatus.text, active: true });
    } else {
      setExpo({ text: chefStatus.text, active: false });
      const timer = setTimeout(() => {
        setExpo((prev) => prev.active ? prev : { text: null, active: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [chefStatus]);

  // Fallback to basic progress if no chefStatus but progress is active
  useEffect(() => {
    if (!chefStatus && snapshot?.log_progress_active && snapshot?.log_progress) {
      const raw = typeof snapshot.log_progress === "string" ? snapshot.log_progress : "Working...";
      setExpo({ text: cleanProgressText(raw), active: true });
    }
    if (!chefStatus && snapshot && !snapshot.log_progress_active && expo.active) {
      setExpo({ text: "Done", active: false });
      const timer = setTimeout(() => {
        setExpo({ text: null, active: false });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [snapshot, chefStatus]);

  return expo;
}
