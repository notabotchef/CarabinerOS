"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { A0Snapshot, ChatMessage } from "@/lib/types";

const A0_URL = process.env.NEXT_PUBLIC_A0_URL || "";

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

    const res = await fetch(`${A0_URL}/message_async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        text,
        context: contextId || "",
      }),
    });

    const data = await res.json();
    const newContextId = data.context || contextId;
    if (newContextId) setContextId(newContextId);
    return newContextId;
  }, [contextId]);

  return { messages, sendMessage, contextId, loading };
}
