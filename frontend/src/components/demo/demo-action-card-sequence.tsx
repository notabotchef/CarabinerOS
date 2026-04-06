"use client";

import { useEffect, useMemo, useState } from "react";
import { BellDot, Sparkles, ShieldCheck } from "lucide-react";
import { ActionCard } from "@/components/action-card";
import { ActionCardExpanded } from "@/components/action-card-expanded";
import { DemoBadge } from "@/components/demo/demo-badge";
import type { ActionCard as ActionCardType, CardChatMessage, DemoSandboxResult } from "@/lib/types";

interface DemoActionCardSequenceProps {
  initialCards: ActionCardType[];
  actionEndpoint: string;
}

interface DemoActionResponse {
  ok: boolean;
  result: DemoSandboxResult;
}

export function DemoActionCardSequence({ initialCards, actionEndpoint }: DemoActionCardSequenceProps) {
  const [cards, setCards] = useState<ActionCardType[]>(() => initialCards.slice(0, 3));
  const [expandedCardId, setExpandedCardId] = useState<string | null>(initialCards[0]?.id ?? null);
  const [threads, setThreads] = useState<Record<string, CardChatMessage[]>>({});
  const [chatLoading, setChatLoading] = useState(false);
  const [resultByCardId, setResultByCardId] = useState<Record<string, DemoSandboxResult>>({});

  useEffect(() => {
    const nextCards = initialCards.slice(0, 3);
    setCards(nextCards);
    setExpandedCardId(nextCards[0]?.id ?? null);
  }, [initialCards]);

  const activeCards = useMemo(
    () => cards.filter((card) => card.status !== "dismissed"),
    [cards],
  );

  const expandedCard = useMemo(
    () => activeCards.find((card) => card.id === expandedCardId) ?? activeCards[0] ?? null,
    [activeCards, expandedCardId],
  );

  const setSandboxResult = (result: DemoSandboxResult) => {
    setResultByCardId((current) => ({ ...current, [result.cardId]: result }));
  };

  const runCardAction = async (
    card: ActionCardType,
    operation: string,
    message?: string,
  ): Promise<DemoSandboxResult> => {
    const response = await fetch(actionEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: card.id,
        operation,
        cardSummary: card.summary,
        message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Demo action failed with status ${response.status}`);
    }

    const payload = await response.json() as DemoActionResponse;
    if (!payload.ok) {
      throw new Error("Demo action failed");
    }

    setSandboxResult(payload.result);
    return payload.result;
  };

  const handleExpand = (cardId: string) => {
    setExpandedCardId(cardId);
  };

  const handleCommit = async (cardId: string) => {
    const card = cards.find((entry) => entry.id === cardId);
    if (!card) return;

    const result = await runCardAction(card, "commit");
    setCards((current) => current.map((entry) => (
      entry.id === cardId ? { ...entry, status: "committed" } : entry
    )));
    setExpandedCardId(result.cardId);
  };

  const handleDismiss = async (cardId: string) => {
    const card = cards.find((entry) => entry.id === cardId);
    if (!card) return;

    await runCardAction(card, "dismiss");
    setCards((current) => current.map((entry) => (
      entry.id === cardId ? { ...entry, status: "dismissed" } : entry
    )));

    const nextCard = activeCards.find((entry) => entry.id !== cardId && entry.status !== "dismissed");
    setExpandedCardId(nextCard?.id ?? null);
  };

  const handleSendMessage = async (cardId: string, text: string) => {
    const card = cards.find((entry) => entry.id === cardId);
    if (!card) return;

    const userMessage: CardChatMessage = {
      role: "user",
      text,
      timestamp: Date.now(),
    };

    setThreads((current) => ({
      ...current,
      [cardId]: [...(current[cardId] ?? []), userMessage],
    }));

    setChatLoading(true);

    try {
      const result = await runCardAction(card, "message", text);
      const assistantMessage: CardChatMessage = {
        role: "assistant",
        text: result.detail,
        timestamp: Date.now(),
      };
      setThreads((current) => ({
        ...current,
        [cardId]: [...(current[cardId] ?? []), assistantMessage],
      }));
    } finally {
      setChatLoading(false);
    }
  };

  const currentResult = expandedCard ? resultByCardId[expandedCard.id] : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Action cards</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">Prepared next actions for today's service</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BellDot className="size-4 text-primary" />
          <span>{activeCards.length} prepared cards · v1 capped at 3</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
        <div className="space-y-3">
          {activeCards.map((card, index) => (
            <div key={card.id} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Sequence {index + 1}</span>
                </div>
                {card.demo?.badgeLabel ? <DemoBadge>{card.demo.badgeLabel}</DemoBadge> : null}
              </div>
              <ActionCard
                card={card}
                onExpand={handleExpand}
                onCommit={(id) => { void handleCommit(id); }}
                onDismiss={(id) => { void handleDismiss(id); }}
              />
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-background shadow-sm">
          {expandedCard ? (
            <div>
              <div className="border-b border-border px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {expandedCard.demo?.badgeLabel ? <DemoBadge>{expandedCard.demo.badgeLabel}</DemoBadge> : null}
                  {expandedCard.demo?.sandboxLabel ? (
                    <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">
                      {expandedCard.demo.sandboxLabel}
                    </span>
                  ) : null}
                </div>
                {expandedCard.demo?.provenanceLabel ? (
                  <p className="mt-2 text-sm text-muted-foreground">{expandedCard.demo.provenanceLabel}</p>
                ) : null}
              </div>

              <ActionCardExpanded
                card={expandedCard}
                chatThread={threads[expandedCard.id] ?? []}
                chatLoading={chatLoading}
                onBack={() => setExpandedCardId(null)}
                onCommit={(id) => { void handleCommit(id); }}
                onDismiss={(id) => { void handleDismiss(id); }}
                onSendMessage={(id, text) => { void handleSendMessage(id, text); }}
                collapseOnCommit={false}
                collapseOnDismiss={false}
              />

              {currentResult ? (
                <div className="border-t border-border px-4 py-4" data-testid="demo-sandbox-result">
                  <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{currentResult.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{currentResult.detail}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Open a prepared card to see the sandboxed demo workflow.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
