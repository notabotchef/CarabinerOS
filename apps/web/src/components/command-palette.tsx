"use client";

import { useCallback, useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  Home,
  Inbox,
  ShoppingCart,
  Receipt,
  Warehouse,
  ChefHat,
  DollarSign,
  UtensilsCrossed,
  BarChart3,
  Megaphone,
  MapPin,
  Settings,
  MessageSquare,
  Search,
  type LucideIcon,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  group: string;
  keywords?: string;
  action?: () => void;
}

const NAVIGATION_ITEMS: CommandItem[] = [
  { id: "home", label: "Home", href: "/", icon: Home, group: "Navigation" },
  { id: "inbox", label: "Inbox", href: "/inbox", icon: Inbox, group: "Navigation" },
  { id: "orders", label: "Orders", href: "/orders", icon: ShoppingCart, group: "Navigation", keywords: "purchase vendor" },
  { id: "invoices", label: "Invoices", href: "/invoices", icon: Receipt, group: "Navigation", keywords: "bills payments ap" },
  { id: "inventory", label: "Inventory", href: "/inventory", icon: Warehouse, group: "Navigation", keywords: "stock count" },
  { id: "prep", label: "Prep Lists", href: "/prep", icon: ChefHat, group: "Navigation", keywords: "kitchen preparation" },
  { id: "food-cost", label: "Food Cost", href: "/food-cost", icon: DollarSign, group: "Navigation", keywords: "cogs margin" },
  { id: "menu", label: "Menu", href: "/menu", icon: UtensilsCrossed, group: "Navigation", keywords: "dishes items" },
  { id: "reporting", label: "Reporting", href: "/reporting", icon: BarChart3, group: "Navigation", keywords: "analytics reports" },
  { id: "marketing", label: "Marketing", href: "/marketing", icon: Megaphone, group: "Navigation", keywords: "campaigns" },
  { id: "locations", label: "Locations", href: "/locations", icon: MapPin, group: "Navigation", keywords: "restaurants sites" },
  { id: "admin", label: "Admin", href: "/admin", icon: Settings, group: "Navigation", keywords: "settings config" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      setOpen(false);
      setSearch("");
      if (item.action) {
        item.action();
      } else if (item.href) {
        router.push(item.href);
      }
    },
    [router],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="relative mx-auto mt-[20vh] max-w-lg px-4">
        <Command
          className="rounded-xl border bg-popover shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_16px_rgba(0,0,0,0.1),0_24px_48px_rgba(0,0,0,0.12)] overflow-hidden"
          shouldFilter={true}
        >
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search modules, actions, or ask a question..."
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              No results found. Try asking CarabinerOS...
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-xs text-muted-foreground px-2 py-1.5">
              {NAVIGATION_ITEMS.map((item) => (
                <Command.Item
                  key={item.id}
                  value={`${item.label} ${item.keywords ?? ""}`}
                  onSelect={() => handleSelect(item)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground transition-colors"
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {search.length > 2 && (
              <Command.Group heading="Ask CarabinerOS" className="text-xs text-muted-foreground px-2 py-1.5">
                <Command.Item
                  value={`ask agent ${search}`}
                  onSelect={() => {
                    setOpen(false);
                    setSearch("");
                    router.push("/");
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground transition-colors"
                >
                  <MessageSquare className="size-4 text-primary" />
                  <span>
                    Ask: <span className="text-muted-foreground">&ldquo;{search}&rdquo;</span>
                  </span>
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>

          <div className="border-t px-4 py-2 text-[10px] text-muted-foreground flex gap-3">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> select</span>
            <span><kbd className="font-mono">esc</kbd> close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
