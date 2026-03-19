"use client";

import { MessageList } from "@/components/message-list";
import { ExpoBar } from "@/components/expo-bar";
import { ChatComposer } from "@/components/chat-composer";
import type { ChatMessage } from "@/lib/types";

interface ChatViewProps {
  messages: ChatMessage[];
  expo: { text: string | null; active: boolean };
  onSend: (text: string) => void;
  loading: boolean;
  queueCount?: number;
}

export function ChatView({ messages, expo, onSend, loading, queueCount = 0 }: ChatViewProps) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Message list — fills available space */}
      <MessageList messages={messages} />

      {/* Expo bar — sits between messages and composer */}
      <ExpoBar text={expo.text} active={expo.active} />

      {/* Composer — pinned to bottom */}
      <div className="border-t border-border">
        <ChatComposer onSend={onSend} loading={loading} queueCount={queueCount} />
      </div>
    </div>
  );
}
