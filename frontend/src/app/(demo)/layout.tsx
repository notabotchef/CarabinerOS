import type { ReactNode } from "react";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 bg-background text-foreground">
      <div className="flex w-full flex-col">{children}</div>
    </div>
  );
}
