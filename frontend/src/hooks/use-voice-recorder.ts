"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecordingState = "idle" | "recording" | "transcribing";

interface UseVoiceRecorderOptions {
  contextId: string;
  maxDurationMs?: number;
  onTranscript: (text: string) => void;
  onError: (error: string) => void;
}

interface UseVoiceRecorderReturn {
  state: RecordingState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  elapsedMs: number;
}

async function transcribeAudio(
  base64Audio: string,
  contextId: string,
): Promise<string> {
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio: base64Audio, ctxid: contextId }),
  });
  if (!res.ok) {
    throw new Error(`Transcription request failed: ${res.status}`);
  }
  const data = await res.json();
  return data.text ?? "";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (e.g. "data:audio/webm;base64,")
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useVoiceRecorder(
  options: UseVoiceRecorderOptions,
): UseVoiceRecorderReturn {
  const { contextId, maxDurationMs = 60_000, onTranscript, onError } = options;

  const [state, setState] = useState<RecordingState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<RecordingState>("idle");

  // Keep stateRef in sync for use in callbacks
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setElapsedMs(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const processRecording = useCallback(
    async (chunks: Blob[], mimeType: string) => {
      setState("transcribing");
      try {
        const blob = new Blob(chunks, { type: mimeType });
        const base64 = await blobToBase64(blob);
        const text = await transcribeAudio(base64, contextId);
        if (!text.trim()) {
          onError("No speech detected. Please try again.");
          setState("idle");
          return;
        }
        onTranscript(text);
        setState("idle");
      } catch {
        onError("Transcription failed. Please try again.");
        setState("idle");
      }
    },
    [contextId, onTranscript, onError],
  );

  const stopRecording = useCallback(() => {
    if (stateRef.current !== "recording") return;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (stateRef.current !== "recording") return;
    // Stop without processing
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      // Remove the onstop handler so it doesn't process
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    setState("idle");
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    if (stateRef.current !== "idle") return;

    // Check for MediaRecorder support
    if (typeof MediaRecorder === "undefined") {
      onError("Your browser does not support audio recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const chunks = [...chunksRef.current];
        const mimeType = recorder.mimeType || "audio/webm";
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        processRecording(chunks, mimeType);
      };

      recorder.start();
      setState("recording");
      startTimeRef.current = Date.now();
      setElapsedMs(0);

      // Elapsed timer
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 100);

      // Auto-stop at max duration
      maxTimerRef.current = setTimeout(() => {
        stopRecording();
      }, maxDurationMs);
    } catch {
      onError(
        "Microphone access denied. Please allow microphone permission in your browser settings.",
      );
      cleanup();
      setState("idle");
    }
  }, [onError, maxDurationMs, cleanup, processRecording, stopRecording]);

  return {
    state,
    startRecording,
    stopRecording,
    cancelRecording,
    elapsedMs,
  };
}
