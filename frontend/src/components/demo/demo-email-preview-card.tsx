import { Mail, ShieldCheck } from "lucide-react";
import { DemoBadge } from "@/components/demo/demo-badge";
import type { DemoEmailPreview } from "@/lib/types";

interface DemoEmailPreviewCardProps {
  email: DemoEmailPreview;
}

export function DemoEmailPreviewCard({ email }: DemoEmailPreviewCardProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Draft email preview</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{email.subject}</h2>
        </div>
        <DemoBadge className="shrink-0">{email.previewLabel}</DemoBadge>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="size-4" />
          <span>To: {email.to}</span>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-6 text-foreground/90">
          {email.body.map((line, index) => (
            <p key={`${email.subject}-${index}`}>{line}</p>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>{email.disclaimer}</p>
      </div>
    </section>
  );
}
