"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { A0Snapshot, A0LogEntry, ChatMessage, InlineStep, StepLabel } from "@/lib/types";
import { getCsrfToken } from "@/lib/csrf";

// --- Step extraction helpers ---

const STEP_LOG_TYPES = new Set(["agent", "tool", "subagent", "response"]);

const LABEL_MAP: Record<string, StepLabel> = {
  agent: "GEN",
  tool: "USE",
  subagent: "SUB",
  response: "RES",
};

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

function cleanHeading(raw: string): string {
  // Strip icon:// prefixes and >>> markers, then map agent numbers to kitchen roles
  return raw
    .replace(/icon:\/\/\S+\s*/g, "")
    .replace(/^>>>\s*/, "")
    .trim()
    .replace(/^A0:\s*/, "GM: ")
    .replace(/^A1:\s*/, "AGM: ")
    .replace(/^A(\d+):\s*/, "Team: ");
}

interface CollectedSteps {
  steps: InlineStep[];
  stepTitle: string | undefined;
  stepDuration: number | undefined;
}

function collectSteps(logs: A0LogEntry[], responseIndex: number): CollectedSteps {
  const steps: InlineStep[] = [];
  let lastAgentHeading: string | undefined;
  let firstTimestamp: number | undefined;

  // Walk backwards from just before the response to find preceding steps
  for (let i = responseIndex - 1; i >= 0; i--) {
    const log = logs[i];
    // Stop at previous user message
    if (log.type === "user") break;
    // Stop at previous agent-0 response (but include sub-agent responses)
    if (log.type === "response" && log.agentno === 0) break;
    if (!STEP_LOG_TYPES.has(log.type)) continue;

    const heading = cleanHeading(log.heading || "");
    if (!heading) continue;

    const isFiller = THINKING_MESSAGES.includes(heading);
    steps.unshift({
      type: log.type as InlineStep["type"],
      label: LABEL_MAP[log.type] ?? "GEN",
      heading,
      isFiller,
    });

    // Track first timestamp (earliest step)
    if (log.timestamp && (firstTimestamp === undefined || log.timestamp < firstTimestamp)) {
      firstTimestamp = log.timestamp;
    }
  }

  // Find the last "agent" type heading for the ticket title
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].type === "agent") {
      // Strip kitchen role prefix for the title (heading already has GM:/AGM:/Team:)
      lastAgentHeading = steps[i].heading.replace(/^(GM|AGM|Sous Chef|Team):\s*/g, "").trim();
      break;
    }
  }

  // Calculate duration
  const responseLog = logs[responseIndex];
  const stepDuration =
    firstTimestamp !== undefined && responseLog?.timestamp
      ? responseLog.timestamp - firstTimestamp
      : undefined;

  return {
    steps,
    stepTitle: lastAgentHeading,
    stepDuration: stepDuration && stepDuration > 0 ? stepDuration : undefined,
  };
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<string>;
  contextId: string | null;
  loading: boolean;
  queuedMessages: string[];
  resetChat: () => void;
  createNewChat: () => Promise<string | null>;
}

export function useChat(snapshot: A0Snapshot | null): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contextId, setContextId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<string[]>([]);
  const processedLogIds = useRef(new Set<string>());
  const contextIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const isProcessingRef = useRef(false);
  const freshChatRef = useRef(false); // true after resetChat, cleared on first send
  const seenUserMessageRef = useRef(false); // true once any snapshot contains a user log; reset on context switch

  // Keep contextIdRef and messagesRef in sync
  useEffect(() => {
    contextIdRef.current = contextId;
  }, [contextId]);

  // Keep messagesRef in sync so snapshot effect can read messages without a dep
  messagesRef.current = messages;

  useEffect(() => {
    if (!snapshot) return;

    // After resetChat, ignore snapshot logs until the user sends a new message.
    // This prevents stale logs from a previous context from being re-ingested.
    if (freshChatRef.current) {
      setLoading(false);
      return;
    }

    // Detect context switch: if the snapshot's context differs from what we
    // were tracking, clear all local state so stale processedLogIds don't
    // cause the new context's logs to be skipped (log.no values restart per
    // context, so dedup keys like "no-0" would collide).
    if (snapshot.context && contextIdRef.current && snapshot.context !== contextIdRef.current) {
      processedLogIds.current.clear();
      seenUserMessageRef.current = false;
      setMessages([]);
    }

    const newMessages: ChatMessage[] = [];
    const updatedMessages = new Map<string, ChatMessage>();

    // seenUserMessage tracks whether a user log has appeared in this context
    // across ALL snapshots (not just the current one). This handles two cases:
    // 1. Welcome bleed: in the first full snapshot, responses before the user
    //    log are welcome/system greetings and must be suppressed.
    // 2. Incremental streaming: subsequent snapshots may contain only response
    //    updates (no user log). The ref remembers seeing the user log earlier
    //    so these responses are not falsely suppressed.
    let seenUserMessage = seenUserMessageRef.current;

    for (let idx = 0; idx < snapshot.logs.length; idx++) {
      const log = snapshot.logs[idx];
      if (log.type === "user") {
        seenUserMessage = true;
        seenUserMessageRef.current = true;
      }

      // Use log.no as the dedup key — log.id can be null
      const logKey = log.id ?? `no-${log.no}`;

      if (log.type === "user") {
        if (processedLogIds.current.has(logKey)) continue;
        // Skip if we already have this message locally (added on send)
        const alreadyShown = messagesRef.current.some(m => m.role === "user" && m.content === log.content && Math.abs(m.timestamp - log.timestamp) < 5);
        if (!alreadyShown) {
          newMessages.push({
            id: logKey,
            role: "user",
            content: log.content,
            timestamp: log.timestamp,
          });
        }
        processedLogIds.current.add(logKey);
      }

      // Skip non-agent-0 system responses that come before any user message,
      // but allow the first agent-0 response through (the welcome message).
      if (log.type === "response" && !seenUserMessage && log.agentno !== 0) {
        processedLogIds.current.add(logKey);
        continue;
      }

      if (log.type === "response" && log.content.trim() && log.agentno === 0) {
        const { steps, stepTitle, stepDuration } = collectSteps(snapshot.logs, idx);
        const msg: ChatMessage = {
          id: logKey,
          role: "assistant",
          content: log.content,
          timestamp: log.timestamp,
          steps: steps.length > 0 ? steps : undefined,
          stepTitle,
          stepDuration,
        };

        if (processedLogIds.current.has(logKey)) {
          // Already exists — update content in-place for streaming effect
          updatedMessages.set(logKey, msg);
        } else {
          newMessages.push(msg);
          processedLogIds.current.add(logKey);
        }
      }
    }

    // Apply updates: merge new messages and update existing ones in a single pass
    if (newMessages.length > 0 || updatedMessages.size > 0) {
      setMessages(prev => {
        const result = updatedMessages.size > 0
          ? prev.map(m => updatedMessages.get(m.id) ?? m)
          : prev;
        return newMessages.length > 0 ? [...result, ...newMessages] : result;
      });
    }

    if (snapshot.context) {
      setContextId(snapshot.context);
    }

    setLoading(snapshot.log_progress_active);
  }, [snapshot]);

  const doSend = useCallback(async (text: string): Promise<string> => {
    // First message in a fresh chat — start accepting snapshot logs again
    freshChatRef.current = false;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now() / 1000,
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    isProcessingRef.current = true;

    try {
      const csrf = await getCsrfToken();
      const res = await fetch("/message_async", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        credentials: "include",
        body: JSON.stringify({
          text,
          context: contextIdRef.current || "",
        }),
      });

      if (!res.ok) throw new Error(`Agent Zero returned ${res.status}`);

      const data = await res.json();
      const newContextId = data.context || contextIdRef.current;
      if (newContextId) setContextId(newContextId);
      return newContextId || "";
    } catch {
      setLoading(false);
      isProcessingRef.current = false;
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Can't reach the kitchen right now. Make sure Agent Zero is running on port 5000.",
          timestamp: Date.now() / 1000,
        },
      ]);
      return contextIdRef.current || "";
    }
  }, []);

  const sendMessage = useCallback(async (text: string): Promise<string> => {
    if (isProcessingRef.current) {
      // Queue the message instead of blocking
      setQueuedMessages(prev => [...prev, text]);
      // Show the queued message in the chat immediately
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now() / 1000,
      }]);
      return contextIdRef.current || "";
    }
    return doSend(text);
  }, [doSend]);

  // Process queue when loading finishes
  useEffect(() => {
    if (!loading && !isProcessingRef.current) {
      setQueuedMessages(prev => {
        if (prev.length === 0) return prev;
        const [next, ...rest] = prev;
        // Use setTimeout to avoid state update during render
        setTimeout(() => doSend(next), 500);
        return rest;
      });
    }
    if (!loading) {
      isProcessingRef.current = false;
    }
  }, [loading, doSend]);

  const resetChat = useCallback(() => {
    setMessages([]);
    setContextId(null);
    contextIdRef.current = null;
    setLoading(false);
    setQueuedMessages([]);
    isProcessingRef.current = false;
    processedLogIds.current.clear();
    seenUserMessageRef.current = false;
    freshChatRef.current = true;
  }, []);

  // Create a new chat context on A0's side (mirrors A0 UI's chatsStore.newChat)
  const createNewChat = useCallback(async (): Promise<string | null> => {
    try {
      const csrf = await getCsrfToken();
      const res = await fetch("/chat_create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        credentials: "include",
        body: JSON.stringify({
          current_context: contextIdRef.current || "",
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.ok && data.ctxid) {
        resetChat();
        freshChatRef.current = false; // ready to accept logs immediately
        setContextId(data.ctxid);
        contextIdRef.current = data.ctxid;
        return data.ctxid;
      }
      return null;
    } catch (err) {
      console.error("[createNewChat] failed:", err);
      return null;
    }
  }, [resetChat]);

  return { messages, sendMessage, contextId, loading, queuedMessages, resetChat, createNewChat };
}
