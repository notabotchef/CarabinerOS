"use client";

import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";
import { useActionCards } from "@/hooks/use-action-cards";
import { TopBar } from "@/components/top-bar";
import { NotificationPanel } from "@/components/notification-panel";
import { HomeView } from "@/components/home-view";
import { useShell } from "@/components/shell";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const { newChatPending, consumeNewChat } = useShell();
  const { snapshot, subscribe } = useSocketContext();
  const { sendMessage, resetChat, createNewChat } = useChat(snapshot);
  const actionCards = useActionCards();
  const [notifOpen, setNotifOpen] = useState(false);
  const creatingChatRef = useRef(false);
  const sendingRef = useRef(false);

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

  // Unsubscribe from any previous context and reset chat state when the
  // home page mounts so stale contextId from a prior session is cleared.
  useEffect(() => {
    subscribeRef.current(null);
    resetChatRef.current();
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
          // Navigate to the dedicated chat page so subscription, streaming,
          // and message processing are handled by /chat/[contextId]/page.tsx
          router.push(`/chat/${newCtxId}`);
        } else {
          // Fallback: just reset locally if A0 is unreachable
          resetChatRef.current();
          subscribeRef.current(null);
        }
      } finally {
        creatingChatRef.current = false;
      }
    })();
  }, [newChatPending, router]);

  const handleSend = async (text: string) => {
    // Guard against double-fire (M2: duplicate user message on first send)
    if (sendingRef.current) return;
    sendingRef.current = true;

    try {
      // Homepage ALWAYS creates a fresh chat context before sending (C4 fix).
      // Any stale contextId from a prior session is irrelevant here.
      const ctxId = await createNewChat();
      if (ctxId) {
        subscribe(ctxId);
      }
      await sendMessage(text);
      if (ctxId) {
        router.push(`/chat/${ctxId}`);
      }
    } finally {
      sendingRef.current = false;
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      <TopBar
        unreadCount={actionCards.unreadCount}
        lastCardType={actionCards.lastCardType}
        onBellClick={() => { setNotifOpen(true); actionCards.markAllRead(); }}
      />

      <HomeView onSend={handleSend} />

      <NotificationPanel
        open={notifOpen}
        onOpenChange={setNotifOpen}
        cards={actionCards.sortedCards}
        urgentBanner={actionCards.urgentBanner}
        unreadCount={actionCards.unreadCount}
        expandedCardId={actionCards.expandedCardId}
        expandedCard={actionCards.expandedCardId ? actionCards.sortedCards.find(c => c.id === actionCards.expandedCardId) ?? null : null}
        chatThread={actionCards.chatThread}
        chatLoading={actionCards.chatLoading}
        onExpand={actionCards.expandCard}
        onCollapse={actionCards.collapseCard}
        onCommit={actionCards.commitCard}
        onDismiss={actionCards.dismissCard}
        onSendMessage={actionCards.sendCardMessage}
      />
    </div>
  );
}
