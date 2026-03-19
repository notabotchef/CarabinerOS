import {
  Home, ShoppingCart, Warehouse, ChefHat, DollarSign,
  UtensilsCrossed, BookOpen, Receipt, Megaphone, BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface ModuleConfig {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const MODULES: ModuleConfig[] = [
  { id: "home", label: "Home", href: "/", icon: Home, description: "Chat & briefing" },
  { id: "orders", label: "Orders", href: "/orders", icon: ShoppingCart, description: "Purchase orders" },
  { id: "inventory", label: "Inventory", href: "/inventory", icon: Warehouse, description: "Stock levels & par" },
  { id: "prep", label: "Prep", href: "/prep", icon: ChefHat, description: "Prep lists" },
  { id: "food-cost", label: "Food Cost", href: "/food-cost", icon: DollarSign, description: "Cost tracking" },
  { id: "menu", label: "Menu", href: "/menu", icon: UtensilsCrossed, description: "Menu engineering" },
  { id: "recipes", label: "Recipes", href: "/recipes", icon: BookOpen, description: "Recipe management" },
  { id: "invoices", label: "Invoices", href: "/invoices", icon: Receipt, description: "Invoice processing" },
  { id: "marketing", label: "Marketing", href: "/marketing", icon: Megaphone, description: "Campaigns" },
  { id: "reporting", label: "Reporting", href: "/reporting", icon: BarChart3, description: "P&L & reports" },
];
