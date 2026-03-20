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
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const { newChatPending, consumeNewChat } = useShell();
  const { snapshot, chefStatus, subscribe } = useSocketContext();
  const { messages, sendMessage, loading, queuedMessages, resetChat, createNewChat } = useChat(snapshot);
  const expo = useExpoStream(snapshot, chefStatus);
  const { cards, unreadCount } = useActionCards(snapshot);
  const [notifOpen, setNotifOpen] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const creatingChatRef = useRef(false);

  // Unsubscribe from any previous context when the home page mounts
  useEffect(() => {
    subscribe(null);
  }, [subscribe]);

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
    const newCtxId = await createNewChat();
    if (newCtxId) {
      subscribe(newCtxId);
    }
    await sendMessage(text);
    setChatStarted(true);
    if (newCtxId) {
      router.push(`/chat/${newCtxId}`);
    }
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
