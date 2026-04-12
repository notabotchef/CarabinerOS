"use client";

import { Volume2, VolumeX, Loader2 } from "lucide-react";
import type { TtsState } from "@/hooks/use-tts";

interface MessageTtsButtonProps {
  messageId: string;
  text: string;
  ttsState: TtsState;
  currentMessageId: string | null;
  onPlay: (messageId: string, text: string) => Promise<void>;
  onStop: () => void;
}

export function MessageTtsButton({
  messageId,
  text,
  ttsState,
  currentMessageId,
  onPlay,
  onStop,
}: MessageTtsButtonProps) {
  // Hide if message has no text content
  if (!text.trim()) return null;

  const isThisMessage = currentMessageId === messageId;
  const isLoading = isThisMessage && ttsState === "loading";
  const isPlaying = isThisMessage && ttsState === "playing";
  const isOtherLoading = !isThisMessage && ttsState === "loading";

  if (isLoading) {
    return (
      <button
        disabled
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground/40"
        title="Loading audio..."
      >
        <Loader2 className="size-3.5 animate-spin" />
      </button>
    );
  }

  if (isPlaying) {
    return (
      <button
        onClick={onStop}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        title="Stop playback"
      >
        <VolumeX className="size-3.5" />
      </button>
    );
  }

  // idle — show play button (disabled if another message is loading)
  return (
    <button
      onClick={() => onPlay(messageId, text)}
      disabled={isOtherLoading}
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 transition-colors"
      title="Play as audio"
    >
      <Volume2 className="size-3.5" />
    </button>
  );
}
