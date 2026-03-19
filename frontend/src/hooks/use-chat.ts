"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { A0Snapshot, ChatMessage } from "@/lib/types";
import { getCsrfToken } from "@/lib/csrf";

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<string>;
  contextId: string | null;
  loading: boolean;
}

export function useChat(snapshot: A0Snapshot | null): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contextId, setContextId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const processedLogIds = useRef(new Set<string>());

  useEffect(() => {
    if (!snapshot) return;

    const newMessages: ChatMessage[] = [];

    for (const log of snapshot.logs) {
      if (processedLogIds.current.has(log.id)) continue;

      if (log.type === "user") {
        newMessages.push({
          id: log.id,
          role: "user",
          content: log.content,
          timestamp: log.timestamp,
        });
        processedLogIds.current.add(log.id);
      }

      if (log.type === "response" && log.content.trim()) {
        newMessages.push({
          id: log.id,
          role: "assistant",
          content: log.content,
          timestamp: log.timestamp,
        });
        processedLogIds.current.add(log.id);
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

  const sendMessage = useCallback(async (text: string): Promise<string> => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now() / 1000,
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

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
          context: contextId || "",
        }),
      });

      if (!res.ok) throw new Error(`Agent Zero returned ${res.status}`);

      const data = await res.json();
      const newContextId = data.context || contextId;
      if (newContextId) setContextId(newContextId);
      return newContextId || "";
    } catch {
      setLoading(false);
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Can't reach the kitchen right now. Make sure Agent Zero is running on port 5000.",
          timestamp: Date.now() / 1000,
        },
      ]);
      return contextId || "";
    }
  }, [contextId]);

  return { messages, sendMessage, contextId, loading };
}
