"use client";

import { useMemo } from "react";

interface ExpoBarProps {
  text: string | null;
  active: boolean;
}

const THINKING_MESSAGES = [
  "Checking if Ren\u00e9 Redzepi already paid the interns",
  "Cross-referencing your wine list with last night\u2019s dreams",
  "Consulting the mise en place oracle",
  "Running the numbers through the pasta machine",
  "Asking the walk-in for its opinion",
  "Debating butter quantities with the saucier",
  "Checking the reservation book for ghosts",
  "Calibrating the flavor compass",
];

function getThinkingMessage(): string {
  return THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
}

export function ExpoBar({ text, active }: ExpoBarProps) {
  const thinkingMsg = useMemo(() => getThinkingMessage(), []);

  if (!text) return null;

  const displayText = active ? thinkingMsg : text;

  return (
    <div
      className={`
        flex items-center gap-2.5 px-4 py-2
        transition-all duration-300 ease-in-out
        ${text ? "opacity-100 max-h-12" : "opacity-0 max-h-0"}
      `}
    >
      {active ? (
        /* Three animated dots -- pulsing primary color */
        <div className="flex items-center gap-1">
          <span className="expo-dot-1 inline-block size-[6px] rounded-full bg-primary" />
          <span className="expo-dot-2 inline-block size-[6px] rounded-full bg-primary" />
          <span className="expo-dot-3 inline-block size-[6px] rounded-full bg-primary" />
        </div>
      ) : (
        /* Green completion dot */
        <span className="inline-block size-[6px] rounded-full bg-emerald-500" />
      )}
      <span
        className={`text-xs leading-tight ${
          active
            ? "italic text-primary/70"
            : "font-medium text-emerald-500/80"
        }`}
      >
        {displayText}
      </span>
    </div>
  );
}
