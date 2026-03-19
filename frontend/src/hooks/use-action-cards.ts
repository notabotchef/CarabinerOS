"use client";

import { useState, useEffect, useRef } from "react";
import type { A0Snapshot, ActionCard } from "@/lib/types";

interface UseActionCardsReturn {
  cards: ActionCard[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export function useActionCards(snapshot: A0Snapshot | null): UseActionCardsReturn {
  const [cards, setCards] = useState<ActionCard[]>([]);
  const processedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!snapshot) return;

    for (const log of snapshot.logs) {
      if (processedIds.current.has(log.id)) continue;
      if (log.type !== "tool") continue;

      const kvps = log.kvps || {};
      if (kvps.module && kvps.action) {
        const card: ActionCard = {
          id: log.id,
          type: String(kvps.action),
          module: String(kvps.module),
          action: String(kvps.action),
          itemId: kvps.item_id ? String(kvps.item_id) : undefined,
          item: kvps.item as Record<string, unknown> | undefined,
          summary: log.content.slice(0, 120),
          timestamp: log.timestamp,
          read: false,
        };
        setCards(prev => [...prev, card]);
        processedIds.current.add(log.id);
      }
    }
  }, [snapshot]);

  const unreadCount = cards.filter(c => !c.read).length;

  const markRead = (id: string) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, read: true } : c));
  };

  const markAllRead = () => {
    setCards(prev => prev.map(c => ({ ...c, read: true })));
  };

  return { cards, unreadCount, markRead, markAllRead };
}
