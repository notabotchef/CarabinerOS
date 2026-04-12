"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type TtsState = "idle" | "loading" | "playing";

interface UseTtsOptions {
  contextId: string;
}

interface UseTtsReturn {
  state: TtsState;
  currentMessageId: string | null;
  play: (messageId: string, text: string) => Promise<void>;
  stop: () => void;
}

/** Strip markdown formatting before sending to TTS */
function stripMarkdown(text: string): string {
  return (
    text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, "")
      // Remove inline code
      .replace(/`[^`]*`/g, "")
      // Remove headings
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
      // Remove links — keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Remove blockquotes
      .replace(/^>\s+/gm, "")
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Collapse whitespace
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim()
  );
}

export function useTts(options: UseTtsOptions): UseTtsReturn {
  const { contextId } = options;

  const [state, setState] = useState<TtsState>("idle");
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    setState("idle");
    setCurrentMessageId(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current = null;
      }
    };
  }, []);

  const play = useCallback(
    async (messageId: string, text: string) => {
      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current = null;
      }

      const cleanText = stripMarkdown(text);
      if (!cleanText) {
        setState("idle");
        setCurrentMessageId(null);
        return;
      }

      setState("loading");
      setCurrentMessageId(messageId);

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText, ctxid: contextId }),
          signal: controller.signal,
        });

        if (!res.ok) {
          setState("idle");
          setCurrentMessageId(null);
          return;
        }

        const data = await res.json();

        if (!data.success || !data.audio) {
          setState("idle");
          setCurrentMessageId(null);
          return;
        }

        const dataUrl = `data:audio/wav;base64,${data.audio}`;
        const audio = new Audio(dataUrl);
        audioRef.current = audio;

        audio.addEventListener("ended", () => {
          setState("idle");
          setCurrentMessageId(null);
          audioRef.current = null;
        });

        audio.addEventListener("error", () => {
          setState("idle");
          setCurrentMessageId(null);
          audioRef.current = null;
        });

        await audio.play();
        setState("playing");
      } catch {
        setState("idle");
        setCurrentMessageId(null);
      }
    },
    [contextId],
  );

  return {
    state,
    currentMessageId,
    play,
    stop,
  };
}
