"use client";

import { motion } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface DetailField {
  label: string;
  value: string;
}

interface DetailAction {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "ghost";
  onClick: () => void;
}

interface WorkspaceDetailPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  statusBadge?: { label: string; color?: string };
  metaLine?: string;
  fields: DetailField[];
  summary: string | null;
  detailPoints: string[] | null;
  prompt: string | null;
  actions?: DetailAction[];
}

export function WorkspaceDetailPanel({
  open,
  onClose,
  title,
  statusBadge,
  metaLine,
  fields,
  summary,
  detailPoints,
  prompt,
  actions,
}: WorkspaceDetailPanelProps) {
  const { setChatOpen, setChatPrompt } = useWorkspaceStore();

  function handleAskCarabiner() {
    if (prompt) {
      setChatPrompt(prompt);
      setChatOpen(true);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {statusBadge && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{statusBadge.label}</Badge>
              {metaLine && (
                <span className="text-xs text-muted-foreground">{metaLine}</span>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Action buttons */}
          {actions && actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  variant={action.variant}
                  size="sm"
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          {fields.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {fields.map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="rounded-md border bg-muted/50 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {f.label}
                    </div>
                    <div className="text-sm font-medium mt-0.5 tabular-nums">{f.value}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {summary && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Summary
              </div>
              <p className="text-sm leading-relaxed">{summary}</p>
            </div>
          )}

          {detailPoints && detailPoints.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Details
              </div>
              <ul className="list-disc pl-4 space-y-1">
                {detailPoints.map((point, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {prompt && (
            <>
              <Separator />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Ask CarabinerOS
                </div>
                <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground mb-2">
                  {prompt}
                </div>
                <Button
                  onClick={handleAskCarabiner}
                  className="w-full"
                  size="sm"
                >
                  Ask CarabinerOS &rarr;
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
