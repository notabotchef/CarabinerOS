"use client";

import { MessageList } from "@/components/message-list";
import { ThoughtsStream } from "@/components/thoughts-stream";
import { ExpoBar } from "@/components/expo-bar";
import { ChatComposer } from "@/components/chat-composer";
import type { ChatMessage } from "@/lib/types";
import type { ExpoState } from "@/hooks/use-expo-stream";

interface ChatViewProps {
  messages: ChatMessage[];
  expo: ExpoState;
  onSend: (text: string) => void;
  loading: boolean;
  queueCount?: number;
}

export function ChatView({ messages, expo, onSend, loading, queueCount = 0 }: ChatViewProps) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <MessageList messages={messages} />

      {/* Thoughts stream — ghostly inner monologue above expo bar */}
      <ThoughtsStream thoughts={expo.thoughts} active={expo.active} />

      {/* Expo bar — real status text */}
      <ExpoBar text={expo.text} active={expo.active} />

      <div className="border-t border-border">
        <ChatComposer onSend={onSend} loading={loading} queueCount={queueCount} />
      </div>
    </div>
  );
}
