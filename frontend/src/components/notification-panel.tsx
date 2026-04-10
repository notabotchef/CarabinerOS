"use client";

import { AnimatePresence, motion } from "motion/react";
import { Inbox } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ActionCard } from "@/components/action-card";
import { ActionCardExpanded } from "@/components/action-card-expanded";
import type { ActionCard as ActionCardType, CardChatMessage } from "@/lib/types";

// --- Animation configs: KDS ticket rail ---
// Fast, precise, no flourish. Tickets land on the rail like paper hitting steel.

const CARD_ENTER = {
  initial: { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: 60 },
  transition: { type: "spring" as const, stiffness: 500, damping: 35 },
};

interface UrgentBanner {
  count: number;
  earliestDeadline: string;
}

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: ActionCardType[];
  urgentBanner: UrgentBanner | null;
  unreadCount: number;
  expandedCardId: string | null;
  expandedCard: ActionCardType | null;
  chatThread: (cardId: string) => CardChatMessage[];
  chatLoading: boolean;
  onExpand: (id: string) => void;
  onCollapse: () => void;
  onCommit: (id: string) => void;
  onDismiss: (id: string) => void;
  onSendMessage: (id: string, text: string) => void;
}

function formatBannerDeadline(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function NotificationPanel({
  open,
  onOpenChange,
  cards,
  urgentBanner,
  unreadCount,
  expandedCardId,
  expandedCard,
  chatThread,
  chatLoading,
  onExpand,
  onCollapse,
  onCommit,
  onDismiss,
  onSendMessage,
}: NotificationPanelProps) {
  const activeCards = cards
    .filter((c) => c.status !== "dismissed" && c.status !== "committed")
    // Briefing cards pin to the top of the grid
    .sort((a, b) => (a.module === "briefing" ? -1 : b.module === "briefing" ? 1 : 0));
  const committedCards = cards.filter((c) => c.status === "committed");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="w-[460px] sm:max-w-[460px] p-0 flex flex-col">
        {expandedCardId && expandedCard ? (
          /* --- EXPANDED VIEW --- */
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex flex-col h-full"
          >
            <ActionCardExpanded
              card={expandedCard}
              chatThread={chatThread(expandedCard.id)}
              chatLoading={chatLoading}
              onBack={onCollapse}
              onCommit={onCommit}
              onDismiss={onDismiss}
              onSendMessage={onSendMessage}
            />
          </motion.div>
        ) : (
          /* --- GRID VIEW --- */
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="border-b border-border/60 px-5 py-4 shrink-0">
              <SheetTitle className="text-base font-bold font-mono uppercase tracking-wider">
                Tickets
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground/60 font-mono">
                {activeCards.length === 0 && committedCards.length === 0
                  ? "All clear -- kitchen is clean"
                  : `${unreadCount > 0 ? `${unreadCount} new` : "0 new"} / ${activeCards.length} open`}
              </SheetDescription>
            </SheetHeader>

            {/* Urgency banner */}
            {urgentBanner && (
              <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-[11px] font-bold text-amber-400 font-mono uppercase tracking-wider">
                  {urgentBanner.count === 1
                    ? `FIRE -- 1 ticket before ${formatBannerDeadline(urgentBanner.earliestDeadline)}`
                    : `FIRE -- ${urgentBanner.count} tickets, earliest ${formatBannerDeadline(urgentBanner.earliestDeadline)}`}
                </p>
              </div>
            )}

            {/* Card grid */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4">
                {activeCards.length === 0 && committedCards.length === 0 ? (
                  <div className="py-16 flex flex-col items-center gap-3 text-center">
                    <Inbox className="size-10 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground/40 font-mono">
                      No tickets on the rail.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Active cards — 2-column grid */}
                    {activeCards.length > 0 && (
                      <div className="grid grid-cols-2 gap-4">
                        <AnimatePresence initial={false}>
                          {activeCards.map((card, i) => (
                            <motion.div
                              key={card.id}
                              initial={CARD_ENTER.initial}
                              animate={CARD_ENTER.animate}
                              exit={CARD_ENTER.exit}
                              transition={{
                                ...CARD_ENTER.transition,
                                delay: i * 0.04,
                              }}
                              className={card.module === "briefing" ? "col-span-2 row-span-2" : undefined}
                            >
                              <ActionCard
                                card={card}
                                onExpand={onExpand}
                                onCommit={onCommit}
                                onDismiss={onDismiss}
                              />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Cleared section */}
                    {committedCards.length > 0 && (
                      <div className="mt-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex-1 h-px bg-emerald-500/20" />
                          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-400/50 font-mono">
                            Cleared
                          </span>
                          <div className="flex-1 h-px bg-emerald-500/20" />
                        </div>

                        <div className="grid grid-cols-2 gap-4 rounded-lg bg-emerald-500/5 p-2.5 border border-emerald-500/10">
                          {committedCards.map((card) => (
                            <ActionCard
                              key={card.id}
                              card={card}
                              onExpand={onExpand}
                              onDismiss={onDismiss}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
