"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const MODULES: readonly { id: string; label: string; href: string; icon: string; badge?: number }[] = [
  { id: "home", label: "Home", href: "/", icon: "H" },
  { id: "inbox", label: "Inbox", href: "/inbox", icon: "I", badge: 3 },
  { id: "orders", label: "Orders", href: "/orders", icon: "O" },
  { id: "inventory", label: "Inventory", href: "/inventory", icon: "V" },
  { id: "prep", label: "Prep", href: "/prep", icon: "P" },
  { id: "food-cost", label: "Food Cost", href: "/food-cost", icon: "F" },
  { id: "menu", label: "Menu", href: "/menu", icon: "M" },
  { id: "marketing", label: "Marketing", href: "/marketing", icon: "K" },
  { id: "locations", label: "Locations", href: "/locations", icon: "L" },
  { id: "admin", label: "Admin", href: "/admin", icon: "A" },
];

const LOCATIONS = [
  { id: "river-north", name: "River North", status: "Stable" },
  { id: "west-loop", name: "West Loop", status: "Attention" },
  { id: "fulton-market", name: "Fulton Market", status: "Launch week" },
] as const;

function statusColor(status: string): string {
  switch (status) {
    case "Stable":
      return "bg-emerald-500";
    case "Attention":
      return "bg-amber-500";
    case "Launch week":
      return "bg-blue-500";
    default:
      return "bg-neutral-500";
  }
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            C
          </div>
          <div>
            <p className="text-sm font-semibold">CarabinerOS</p>
            <p className="text-xs text-muted-foreground">
              Carabiner Restaurant Group
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Locations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {LOCATIONS.map((loc) => (
                <SidebarMenuItem key={loc.id}>
                  <SidebarMenuButton size="sm" className="cursor-pointer">
                    <span
                      className={`h-2 w-2 rounded-full ${statusColor(loc.status)}`}
                    />
                    <span className="text-xs">{loc.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MODULES.map((mod) => {
                const isActive =
                  mod.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(mod.href);
                return (
                  <SidebarMenuItem key={mod.id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={mod.href} />}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded text-xs font-medium">
                        {mod.icon}
                      </span>
                      <span>{mod.label}</span>
                      {mod.badge ? (
                        <Badge
                          variant="secondary"
                          className="ml-auto text-xs px-1.5 py-0"
                        >
                          {mod.badge}
                        </Badge>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <p className="text-xs text-muted-foreground">
          CarabinerOS v2 &middot; Phase 0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
