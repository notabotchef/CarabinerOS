"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FieldConfig {
  name: string;
  label: string;
  type?: string;
  optional?: boolean;
}

export function DemoAuthCard({
  title,
  description,
  restaurantName,
  restaurantSummary,
  fields,
  submitLabel,
  error,
  loading,
  onSubmit,
  footer,
}: {
  title: string;
  description: string;
  restaurantName: string;
  restaurantSummary: string;
  fields: FieldConfig[];
  submitLabel: string;
  error: string | null;
  loading: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  footer?: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-xl rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="space-y-6">
        <div className="space-y-2 rounded-xl border border-border bg-background p-4 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prepared demo</p>
          <h2 className="text-base font-semibold text-foreground">{restaurantName}</h2>
          <p className="text-sm text-muted-foreground">{restaurantSummary}</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="grid gap-4">
            {fields.map((field) => (
              <label key={field.name} className="space-y-2 text-sm text-foreground">
                <span className="block font-medium">
                  {field.label}
                  {field.optional ? <span className="text-muted-foreground"> (optional)</span> : null}
                </span>
                <Input name={field.name} type={field.type || "text"} required={!field.optional} />
              </label>
            ))}
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 shadow-sm">
              <p className="text-sm text-foreground">{error}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-4 border-t border-border pt-6">
            <Button type="submit" disabled={loading}>
              {loading ? "Working…" : submitLabel}
            </Button>
            {footer}
          </div>
        </form>
      </div>
    </section>
  );
}
