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
  const { snapshot, chefStatus, subscribe } = useSocketContext();
  const { messages, sendMessage, loading, queuedMessages } = useChat(snapshot);
  const expo = useExpoStream(snapshot, chefStatus);
  const actionCards = useActionCards();
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    subscribe(contextId);
  }, [contextId, subscribe]);

  const handleSend = async (text: string) => {
    const newCtx = await sendMessage(text);
    if (newCtx) subscribe(newCtx);
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      <TopBar
        unreadCount={actionCards.unreadCount}
        lastCardType={actionCards.lastCardType}
        onBellClick={() => { setNotifOpen(true); actionCards.markAllRead(); }}
      />

      <ChatView
        messages={messages}
        expo={expo}
        onSend={handleSend}
        loading={loading}
        queueCount={queuedMessages.length}
      />

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
