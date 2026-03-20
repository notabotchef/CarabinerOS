"use client";

import { useState, useEffect, useRef } from "react";
import type { A0Snapshot, ChefStatus } from "@/lib/types";

export interface ExpoState {
  text: string | null;
  thought: string | null;
  step: string | null;
  active: boolean;
}

/** Strip Agent Zero's internal heading prefixes like "icon://chat A0: Responding" */
function cleanProgressText(raw: string): string {
  let text = raw.replace(/^icon:\/\/\S+\s*/, "");
  text = text.replace(/^A\d+:\s*/, "");
  return text || "Working...";
}

/** Extract the latest thought and step from agent logs */
function extractThoughts(snapshot: A0Snapshot | null): { thought: string | null; step: string | null } {
  if (!snapshot?.logs?.length) return { thought: null, step: null };

  // Walk logs in reverse to find the latest agent log with thoughts
  for (let i = snapshot.logs.length - 1; i >= 0; i--) {
    const log = snapshot.logs[i];
    if (log.type !== "agent") continue;

    const kvps = log.kvps;
    if (!kvps) continue;

    const thoughts = kvps.thoughts as string[] | undefined;
    const step = kvps.step as string | undefined;

    // Get the last thought from the array
    const lastThought = thoughts?.length ? thoughts[thoughts.length - 1] : null;

    if (lastThought || step) {
      return { thought: lastThought ?? null, step: step ?? null };
    }
  }

  return { thought: null, step: null };
}

export function useExpoStream(snapshot: A0Snapshot | null, chefStatus: ChefStatus | null): ExpoState {
  const [expo, setExpo] = useState<ExpoState>({ text: null, thought: null, step: null, active: false });
  const prevThoughtRef = useRef<string | null>(null);

  // Extract thoughts from snapshot logs
  useEffect(() => {
    if (!snapshot?.log_progress_active) {
      // Not actively processing — clear thoughts
      if (prevThoughtRef.current !== null) {
        prevThoughtRef.current = null;
        setExpo((prev) => ({ ...prev, thought: null, step: null }));
      }
      return;
    }

    const { thought, step } = extractThoughts(snapshot);

    // Only update if thought actually changed (avoid re-renders)
    if (thought !== prevThoughtRef.current || step !== expo.step) {
      prevThoughtRef.current = thought;
      setExpo((prev) => ({ ...prev, thought, step }));
    }
  }, [snapshot]);

  // Chef status is the primary source for active/text
  useEffect(() => {
    if (!chefStatus) return;

    if (chefStatus.active) {
      setExpo((prev) => ({ ...prev, text: chefStatus.text, active: true }));
    } else {
      setExpo((prev) => ({ ...prev, text: chefStatus.text, active: false }));
      const timer = setTimeout(() => {
        setExpo((prev) => prev.active ? prev : { text: null, thought: null, step: null, active: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [chefStatus]);

  // Fallback to basic progress if no chefStatus but progress is active
  useEffect(() => {
    if (!chefStatus && snapshot?.log_progress_active && snapshot?.log_progress) {
      const raw = typeof snapshot.log_progress === "string" ? snapshot.log_progress : "Working...";
      setExpo((prev) => ({ ...prev, text: cleanProgressText(raw), active: true }));
    }
    if (!chefStatus && snapshot && !snapshot.log_progress_active && expo.active) {
      setExpo({ text: "Done", thought: null, step: null, active: false });
      const timer = setTimeout(() => {
        setExpo({ text: null, thought: null, step: null, active: false });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [snapshot, chefStatus]);

  return expo;
}
