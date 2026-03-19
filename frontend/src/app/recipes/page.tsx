"use client";

import { useState, useMemo } from "react";
import { BookOpen, Plus, ScanLine, Search } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Recipe {
  id: string;
  location_id: string;
  name: string;
  category: string;
  yield_qty: string | null;
  yield_unit: string | null;
  estimated_cost: string | null;
  cost_per_unit: string | null;
  status: string;
  tags: string[] | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

type StatusFilter = "All" | "Active" | "Draft" | "Archived";

const STATUS_FILTERS: StatusFilter[] = ["All", "Active", "Draft", "Archived"];

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

function statusDotColor(status: string): string {
  switch (status) {
    case "Active":
      return "bg-emerald-500";
    case "Draft":
      return "bg-amber-400";
    case "Archived":
      return "bg-muted-foreground/40";
    default:
      return "bg-muted-foreground/40";
  }
}

/* ------------------------------------------------------------------ */
/*  RecipeCard                                                         */
/* ------------------------------------------------------------------ */

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const hasYield = recipe.yield_qty && recipe.yield_unit;
  const hasCost = recipe.estimated_cost != null;
  const tags = recipe.tags ?? [];

  return (
    <div className="group bg-card border border-border rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
      {/* Top row: category + status */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {recipe.category}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${statusDotColor(recipe.status)}`}
          />
          {recipe.status}
        </span>
      </div>

      {/* Name */}
      <h3 className="text-base font-semibold text-foreground leading-snug line-clamp-2">
        {recipe.name}
      </h3>

      {/* Summary */}
      {recipe.summary && (
        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
          {recipe.summary}
        </p>
      )}

      {/* Cost + Yield row */}
      <div className="flex items-center justify-between mt-4 text-sm">
        {hasCost ? (
          <span className="font-medium tabular-nums text-foreground">
            ${Number(recipe.estimated_cost).toFixed(2)}
          </span>
        ) : (
          <span className="text-muted-foreground/60">&mdash;</span>
        )}
        {hasYield && (
          <span className="text-muted-foreground">
            {recipe.yield_qty} {recipe.yield_unit}
          </span>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.slice(0, 4).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[0.65rem] px-1.5 py-0 h-4"
            >
              {tag}
            </Badge>
          ))}
          {tags.length > 4 && (
            <span className="text-[0.65rem] text-muted-foreground self-center">
              +{tags.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton card                                                      */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <div className="flex justify-between pt-1">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function RecipesPage() {
  const { data, loading, error } = useWorkspace<Recipe>("/api/recipes");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  /* Counts per status */
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      All: data.length,
      Active: 0,
      Draft: 0,
      Archived: 0,
    };
    for (const r of data) {
      if (r.status === "Active") c.Active++;
      else if (r.status === "Draft") c.Draft++;
      else if (r.status === "Archived") c.Archived++;
    }
    return c;
  }, [data]);

  /* Filtered list */
  const filtered = useMemo(() => {
    let list = data;
    if (statusFilter !== "All") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    return list;
  }, [data, statusFilter, search]);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Recipes</h1>
            <p className="text-sm text-muted-foreground">
              Modernist Cuisine recipe system
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <ScanLine className="h-3.5 w-3.5 mr-1.5" />
            Scan Recipe
          </Button>
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Recipe
          </Button>
        </div>
      </header>

      {/* ---- Toolbar: tabs + search ---- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border px-6 py-3 shrink-0">
        {/* Status tabs */}
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                statusFilter === s
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {s}
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {loading ? "\u2014" : counts[s]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
      </div>

      {/* ---- Content ---- */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 text-muted-foreground/40" />
            <p>No data available &mdash; API endpoint not connected yet</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 text-muted-foreground/40" />
            {data.length === 0 ? (
              <p>
                No recipes yet. Scan a recipe or ask CarabinerOS to create one.
              </p>
            ) : (
              <p>No recipes match your filters.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
