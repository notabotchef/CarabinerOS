"use client";

import { useState, useEffect, useRef } from "react";
import type { A0Snapshot, ChefStatus } from "@/lib/types";

// --- Type guard for agent log kvps ---

interface AgentKvps {
  thoughts?: string[];
  headline?: string;
  step?: string;
  tool_name?: string;
}

function getAgentKvps(kvps: Record<string, unknown>): AgentKvps {
  return {
    thoughts: Array.isArray(kvps.thoughts) ? (kvps.thoughts as string[]) : undefined,
    headline: typeof kvps.headline === "string" ? kvps.headline : undefined,
    step: typeof kvps.step === "string" ? kvps.step : undefined,
    tool_name: typeof kvps.tool_name === "string" ? kvps.tool_name : undefined,
  };
}

// --- ExpoTicketStep ---

export interface ExpoTicketStep {
  type: "agent" | "tool" | "subagent" | "response";
  heading: string;
  isFiller: boolean;
  durationMs?: number;
}

// --- ExpoState ---

export interface ExpoState {
  text: string | null;
  thoughts: string[];
  active: boolean;
  ticketSteps: ExpoTicketStep[];
}

// --- Kitchen joke fallback ---

const THINKING_MESSAGES = [
  // --- OG 8 ---
  "Checking if Rene Redzepi already paid the interns",
  "Cross-referencing your wine list with last night\u2019s dreams",
  "Consulting the mise en place oracle",
  "Running the numbers through the pasta machine",
  "Asking the walk-in for its opinion",
  "Debating butter quantities with the saucier",
  "Checking the reservation book for ghosts",
  "Calibrating the flavor compass",
  // --- The line ---
  "Counting how many side towels disappeared this shift",
  "Asking the dishwasher if they\u2019ve seen your will to live",
  "Waiting for the ticket printer to stop \u2014 just kidding, it never stops",
  "Checking if the walk-in is still judging us",
  "Consulting the ancient texts (the binder behind the bar)",
  "Whispering \u201Cheard\u201D to no one in particular",
  "Doing a quick cry in the walk-in, one sec",
  "Blaming the previous shift",
  "Rewriting the 86 list for the third time today",
  "Pretending this ticket didn\u2019t just print",
  "Negotiating with the salamander",
  "Double-checking that nobody 86\u2019d the good tongs",
  "Asking the line if they\u2019re in the weeds or just standing there",
  "Looking for the sharpie someone definitely borrowed",
  "Reading the ticket printer like it\u2019s a fortune teller",
  "Confirming the special is still special",
  "Checking who left the burner on overnight",
  "Performing a quick inventory of lost Sharpies",
  "Convincing the garde manger this is important",
  "Wondering who labeled this container \u201Cstuff\u201D",
  "Ignoring the front-of-house like a true line cook",
  "Telling the new guy to check the basement",
  "Looking for a clean apron (good luck)",
  "Calculating how many covers before we lose it",
  "Verifying the fish delivery wasn\u2019t yesterday\u2019s fish",
  "Staring at the board like it owes us money",
  "Asking Chef if we can sub micro-greens for personality",
  "Rotating stock and existential dread",
  "Checking if that\u2019s a fruit fly or a garnish",
  "Reviewing the Bourdain playbook",
  "Confirming the quenelles pass the vibe check",
  "Making sure the pass is clear before we fire",
  "Trying to remember who has the keys to dry storage",
  "Tempering chocolate and expectations",
];

function getRandomJoke(): string {
  return THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
}

// --- Heading cleanup ---

function cleanHeading(raw: string): string {
  return raw
    .replace(/icon:\/\/\S+\s*/g, "")
    .replace(/A\d+:\s*/g, "")
    .replace(/^>>>\s*/, "")
    .trim();
}

// --- Snapshot logs into ticket steps ---

const TICKET_LOG_TYPES = new Set(["agent", "tool", "subagent", "response"]);

function snapshotTicketSteps(snapshot: A0Snapshot | null): ExpoTicketStep[] {
  if (!snapshot?.logs?.length) return [];

  const steps: ExpoTicketStep[] = [];
  for (const log of snapshot.logs) {
    if (!TICKET_LOG_TYPES.has(log.type)) continue;

    const heading = cleanHeading(log.heading || "");
    if (!heading) continue;

    const isFiller = THINKING_MESSAGES.includes(heading);
    const stepType = log.type as ExpoTicketStep["type"];

    steps.push({
      type: stepType,
      heading,
      isFiller,
    });
  }
  return steps;
}

// --- Extract thoughts and status from snapshot ---

function extractFromLogs(snapshot: A0Snapshot | null): {
  thoughts: string[];
  headline: string | null;
  step: string | null;
} {
  if (!snapshot?.logs?.length) return { thoughts: [], headline: null, step: null };

  for (let i = snapshot.logs.length - 1; i >= 0; i--) {
    const log = snapshot.logs[i];
    if (log.type !== "agent" || !log.kvps) continue;

    const kvps = getAgentKvps(log.kvps);
    if (kvps.thoughts?.length || kvps.headline || kvps.step) {
      return {
        thoughts: kvps.thoughts ?? [],
        headline: kvps.headline ?? null,
        step: kvps.step ?? null,
      };
    }
  }

  return { thoughts: [], headline: null, step: null };
}

// --- Hook ---

export function useExpoStream(
  snapshot: A0Snapshot | null,
  chefStatus: ChefStatus | null,
): ExpoState {
  const [expo, setExpo] = useState<ExpoState>({
    text: null,
    thoughts: [],
    active: false,
    ticketSteps: [],
  });
  const jokeRef = useRef(getRandomJoke());
  const stickyTextRef = useRef<string | null>(null);
  const prevActiveRef = useRef(false);
  const prevContextRef = useRef<string | null>(null);

  // Reset state when context changes (user switches chats)
  useEffect(() => {
    const ctx = snapshot?.context ?? null;
    if (prevContextRef.current !== null && ctx !== prevContextRef.current) {
      stickyTextRef.current = null;
      prevActiveRef.current = false;
      jokeRef.current = getRandomJoke();
      setExpo({ text: null, thoughts: [], active: false, ticketSteps: [] });
    }
    prevContextRef.current = ctx;
  }, [snapshot?.context]);

  // Extract thoughts + headline/step from snapshot logs
  useEffect(() => {
    if (!snapshot) return;

    const isActive = snapshot.log_progress_active;
    const { thoughts, headline, step } = extractFromLogs(snapshot);

    if (isActive) {
      // Resolve ExpoBar text: headline > step > chefStatus > sticky > joke
      const realText = headline ?? step ?? null;
      if (realText) stickyTextRef.current = realText;

      const displayText =
        realText ??
        chefStatus?.text ??
        stickyTextRef.current ??
        jokeRef.current;

      prevActiveRef.current = true;
      setExpo({ text: displayText, thoughts, active: true, ticketSteps: [] });
    } else if (prevActiveRef.current) {
      // Transition from active -> inactive: snapshot ticket steps
      prevActiveRef.current = false;
      const steps = snapshotTicketSteps(snapshot);
      setExpo((prev) => ({ ...prev, ticketSteps: steps }));
    }
  }, [snapshot, chefStatus]);

  // Chef status updates (completion state)
  useEffect(() => {
    if (!chefStatus) return;

    if (!chefStatus.active) {
      stickyTextRef.current = null;
      setExpo((prev) => ({ ...prev, text: chefStatus.text, thoughts: [], active: false }));
      const timer = setTimeout(() => {
        setExpo((prev) =>
          prev.active || prev.ticketSteps.length > 0
            ? prev
            : { text: null, thoughts: [], active: false, ticketSteps: [] },
        );
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [chefStatus]);

  // Fallback: progress without chefStatus
  useEffect(() => {
    if (!snapshot) return;
    // Check if a response log exists for the current turn — means agent is done
    const hasResponse = snapshot.logs?.some(
      (l) => l.type === "response" && l.agentno === 0 && l.content?.trim(),
    );
    const shouldStop =
      (!snapshot.log_progress_active && expo.active) ||
      (hasResponse && expo.active && !snapshot.log_progress_active);

    if (!chefStatus && shouldStop) {
      stickyTextRef.current = null;
      prevActiveRef.current = false;
      const steps = snapshotTicketSteps(snapshot);
      setExpo({ text: null, thoughts: [], active: false, ticketSteps: steps });
    }
  }, [snapshot, chefStatus, expo.active]);

  return expo;
}
