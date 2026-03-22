"use client";

import { useState } from "react";
import { MessageList } from "@/components/message-list";
import { ThoughtsStream } from "@/components/thoughts-stream";
import { ExpoTicket } from "@/components/expo-ticket";
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
  const [ticketExpanded, setTicketExpanded] = useState(false);
  const hasTicket = expo.ticketSteps.length > 0;
  // Auto-expand the ticket while A0 is actively processing so users see
  // the step-by-step log in real-time (H2 fix: expo whispering).
  const effectiveTicketExpanded = expo.active ? hasTicket : (ticketExpanded && hasTicket);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <MessageList messages={messages} />

      {/* Thoughts stream — ghostly inner monologue above expo bar */}
      <ThoughtsStream thoughts={expo.thoughts} active={expo.active} />

      {/* Expo ticket — expandable step list */}
      <ExpoTicket steps={expo.ticketSteps} expanded={effectiveTicketExpanded} />

      {/* Expo bar — real status text */}
      <ExpoBar
        text={expo.text}
        active={expo.active}
        hasTicket={hasTicket}
        ticketExpanded={effectiveTicketExpanded}
        onToggleTicket={() => setTicketExpanded((v) => !v)}
      />

      <div className="border-t border-border/50">
        <ChatComposer onSend={onSend} loading={loading} queueCount={queueCount} />
      </div>
    </div>
  );
}
