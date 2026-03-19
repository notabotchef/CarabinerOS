"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";
import { useExpoStream } from "@/hooks/use-expo-stream";
import { useActionCards } from "@/hooks/use-action-cards";
import { TopBar } from "@/components/top-bar";
import { ChatView } from "@/components/chat-view";
import { NotificationPanel } from "@/components/notification-panel";

export default function ChatPage() {
  const params = useParams();
  const contextId = params.contextId as string;
  const { snapshot, subscribe } = useSocketContext();
  const { messages, sendMessage, loading } = useChat(snapshot);
  const expo = useExpoStream(snapshot);
  const { cards, unreadCount } = useActionCards(snapshot);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    subscribe(contextId);
  }, [contextId, subscribe]);

  const handleSend = async (text: string) => {
    await sendMessage(text);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <TopBar unreadCount={unreadCount} onBellClick={() => setNotifOpen(true)} />
      <ChatView
        messages={messages}
        expo={expo}
        onSend={handleSend}
        loading={loading}
      />
      <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} cards={cards} />
    </div>
  );
}
