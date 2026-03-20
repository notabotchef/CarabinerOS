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
  const { messages, sendMessage, loading, queuedMessages, resetChat, createNewChat, contextId } = useChat(snapshot);
  const expo = useExpoStream(snapshot, chefStatus);
  const { cards, unreadCount } = useActionCards(snapshot);
  const [notifOpen, setNotifOpen] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const creatingChatRef = useRef(false);

  // Stable refs for callbacks — updated every render so the effect never needs
  // them in its dependency array, which prevents re-firing when references change.
  const createNewChatRef = useRef(createNewChat);
  const subscribeRef = useRef(subscribe);
  const resetChatRef = useRef(resetChat);
  const consumeNewChatRef = useRef(consumeNewChat);
  createNewChatRef.current = createNewChat;
  subscribeRef.current = subscribe;
  resetChatRef.current = resetChat;
  consumeNewChatRef.current = consumeNewChat;

  // Unsubscribe from any previous context when the home page mounts
  useEffect(() => {
    subscribeRef.current(null);
  }, []);

  // When a new chat is requested (from sidebar "+" button), create it on A0's side.
  // Depend only on newChatPending so unstable callback references can't re-trigger this.
  useEffect(() => {
    if (!newChatPending) return;
    if (creatingChatRef.current) return; // prevent double-fire
    consumeNewChatRef.current();
    creatingChatRef.current = true;
    (async () => {
      try {
        const newCtxId = await createNewChatRef.current();
        if (newCtxId) {
          subscribeRef.current(newCtxId);
        } else {
          // Fallback: just reset locally if A0 is unreachable
          resetChatRef.current();
          subscribeRef.current(null);
        }
        setChatStarted(true);
      } finally {
        creatingChatRef.current = false;
      }
    })();
  }, [newChatPending]);

  const handleSend = async (text: string) => {
    // Only create a new chat if one doesn't already exist (e.g. from the "+" flow)
    let ctxId = contextId;
    if (!ctxId) {
      ctxId = await createNewChat();
      if (ctxId) {
        subscribe(ctxId);
      }
    }
    await sendMessage(text);
    setChatStarted(true);
    if (ctxId) {
      router.push(`/chat/${ctxId}`);
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
