"use client";

import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";
import { useExpoStream } from "@/hooks/use-expo-stream";
import { useActionCards } from "@/hooks/use-action-cards";
import { TopBar } from "@/components/top-bar";
import { NotificationPanel } from "@/components/notification-panel";
import { ChatView } from "@/components/chat-view";
import { HomeView } from "@/components/home-view";
import { useShell } from "@/components/shell";
import { useState, useEffect, useRef } from "react";

export default function HomePage() {
  const { newChatPending, consumeNewChat } = useShell();
  const { snapshot, chefStatus, subscribe } = useSocketContext();
  const { messages, sendMessage, loading, queuedMessages, resetChat, createNewChat } = useChat(snapshot);
  const expo = useExpoStream(snapshot, chefStatus);
  const { cards, unreadCount } = useActionCards(snapshot);
  const [notifOpen, setNotifOpen] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const creatingChatRef = useRef(false);

  // When a new chat is requested (from sidebar "+" button), create it on A0's side
  useEffect(() => {
    if (!newChatPending) return;
    if (creatingChatRef.current) return; // prevent double-fire
    consumeNewChat();
    creatingChatRef.current = true;
    (async () => {
      try {
        const newCtxId = await createNewChat();
        if (newCtxId) {
          subscribe(newCtxId);
        } else {
          // Fallback: just reset locally if A0 is unreachable
          resetChat();
          subscribe(null);
        }
        setChatStarted(true);
      } finally {
        creatingChatRef.current = false;
      }
    })();
  }, [newChatPending, createNewChat, resetChat, consumeNewChat, subscribe]);

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
          queueCount={queuedMessages.length}
        />
      )}

      <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} cards={cards} />
    </div>
  );
}
