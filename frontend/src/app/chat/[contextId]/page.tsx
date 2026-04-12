"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";
import { useExpoStream } from "@/hooks/use-expo-stream";
import { ChatView } from "@/components/chat-view";

export default function ChatPage() {
  const params = useParams();
  const contextId = params.contextId as string;
  const { snapshot, chefStatus, subscribe } = useSocketContext();
  const { messages, sendMessage, loading, queuedMessages } = useChat(snapshot);
  const expo = useExpoStream(snapshot, chefStatus);

  useEffect(() => {
    subscribe(contextId);
  }, [contextId, subscribe]);

  const handleSend = async (text: string) => {
    const newCtx = await sendMessage(text);
    if (newCtx) subscribe(newCtx);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      <ChatView
        messages={messages}
        expo={expo}
        onSend={handleSend}
        loading={loading}
        queueCount={queuedMessages.length}
        contextId={contextId}
      />
    </div>
  );
}
