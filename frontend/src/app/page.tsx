"use client";

import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";
import { useExpoStream } from "@/hooks/use-expo-stream";
import { useActionCards } from "@/hooks/use-action-cards";
import { TopBar } from "@/components/top-bar";
import { NotificationPanel } from "@/components/notification-panel";
import { ChatView } from "@/components/chat-view";
import { HomeView } from "@/components/home-view";
import { useState } from "react";

export default function HomePage() {
  const { snapshot, chefStatus, subscribe } = useSocketContext();
  const { messages, sendMessage, loading } = useChat(snapshot);
  const expo = useExpoStream(snapshot, chefStatus);
  const { cards, unreadCount } = useActionCards(snapshot);
  const [notifOpen, setNotifOpen] = useState(false);
  const [a0Open, setA0Open] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);

  const handleSend = async (text: string) => {
    if (!chatStarted) setChatStarted(true);
    const contextId = await sendMessage(text);
    if (contextId) subscribe(contextId);
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      <TopBar
        unreadCount={unreadCount}
        onBellClick={() => setNotifOpen(true)}
        onA0Click={() => setA0Open(!a0Open)}
        a0Open={a0Open}
      />

      {!chatStarted ? (
        /* HOME STATE */
        <HomeView onSend={handleSend} />
      ) : (
        /* CHAT STATE */
        <ChatView
          messages={messages}
          expo={expo}
          onSend={handleSend}
          loading={loading}
        />
      )}

      {/* Agent Zero native UI panel */}
      {a0Open && (
        <div className="fixed top-0 right-0 w-[50vw] h-dvh z-50 flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Agent Zero — Back of House
            </span>
            <button
              onClick={() => setA0Open(false)}
              className="text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer text-xl leading-none"
            >
              ✕
            </button>
          </div>
          <iframe
            src="/a0/"
            className="flex-1 w-full border-none bg-background"
            title="Agent Zero UI"
          />
        </div>
      )}

      <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} cards={cards} />
    </div>
  );
}
