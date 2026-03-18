"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecipes } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Plus,
  Search,
  Upload,
  ChefHat,
  DollarSign,
  Scale,
  Sparkles,
} from "lucide-react";
import type { Recipe } from "@/lib/api";

const STATUS_FILTERS = ["all", "active", "draft", "archived"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_CONFIG: Record<
  string,
  {
    dot: string;
    border: string;
    cardClass: string;
    badge: string;
  }
> = {
  active: {
    dot: "bg-emerald-400",
    border: "border-emerald-500/20",
    cardClass: "opacity-100",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  },
  draft: {
    dot: "bg-amber-400",
    border: "border-amber-500/20",
    cardClass: "opacity-100",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  },
  archived: {
    dot: "bg-zinc-500",
    border: "border-zinc-500/15",
    cardClass: "opacity-50",
    badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
  },
};

function statusVariant(s: string) {
  switch (s.toLowerCase()) {
    case "active":
      return "default" as const;
    case "draft":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const conf = STATUS_CONFIG[recipe.status] || STATUS_CONFIG.draft;

  return (
    <Link href={`/recipes/${recipe.id}`}>
      <Card
        className={`group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur transition-all duration-200 hover:border-primary/30 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5 cursor-pointer p-0 ${conf.cardClass} ${
          recipe.status === "draft" ? "border-l-2 " + conf.border : ""
        }`}
      >
        {/* Image area */}
        <div className="relative h-36 bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 flex items-center justify-center overflow-hidden">
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt={recipe.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <ChefHat className="size-10 text-zinc-600" />
          )}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {recipe.source === "llm" && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/20">
                <Sparkles className="size-2.5" />
                AI
              </span>
            )}
            <Badge
              variant={statusVariant(recipe.status)}
              className={`text-[10px] ${conf.badge}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${conf.dot} mr-1`}
              />
              {recipe.status.charAt(0).toUpperCase() + recipe.status.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
              {recipe.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {recipe.category}
            </p>
          </div>

          {recipe.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {recipe.description}
            </p>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-border/30">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {recipe.total_cost != null && (
                <span className="flex items-center gap-1 tabular-nums">
                  <DollarSign className="size-3" />
                  {recipe.total_cost.toFixed(2)}
                </span>
              )}
              {recipe.cost_per_serving != null && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Scale className="size-3" />$
                  {recipe.cost_per_serving.toFixed(2)}/ea
                </span>
              )}
            </div>
            {recipe.yield_quantity && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {recipe.yield_quantity} {recipe.yield_unit}
              </span>
            )}
          </div>

          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipe.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800/60 text-zinc-400 border border-zinc-700/30"
                >
                  {tag}
                </span>
              ))}
              {recipe.tags.length > 4 && (
                <span className="text-[10px] text-zinc-500">
                  +{recipe.tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

function RecipeCardSkeleton() {
  return (
    <Card className="overflow-hidden border-border/50 bg-card/50 p-0">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </Card>
  );
}

// Scan recipe button with file upload
function ScanRecipeButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile() {
    // Navigate to new recipe page — the actual scanning happens there
    router.push("/recipes/new");
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleFile}>
        <Upload className="size-4 mr-1.5" />
        Scan Recipe
      </Button>
    </>
  );
}

export default function RecipesPage() {
  const router = useRouter();
  // Recipes are shared across the restaurant group — don't filter by location
  const { data, isLoading } = useRecipes();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const recipes = data ?? [];

  const filtered = recipes.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const counts = {
    all: recipes.length,
    active: recipes.filter((r) => r.status === "active").length,
    draft: recipes.filter((r) => r.status === "draft").length,
    archived: recipes.filter((r) => r.status === "archived").length,
  };

  const filterConfig: Record<StatusFilter, { dot: string; label: string }> = {
    all: { dot: "bg-foreground", label: "All" },
    active: { dot: "bg-emerald-400", label: "Active" },
    draft: { dot: "bg-amber-400", label: "Draft" },
    archived: { dot: "bg-zinc-500", label: "Archived" },
  };

  return (
    <>
      <WorkspaceHeader
        title="Recipes"
        subtitle="Modernist Cuisine recipe system"
      />
      <div className="p-4 lg:p-6 space-y-6">
        {/* Status filter tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg w-fit">
          {STATUS_FILTERS.map((key) => {
            const fc = filterConfig[key];
            const isActive = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${fc.dot} ${
                    !isActive ? "opacity-50" : ""
                  }`}
                />
                {fc.label}
                <span
                  className={`tabular-nums ${
                    isActive ? "text-foreground" : "text-muted-foreground/60"
                  }`}
                >
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <ScanRecipeButton />
            <Button
              size="sm"
              onClick={() => router.push("/recipes/new")}
            >
              <Plus className="size-4 mr-1.5" />
              New Recipe
            </Button>
          </div>
        </div>

        {/* Recipe grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <RecipeCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="size-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-sm font-medium text-muted-foreground">
              {search || statusFilter !== "all"
                ? "No recipes match your filters"
                : "No recipes yet"}
            </h3>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filter"
                : "Create your first recipe to get started"}
            </p>
            {!search && statusFilter === "all" && (
              <Button
                size="sm"
                className="mt-4"
                onClick={() => router.push("/recipes/new")}
              >
                <Plus className="size-4 mr-1.5" />
                New Recipe
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
