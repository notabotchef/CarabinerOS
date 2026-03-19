"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { A0Snapshot, ChatMessage } from "@/lib/types";
import { getCsrfToken } from "@/lib/csrf";

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<string>;
  contextId: string | null;
  loading: boolean;
  queuedMessages: string[];
  resetChat: () => void;
}

export function useChat(snapshot: A0Snapshot | null): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contextId, setContextId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<string[]>([]);
  const processedLogIds = useRef(new Set<string>());
  const contextIdRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);

  // Keep contextIdRef in sync
  useEffect(() => {
    contextIdRef.current = contextId;
  }, [contextId]);

  useEffect(() => {
    if (!snapshot) return;

    const newMessages: ChatMessage[] = [];

    for (const log of snapshot.logs) {
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

      if (log.type === "response" && log.content.trim()) {
        newMessages.push({
          id: logKey,
          role: "assistant",
          content: log.content,
          timestamp: log.timestamp,
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
  }, []);

  return { messages, sendMessage, contextId, loading, queuedMessages, resetChat };
}
