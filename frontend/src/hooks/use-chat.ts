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
  "Checking if Rene Redzepi already paid the interns",
  "Cross-referencing your wine list with last night\u2019s dreams",
  "Consulting the mise en place oracle",
  "Running the numbers through the pasta machine",
  "Asking the walk-in for its opinion",
  "Debating butter quantities with the saucier",
  "Checking the reservation book for ghosts",
  "Calibrating the flavor compass",
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
  const isProcessingRef = useRef(false);
  const freshChatRef = useRef(false); // true after resetChat, cleared on first send

  // Keep contextIdRef in sync
  useEffect(() => {
    contextIdRef.current = contextId;
  }, [contextId]);

  useEffect(() => {
    if (!snapshot) return;

    // After resetChat, ignore snapshot logs until the user sends a new message.
    // This prevents stale logs from a previous context from being re-ingested.
    if (freshChatRef.current) {
      setLoading(false);
      return;
    }

    const newMessages: ChatMessage[] = [];

    for (let idx = 0; idx < snapshot.logs.length; idx++) {
      const log = snapshot.logs[idx];
      // Use log.no as the dedup key — log.id can be null
      const logKey = log.id ?? `no-${log.no}`;
      if (processedLogIds.current.has(logKey)) continue;

      if (log.type === "user") {
        newMessages.push({
          id: logKey,
          role: "user",
          content: log.content,
          timestamp: log.timestamp,
        });
        processedLogIds.current.add(logKey);
      }

      if (log.type === "response" && log.content.trim() && log.agentno === 0) {
        const { steps, stepTitle, stepDuration } = collectSteps(snapshot.logs, idx);
        newMessages.push({
          id: logKey,
          role: "assistant",
          content: log.content,
          timestamp: log.timestamp,
          steps: steps.length > 0 ? steps : undefined,
          stepTitle,
          stepDuration,
        });
        processedLogIds.current.add(logKey);
      }
    }

    if (newMessages.length > 0) {
      setMessages(prev => [...prev, ...newMessages]);
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
    } catch {
      return null;
    }
  }, [resetChat]);

  return { messages, sendMessage, contextId, loading, queuedMessages, resetChat, createNewChat };
}
