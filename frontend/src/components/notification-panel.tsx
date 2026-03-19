"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ActionCard } from "@/components/action-card";
import type { ActionCard as ActionCardType } from "@/lib/types";

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: ActionCardType[];
}

export function NotificationPanel({ open, onOpenChange, cards }: NotificationPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[380px] p-0">
        <SheetHeader className="border-b border-neutral-100 px-5 py-4">
          <SheetTitle className="text-base font-semibold">Action Cards</SheetTitle>
          <SheetDescription className="text-xs text-neutral-400">
            {cards.length === 0
              ? "No notifications right now"
              : `${cards.filter((c) => !c.read).length} unread`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-4 space-y-3">
            {cards.length === 0 ? (
              <p className="py-12 text-center text-sm text-neutral-400">
                All clear. Nothing to review.
              </p>
            ) : (
              cards.map((card) => (
                <ActionCard key={card.id} card={card} />
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
