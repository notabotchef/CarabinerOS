"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";
import { useExpoStream } from "@/hooks/use-expo-stream";
import { useActionCards } from "@/hooks/use-action-cards";
import { TopBar } from "@/components/top-bar";
import { ChatView } from "@/components/chat-view";
import { NotificationPanel } from "@/components/notification-panel";
import { useShell } from "@/components/shell";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const contextId = params.contextId as string;
  const { openSidebar } = useShell();
  const { snapshot, chefStatus, connected, subscribe } = useSocketContext();
  const { messages, sendMessage, loading, queuedMessages } = useChat(snapshot);
  const expo = useExpoStream(snapshot, chefStatus);
  const { cards, unreadCount } = useActionCards(snapshot);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    subscribe(contextId);
  }, [contextId, subscribe]);

  const handleSend = async (text: string) => {
    const newCtx = await sendMessage(text);
    if (newCtx) subscribe(newCtx);
  };

  // If socket connected but no messages arrived yet, show loading
  const waitingForHistory = connected && messages.length === 0 && !loading;

  return (
    <div className="flex flex-col h-dvh bg-background">
      <TopBar
        unreadCount={unreadCount}
        onBellClick={() => setNotifOpen(true)}
      />

      {waitingForHistory ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground/50">Loading conversation...</p>
        </div>
      ) : (
        <ChatView
          messages={messages}
          expo={expo}
          onSend={handleSend}
          loading={loading}
          queueCount={queuedMessages.length}
        />
      )}

      <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} cards={cards} />
    </div>
  );
}
