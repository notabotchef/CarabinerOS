"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SocketProvider } from "@/components/socket-provider";
import { Shell } from "@/components/shell";

function isDemoRoute(pathname: string | null): boolean {
  return pathname?.startsWith("/demo") ?? false;
}

export function AppRouteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Demo v1 must stay outside the live operator shell. If this route starts with
  // /demo, we intentionally skip Shell, SocketProvider, useActionCards, and the
  // socket bootstrap path that begins in useSocket().
  if (isDemoRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <SocketProvider>
      <Shell>{children}</Shell>
    </SocketProvider>
  );
}

export { isDemoRoute };
