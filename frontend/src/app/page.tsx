"use client";

import { useSocketContext } from "@/components/socket-provider";
import { useChat } from "@/hooks/use-chat";
import { useExpoStream } from "@/hooks/use-expo-stream";
import { useActionCards } from "@/hooks/use-action-cards";
import { TopBar } from "@/components/top-bar";
import { NotificationPanel } from "@/components/notification-panel";
import { ChatComposer } from "@/components/chat-composer";
import { ChatView } from "@/components/chat-view";
import { SolitaireCards } from "@/components/solitaire-cards";
import { useState, useEffect } from "react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning, Chef";
  if (hour < 17) return "Good afternoon, Chef";
  return "Good evening, Chef";
}

export default function HomePage() {
  const { snapshot, chefStatus, subscribe } = useSocketContext();
  const { messages, sendMessage, loading } = useChat(snapshot);
  const expo = useExpoStream(snapshot, chefStatus);
  const { cards, unreadCount } = useActionCards(snapshot);
  const [notifOpen, setNotifOpen] = useState(false);
  const [a0Open, setA0Open] = useState(false);
  const [greeting, setGreeting] = useState("Welcome, Chef");
  const [chatStarted, setChatStarted] = useState(false);

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const handleSend = async (text: string) => {
    if (!chatStarted) setChatStarted(true);
    const contextId = await sendMessage(text);
    if (contextId) subscribe(contextId);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar
        unreadCount={unreadCount}
        onBellClick={() => setNotifOpen(true)}
        onA0Click={() => setA0Open(!a0Open)}
        a0Open={a0Open}
      />

      {!chatStarted ? (
        /* HOME STATE */
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          padding: "2rem",
          background: "white",
        }}>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 700, color: "#171717", marginBottom: "0.5rem" }}>
            {greeting}
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#a3a3a3", marginBottom: "2rem", textAlign: "center" }}>
            3 orders pending · food cost at 28.4% · 142 covers projected
          </p>
          <div style={{ width: "100%", maxWidth: "500px" }}>
            <ChatComposer onSend={handleSend} placeholder="Ask CarabinerOS anything…" />
          </div>
          <SolitaireCards />
        </div>
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
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "50vw",
          height: "100vh",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px",
            backgroundColor: "#1a1a1a",
            borderBottom: "1px solid #333",
          }}>
            <span style={{ color: "#a3a3a3", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Agent Zero — Back of House
            </span>
            <button
              onClick={() => setA0Open(false)}
              style={{ color: "#a3a3a3", background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
          <iframe
            src="/a0/"
            style={{ flex: 1, width: "100%", border: "none", backgroundColor: "#111" }}
            title="Agent Zero UI"
          />
        </div>
      )}

      <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} cards={cards} />
    </div>
  );
}
