"use client";

import { useRouter } from "next/navigation";
import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";
import { useActionCards } from "@/hooks/use-action-cards";
import { TopBar } from "@/components/top-bar";
import { HomeView } from "@/components/home-view";
import { NotificationPanel } from "@/components/notification-panel";
import { useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const { snapshot, subscribe } = useSocketContext();
  const { sendMessage } = useChat(snapshot);
  const { cards, unreadCount } = useActionCards(snapshot);
  const [notifOpen, setNotifOpen] = useState(false);

  const handleSend = async (text: string) => {
    const contextId = await sendMessage(text);
    subscribe(contextId);
    router.push(`/chat/${contextId}`);
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      <TopBar unreadCount={unreadCount} onBellClick={() => setNotifOpen(true)} />
      <main className="flex-1 flex items-center justify-center">
        <HomeView onSend={handleSend} />
      </main>
      <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} cards={cards} />
    </div>
  );
}
