"use client";

import { useState, useEffect, useRef } from "react";
import type { A0Snapshot } from "@/lib/types";
import { getExpoMessage, getCompletionMessage } from "@/lib/expo-messages";

interface ExpoState {
  text: string | null;
  active: boolean;
}

export function useExpoStream(snapshot: A0Snapshot | null): ExpoState {
  const [expo, setExpo] = useState<ExpoState>({ text: null, active: false });
  const prevLogsLenRef = useRef(0);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (!snapshot) return;

    if (snapshot.log_progress_active && snapshot.log_progress) {
      const progressText = typeof snapshot.log_progress === "string"
        ? snapshot.log_progress
        : "Working...";

      const newLogs = snapshot.logs.slice(prevLogsLenRef.current);
      let expoText = progressText;

      for (const log of newLogs.reverse()) {
        const mapped = getExpoMessage(log);
        if (mapped) {
          expoText = mapped;
          break;
        }
      }

      setExpo({ text: expoText, active: true });
      wasActiveRef.current = true;
    } else if (wasActiveRef.current) {
      setExpo({ text: getCompletionMessage(), active: false });
      wasActiveRef.current = false;
      const timer = setTimeout(() => setExpo({ text: null, active: false }), 2000);
      return () => clearTimeout(timer);
    }

    prevLogsLenRef.current = snapshot.logs.length;
  }, [snapshot]);

  return expo;
}
