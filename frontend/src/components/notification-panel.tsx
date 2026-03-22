"use client";

import { AnimatePresence, motion } from "framer-motion";
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

const cardEntryVariants = {
  initial: { opacity: 0, y: -20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, x: 100, scale: 0.95 },
};

const cardSpring = { type: "spring" as const, stiffness: 300, damping: 25 };

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
  const activeCards = cards.filter((c) => c.status !== "dismissed");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col">
        <AnimatePresence mode="wait">
          {expandedCardId && expandedCard ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
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
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full min-h-0 overflow-hidden"
            >
              {/* Header */}
              <SheetHeader className="border-b border-border px-5 py-4 shrink-0 glass-subtle">
                <SheetTitle className="text-base font-semibold">Action Cards</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  {activeCards.length === 0
                    ? "No notifications right now"
                    : `${unreadCount} unread`}
                </SheetDescription>
              </SheetHeader>

              {/* Urgency banner */}
              {urgentBanner && (
                <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[12px] font-semibold text-amber-400">
                    {urgentBanner.count === 1
                      ? `1 card needs action before ${formatBannerDeadline(urgentBanner.earliestDeadline)}`
                      : `${urgentBanner.count} cards need action — earliest deadline ${formatBannerDeadline(urgentBanner.earliestDeadline)}`}
                  </p>
                </div>
              )}

              {/* Card list */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {activeCards.length === 0 ? (
                    <div className="py-16 flex flex-col items-center gap-3 text-center">
                      <Inbox className="size-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground/60">
                        All clear. Nothing needs your attention.
                      </p>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {activeCards.map((card, i) => (
                        <motion.div
                          key={card.id}
                          layout
                          variants={cardEntryVariants}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          transition={{ ...cardSpring, delay: i * 0.05 }}
                        >
                          <ActionCard
                            card={card}
                            onExpand={onExpand}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
