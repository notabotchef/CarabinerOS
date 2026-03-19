"use client";

import { ChatComposer } from "@/components/chat-composer";
import { SolitaireCards } from "@/components/solitaire-cards";

interface HomeViewProps {
  onSend: (text: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning, Chef";
  if (hour < 17) return "Good afternoon, Chef";
  return "Good evening, Chef";
}

export function HomeView({ onSend }: HomeViewProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-xl mx-auto px-4">
      {/* Welcome text */}
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 mb-2">
        {getGreeting()}
      </h1>
      <p className="text-sm text-neutral-400 mb-8 text-center leading-relaxed">
        3 orders pending &middot; food cost at 28.4% &middot; 142 covers projected
      </p>

      {/* Composer */}
      <div className="w-full max-w-[500px]">
        <ChatComposer onSend={onSend} placeholder="Ask CarabinerOS anything\u2026" />
      </div>

      {/* Solitaire KPI cards */}
      <SolitaireCards />
    </div>
  );
}
