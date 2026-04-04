"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { initStateSyncSocket } from "@/lib/socket-client";
import type { ActionCard, ActionCardType, CardChatMessage, A0Notification, RichCardPayload } from "@/lib/types";

const STORAGE_KEY = "cos_action_cards";
const THREAD_STORAGE_KEY = "cos_card_threads";
const STALE_THRESHOLD_SECONDS = 86400; // 24 hours

function readCardsFromStorage(): ActionCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: ActionCard[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now() / 1000;
    return parsed.filter(
      (c) => c.status !== "dismissed" && now - c.timestamp <= STALE_THRESHOLD_SECONDS,
    );
  } catch {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* silent */ }
    return [];
  }
}

function readThreadsFromStorage(): Map<string, CardChatMessage[]> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = sessionStorage.getItem(THREAD_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return new Map();
    return new Map(Object.entries(parsed) as [string, CardChatMessage[]][]);
  } catch {
    try { sessionStorage.removeItem(THREAD_STORAGE_KEY); } catch { /* silent */ }
    return new Map();
  }
}

function writeCardsToStorage(cards: ActionCard[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch { /* silent — storage full or unavailable */ }
}

function writeThreadsToStorage(threads: Map<string, CardChatMessage[]>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(Object.fromEntries(threads)));
  } catch { /* silent */ }
}

const NOTIFICATION_TYPE_MAP: Record<string, ActionCardType> = {
  success: "update",
  warning: "urgent",
  error: "urgent",
  info: "info",
  progress: "info",
};

function parseRichDetail(detail: string | undefined): RichCardPayload | null {
  if (!detail) return null;
  try {
    // A0 may wrap JSON in markdown code fences — strip them
    const cleaned = detail.replace(/^```json?\n?|\n?```$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as RichCardPayload;
    }
  } catch { /* detail is plain text — that's fine */ }
  return null;
}

function notificationToCard(n: A0Notification): ActionCard {
  const rich = parseRichDetail(n.detail);

  return {
    id: n.id,
    type: NOTIFICATION_TYPE_MAP[n.type] ?? "info",
    module: rich?.module ?? n.group ?? "general",
    action: (rich?.action as ActionCard["action"]) ?? "update",
    summary: n.title || n.message,
    detail: rich ? n.message : (n.detail || n.message),
    itemId: rich?.item_id ?? undefined,
    changes: rich?.changes ?? [],
    stats: rich?.stats ?? [],
    actions: rich?.actions ?? undefined,
    priority: n.priority >= 20 ? 1 : 0,
    deadline: rich?.deadline ?? undefined,
    status: "new",
    timestamp: Math.floor(new Date(n.timestamp).getTime() / 1000),
    source: "reactive",
    suggestedAction: rich?.suggested_action ?? undefined,
    suggestedChips: rich?.suggested_chips ?? undefined,
  };
}

interface UrgentBanner {
  count: number;
  earliestDeadline: string;
}

export interface UseActionCardsReturn {
  cards: ActionCard[];
  sortedCards: ActionCard[];
  activeCards: ActionCard[];
  committedCards: ActionCard[];
  unreadCount: number;
  lastCardType: string | undefined;
  urgentBanner: UrgentBanner | null;
  expandedCardId: string | null;
  chatThread: (cardId: string) => CardChatMessage[];
  chatLoading: boolean;
  commitCard: (id: string) => void;
  dismissCard: (id: string) => void;
  sendCardMessage: (id: string, text: string) => void;
  expandCard: (id: string) => void;
  collapseCard: () => void;
  markAllRead: () => void;
}

function sortCards(cards: ActionCard[]): ActionCard[] {
  return [...cards].sort((a, b) => {
    // 0. committed cards always last
    const aCommitted = a.status === "committed" ? 1 : 0;
    const bCommitted = b.status === "committed" ? 1 : 0;
    if (aCommitted !== bCommitted) return aCommitted - bCommitted;
    // 1. priority DESC
    if (b.priority !== a.priority) return b.priority - a.priority;
    // 2. deadline ASC (cards with deadline first, nearest first)
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;
    // 3. timestamp DESC (newest first)
    return b.timestamp - a.timestamp;
  });
}

function computeUrgentBanner(cards: ActionCard[]): UrgentBanner | null {
  const fourHoursMs = 4 * 60 * 60 * 1000;
  const now = Date.now();

  const urgentCards = cards.filter((c) => {
    if (c.priority < 1 || !c.deadline) return false;
    if (c.status === "committed" || c.status === "dismissed") return false;
    const dl = new Date(c.deadline).getTime();
    return dl - now <= fourHoursMs && dl > now;
  });

  if (urgentCards.length === 0) return null;

  const earliest = urgentCards.reduce((min, c) => {
    const dl = new Date(c.deadline!).getTime();
    return dl < min ? dl : min;
  }, Infinity);

  return {
    count: urgentCards.length,
    earliestDeadline: new Date(earliest).toISOString(),
  };
}

export function useActionCards(notifications?: A0Notification[]): UseActionCardsReturn {
  const [cards, setCards] = useState<ActionCard[]>([]);
  const [lastCardType, setLastCardType] = useState<string | undefined>(undefined);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [chatThreads, setChatThreads] = useState<Map<string, CardChatMessage[]>>(new Map());
  const [chatLoading, setChatLoading] = useState(false);
  const listenersAttached = useRef(false);
  const hydrated = useRef(false);

  // Hydrate from sessionStorage on mount (client-only, avoids hydration mismatch)
  useEffect(() => {
    const storedCards = readCardsFromStorage();
    if (storedCards.length > 0) {
      setCards(storedCards);
    }
    const storedThreads = readThreadsFromStorage();
    if (storedThreads.size > 0) {
      setChatThreads(storedThreads);
    }
    hydrated.current = true;
  }, []);

  // Convert incoming A0 notifications into action cards.
  // Tracks which notification IDs have already been ingested to avoid duplicates.
  const seenNotifIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!notifications?.length) return;
    const fresh = notifications.filter(
      (n) => !n.read && !seenNotifIds.current.has(n.id),
    );
    if (fresh.length === 0) return;
    for (const n of fresh) seenNotifIds.current.add(n.id);
    const newCards = fresh.map(notificationToCard);
    setLastCardType(newCards[newCards.length - 1].type);
    setCards((prev) => {
      // Deduplicate by id — prevent duplicate key React warnings
      const existingIds = new Set(prev.map((c) => c.id));
      const unique = newCards.filter((c) => !existingIds.has(c.id));
      return unique.length > 0 ? [...prev, ...unique] : prev;
    });
  }, [notifications]);

  // Persist cards to sessionStorage on every change (after hydration)
  useEffect(() => {
    if (!hydrated.current) return;
    writeCardsToStorage(cards);
  }, [cards]);

  // Persist chat threads to sessionStorage on every change (after hydration)
  useEffect(() => {
    if (!hydrated.current) return;
    writeThreadsToStorage(chatThreads);
  }, [chatThreads]);

  useEffect(() => {
    const socket = initStateSyncSocket();
    if (!socket || listenersAttached.current) return;

    const handleActionCard = (payload: Record<string, unknown>) => {
      // send_data wraps payloads in an envelope: { handlerId, eventId, correlationId, ts, data: {...} }
      // so the card may be at payload.data.card, payload.card, or payload itself
      const envelope = (payload?.data && typeof payload.data === "object") ? payload.data as Record<string, unknown> : payload;
      const incoming = (envelope?.card ?? envelope) as ActionCard | undefined;
      if (!incoming?.type) return; // guard against malformed or empty payloads
      setLastCardType(incoming.type);
      setCards((prev) => {
        const idx = prev.findIndex((c) => c.id === incoming.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = incoming;
          return updated;
        }
        return [...prev, incoming];
      });
    };

    const handleCardReply = (payload: { cardId: string; message: CardChatMessage }) => {
      setChatLoading(false);
      setChatThreads((prev) => {
        const next = new Map(prev);
        const thread = next.get(payload.cardId) ?? [];
        next.set(payload.cardId, [...thread, payload.message]);
        return next;
      });
    };

    socket.on("action_card", handleActionCard);
    socket.on("card_reply", handleCardReply);
    listenersAttached.current = true;

    return () => {
      socket.off("action_card", handleActionCard);
      socket.off("card_reply", handleCardReply);
      listenersAttached.current = false;
    };
  }, []);

  const sortedCards = useMemo(() => sortCards(cards), [cards]);

  const activeCards = useMemo(
    () => sortedCards.filter((c) => c.status !== "committed" && c.status !== "dismissed"),
    [sortedCards],
  );

  const committedCards = useMemo(
    () => sortedCards.filter((c) => c.status === "committed"),
    [sortedCards],
  );

  const unreadCount = useMemo(
    () => cards.filter((c) => c.status === "new").length,
    [cards],
  );

  const urgentBanner = useMemo(() => computeUrgentBanner(cards), [cards]);

  const commitCard = useCallback((id: string) => {
    const socket = initStateSyncSocket();
    socket?.emit("card_commit", { cardId: id });
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "committed" as const } : c)),
    );
    setChatThreads((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const dismissCard = useCallback((id: string) => {
    const socket = initStateSyncSocket();
    socket?.emit("card_dismiss", { cardId: id });
    setCards((prev) => prev.filter((c) => c.id !== id));
    setChatThreads((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const sendCardMessage = useCallback((id: string, text: string) => {
    const socket = initStateSyncSocket();

    // Find the card to include context for A0 processing
    const card = cards.find((c) => c.id === id);
    const cardContext = card
      ? { summary: card.summary, module: card.module, type: card.type, detail: card.detail }
      : undefined;

    socket?.emit("card_message", { cardId: id, text, card: cardContext });

    const userMsg: CardChatMessage = {
      role: "user",
      text,
      timestamp: Date.now() / 1000,
    };
    setChatThreads((prev) => {
      const next = new Map(prev);
      const thread = next.get(id) ?? [];
      next.set(id, [...thread, userMsg]);
      return next;
    });
    setChatLoading(true);
  }, [cards]);

  const chatThread = useCallback(
    (cardId: string) => chatThreads.get(cardId) ?? [],
    [chatThreads],
  );

  const expandCard = useCallback((id: string) => {
    setExpandedCardId(id);
  }, []);

  const collapseCard = useCallback(() => {
    setExpandedCardId(null);
  }, []);

  const markAllRead = useCallback(() => {
    setCards((prev) =>
      prev.map((c) => (c.status === "new" ? { ...c, status: "read" as const } : c)),
    );
  }, []);

  return {
    cards,
    sortedCards,
    activeCards,
    committedCards,
    unreadCount,
    lastCardType,
    urgentBanner,
    expandedCardId,
    chatThread,
    chatLoading,
    commitCard,
    dismissCard,
    sendCardMessage,
    expandCard,
    collapseCard,
    markAllRead,
  };
}
