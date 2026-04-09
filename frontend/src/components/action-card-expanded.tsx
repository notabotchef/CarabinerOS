"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import {
  Check, X, Loader2, ArrowUp, ChevronLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getActionLabel, TYPE_STYLES } from "@/components/action-card";
import { getCardRecipe } from "@/lib/card-recipes";
import type { CardRecipe, CardRecipeButton } from "@/lib/card-recipes";
import { OrderDetailCard } from "@/components/card-details/order-detail-card";
import { InventoryDetailCard } from "@/components/card-details/inventory-detail-card";
import type {
  ActionCard,
  CardChatMessage,
} from "@/lib/types";

const CHANGE_OP_STYLES: Record<string, string> = {
  "+": "text-emerald-400 bg-emerald-400/5 border-l-2 border-emerald-400/40",
  "!": "text-amber-400 bg-amber-400/5 border-l-2 border-amber-400/40",
  "->": "text-muted-foreground bg-muted/50 border-l-2 border-muted-foreground/20",
};

// --- Suggestion helpers ---

/** Maps type+module to a contextual suggestion for the chat pre-fill. */
export function getDefaultSuggestion(card: ActionCard): string {
  const key = `${card.type}+${card.module}`;
  const map: Record<string, string> = {
    "urgent+inventory": "Want me to place an emergency order?",
    "action+inventory": "Want me to place an emergency order?",
    "urgent+orders": "Should I notify the kitchen?",
    "action+orders": "Should I notify the kitchen?",
    "action+menu": "Add this to tonight's specials?",
    "update+menu": "Add this to tonight's specials?",
    "action+invoices": "Approve all matched invoices?",
    "update+invoices": "Approve all matched invoices?",
    "update+prep": "Mark these as complete?",
    "action+prep": "Mark these as complete?",
    "urgent+food-cost": "Send this to the team?",
    "update+food-cost": "Send this to the team?",
    "action+food-cost": "Send this to the team?",
    "info+food-cost": "Send this to the team?",
  };
  return map[key] ?? `Tell me what to do with this ${card.module} item`;
}

/** Returns an array of quick-action chip labels based on card context. */
export function getDefaultChips(card: ActionCard): string[] {
  if (card.suggestedChips && card.suggestedChips.length > 0) {
    return card.suggestedChips;
  }

  const key = `${card.type}+${card.module}`;
  const map: Record<string, string[]> = {
    "urgent+orders": ["Alert kitchen", "Delay 15 min", "Show details"],
    "urgent+inventory": ["86 it now", "Emergency order", "Show details"],
    "action+inventory": ["Place order", "Check par levels", "Show details"],
    "action+menu": ["Add to specials", "Price check", "Show details"],
    "update+prep": ["Mark complete", "Reassign", "Show details"],
    "update+invoices": ["Approve", "Flag for review", "Show details"],
  };
  return map[key] ?? ["Notify team", "Remind me later", "Show details"];
}

// --- Detail renderer dispatcher ---

function DetailRenderer({ renderer, itemId }: { renderer: string; itemId: string }) {
  switch (renderer) {
    case "order":
      return <OrderDetailCard itemId={itemId} />;
    case "inventory":
      return <InventoryDetailCard itemId={itemId} />;
    // Future: "invoice", "prep" renderers will go here
    default:
      return null;
  }
}

// --- Component ---

interface ActionCardExpandedProps {
  card: ActionCard;
  chatThread: CardChatMessage[];
  chatLoading: boolean;
  onBack: () => void;
  onCommit: (id: string) => void;
  onDismiss: (id: string) => void;
  onSendMessage: (id: string, text: string) => void;
  collapseOnCommit?: boolean;
  collapseOnDismiss?: boolean;
}

export function ActionCardExpanded({
  card,
  chatThread,
  chatLoading,
  onBack,
  onCommit,
  onDismiss,
  onSendMessage,
  collapseOnCommit = true,
  collapseOnDismiss = true,
}: ActionCardExpandedProps) {
  const [message, setMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Recipe lookup — progressive enhancement
  const recipe: CardRecipe | undefined = card.itemId && card.module
    ? getCardRecipe(card.module, card.action)
    : undefined;

  const suggestion = card.suggestedAction ?? getDefaultSuggestion(card);
  const chips = recipe?.chips ?? getDefaultChips(card);
  const recipeButtons: CardRecipeButton[] | undefined = recipe?.buttons;
  const actionLabel = getActionLabel(card);
  const style = TYPE_STYLES[card.type];
  const hasDetailRenderer = !!(recipe && card.itemId && recipe.detailRenderer !== "briefing" && recipe.detailRenderer !== "generic");

  // Auto-scroll chat thread
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatThread.length]);

  const handleSend = (text?: string) => {
    const sendText = text ?? message.trim();
    if (!sendText) return;
    onSendMessage(card.id, sendText);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChipClick = (chipLabel: string) => {
    handleSend(chipLabel);
  };

  const handleRecipeButton = (btn: CardRecipeButton) => {
    if (btn.action.startsWith("chat:")) {
      handleSend(btn.action.slice(5));
    }
    // Future: "/" prefix for navigation, "api:" for direct API calls
  };

  return (
    <motion.div
      layout
      layoutId={`card-${card.id}`}
      className="flex flex-col h-full"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Back
          </button>
          <span className="text-muted-foreground/20">|</span>
          {card.module && card.module !== "general" && (
            <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm ${style.pill}`}>
              {card.module.replace("_", " ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onDismiss(card.id);
              if (collapseOnDismiss) onBack();
            }}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Dismiss"
          >
            <X className="size-4" />
          </button>
          <button
            onClick={() => {
              onCommit(card.id);
              if (collapseOnCommit) onBack();
            }}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground hover:shadow-md transition-all text-[10px] font-bold uppercase tracking-wider"
            title="Commit this card"
          >
            <Check className="size-3.5" />
            {actionLabel}
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {/* Title */}
          <h2 className="text-base font-bold text-foreground leading-tight mb-1.5">
            {card.summary}
          </h2>

          {/* Detail — recipe-based rich renderer or generic markdown */}
          {hasDetailRenderer ? (
            <div className="mb-4">
              <DetailRenderer renderer={recipe!.detailRenderer} itemId={card.itemId!} />
            </div>
          ) : (
            <div className="markdown-body text-[13px] text-muted-foreground/70 leading-relaxed mb-4 [&_p]:m-0 [&_ul]:my-1 [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:pl-4 [&_li]:text-[13px] [&_strong]:text-foreground/80">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {card.detail}
              </ReactMarkdown>
            </div>
          )}

          {/* Stats grid */}
          {card.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {card.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-muted/30 rounded-lg p-2.5 border border-border/40"
                >
                  <div className="text-[9px] font-medium text-muted-foreground/60 mb-0.5">
                    {stat.label}
                  </div>
                  <div className="text-lg font-extrabold tabular-nums font-mono">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Changes diff */}
          {card.changes.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground/60 mb-2">
                Changes
              </div>
              <div className="flex flex-col gap-1">
                {card.changes.map((change, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded ${CHANGE_OP_STYLES[change.op] ?? "bg-muted/30"}`}
                  >
                    <span className="text-xs font-bold w-3 text-center shrink-0 font-mono">
                      {change.op}
                    </span>
                    <span className="text-[12px] text-foreground/70">
                      {change.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat thread */}
          {chatThread.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-muted-foreground/60 mb-2">
                Thread
              </div>
              <div className="flex flex-col gap-1.5">
                {chatThread.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary/10 text-foreground/80 ml-6"
                        : "bg-muted/30 text-foreground/70 mr-6"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="markdown-body [&_p]:m-0 [&_ul]:my-1 [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:pl-4 [&_li]:text-[12px] [&_strong]:text-foreground/80">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground/40 text-xs mr-6">
                    <Loader2 className="size-3 animate-spin" />
                    <span className="text-[10px]">Working...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Action buttons from A0 + chips + chat input */}
      <div className="border-t border-border/60 px-4 py-3 shrink-0">
        {/* Recipe-smart buttons (preferred) or A0-specified action buttons (fallback) */}
        {recipeButtons && recipeButtons.length > 0 ? (
          <div className="flex gap-2 mb-3">
            {recipeButtons.map((btn) => (
              <button
                key={btn.label}
                onClick={() => handleRecipeButton(btn)}
                disabled={chatLoading}
                className={[
                  "flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40",
                  btn.type === "primary"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : btn.type === "danger"
                      ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted/80 border border-border/60",
                ].join(" ")}
              >
                {btn.label}
              </button>
            ))}
          </div>
        ) : card.actions && card.actions.length > 0 ? (
          <div className="flex gap-2 mb-3">
            {card.actions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleChipClick(action.label)}
                disabled={chatLoading}
                className={[
                  "flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40",
                  action.type === "primary"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : action.type === "danger"
                      ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted/80 border border-border/60",
                ].join(" ")}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
        {/* Chips */}
        <div className="flex gap-1.5 mb-2 overflow-x-auto scrollbar-none">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipClick(chip)}
              disabled={chatLoading}
              className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground/70 hover:text-foreground hover:border-foreground/20 hover:bg-muted/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={suggestion}
            className="w-full rounded-xl border border-border bg-card/80 glass-subtle px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/25 focus:shadow-[0_0_20px_oklch(0.72_0.22_160_/_0.12)] transition-all"
          />
          <button
            onClick={() => handleSend()}
            disabled={!message.trim() || chatLoading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
