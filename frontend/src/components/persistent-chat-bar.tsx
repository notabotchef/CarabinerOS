"use client";

import { useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { ModuleChat } from "@/components/module-chat";

/* ------------------------------------------------------------------ */
/*  Route-to-module mapping                                            */
/* ------------------------------------------------------------------ */

const MODULE_ROUTES: Record<string, string> = {
  "/orders": "orders",
  "/inventory": "inventory",
  "/prep": "prep",
  "/menu": "menu",
  "/recipes": "recipes",
  "/invoices": "invoices",
  "/marketing": "marketing",
  "/reporting": "reporting",
  "/food-cost": "food-cost",
};

function getModuleId(pathname: string): string | null {
  if (MODULE_ROUTES[pathname]) return MODULE_ROUTES[pathname];
  for (const [route, id] of Object.entries(MODULE_ROUTES)) {
    if (pathname.startsWith(route + "/")) return id;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  PersistentChatBar                                                  */
/* ------------------------------------------------------------------ */

export function PersistentChatBar() {
  const pathname = usePathname();
  const moduleId = getModuleId(pathname);

  const buildContext = useCallback(() => {
    return `[module=${moduleId}]`;
  }, [moduleId]);

  const chips = useMemo(() => {
    switch (moduleId) {
      case "inventory":
        return ["Run count", "Check par levels", "Log waste"];
      case "prep":
        return ["Generate prep list", "Check prep status"];
      case "menu":
        return ["Menu analysis", "Show Dogs"];
      case "food-cost":
        return ["Today's food cost", "Budget status"];
      default:
        return [];
    }
  }, [moduleId]);

  if (!moduleId) return null;

  return (
    <div className="shrink-0 bg-card/80 backdrop-blur-sm">
      <ModuleChat
        moduleId={moduleId}
        buildContext={buildContext}
        placeholder={`Ask about ${moduleId.replace("-", " ")}...`}
        chips={chips}
      />
    </div>
  );
}
