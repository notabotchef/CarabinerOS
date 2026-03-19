"use client";

import { useState, useMemo } from "react";
import { BookOpen, Plus, ScanLine, Search } from "lucide-react";
import { motion } from "framer-motion";
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
  name: string;
  category: string;
  yield_qty: string | null;
  yield_unit: string | null;
  estimated_cost: string | null;
  cost_per_unit: string | null;
  status: string;
  tags: string[] | null;
  summary: string | null;
}

type StatusFilter = "All" | "Active" | "Draft" | "Archived";
const STATUS_FILTERS: StatusFilter[] = ["All", "Active", "Draft", "Archived"];

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const STATUS_DOT: Record<string, string> = {
  Active: "bg-emerald-500",
  Draft: "bg-amber-400",
  Archived: "bg-muted-foreground/40",
};

/* ------------------------------------------------------------------ */
/*  Motion variants                                                    */
/* ------------------------------------------------------------------ */

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" as const },
  }),
};

/* ------------------------------------------------------------------ */
/*  RecipeCard                                                         */
/* ------------------------------------------------------------------ */

function RecipeCard({ recipe, index }: { recipe: Recipe; index: number }) {
  const tags = recipe.tags ?? [];
  const hasCost = recipe.estimated_cost != null;
  const hasYield = recipe.yield_qty && recipe.yield_unit;

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative bg-card border border-border rounded-xl p-5 cursor-pointer
                 transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/5"
    >
      {/* Category + Status */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {recipe.category}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`inline-block size-2 rounded-full ${STATUS_DOT[recipe.status] ?? STATUS_DOT.Archived}`}
          />
          {recipe.status}
        </span>
      </div>

      {/* Name — editorial prominence */}
      <h3 className="text-lg font-bold text-foreground leading-tight line-clamp-2 tracking-tight">
        {recipe.name}
      </h3>

      {/* Summary */}
      {recipe.summary && (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {recipe.summary}
        </p>
      )}

      {/* Cost + Yield — sharp numbers */}
      <div className="flex items-baseline justify-between mt-4 pt-3 border-t border-border/50">
        {hasCost ? (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            ${Number(recipe.estimated_cost).toFixed(2)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground/50">&mdash;</span>
        )}
        {hasYield && (
          <span className="text-xs text-muted-foreground tabular-nums">
            Yield: {recipe.yield_qty} {recipe.yield_unit}
          </span>
        )}
      </div>

      {/* Tags as soft colored pills */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.slice(0, 4).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] font-medium px-2 py-0.5 h-auto rounded-full"
            >
              {tag}
            </Badge>
          ))}
          {tags.length > 4 && (
            <span className="text-[10px] text-muted-foreground self-center">
              +{tags.length - 4}
            </span>
          )}
        </div>
      )}
    </motion.div>
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
      <div className="flex justify-between pt-3 border-t border-border/50">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-4 w-12 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
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
    const c: Record<StatusFilter, number> = { All: data.length, Active: 0, Draft: 0, Archived: 0 };
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
    if (statusFilter !== "All") list = list.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.tags ?? []).some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [data, statusFilter, search]);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-8 rounded-lg bg-secondary">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </div>
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
            placeholder="Search recipes, categories, tags..."
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
          <div className="flex flex-col items-center justify-center py-24 text-sm text-muted-foreground">
            <div className="flex items-center justify-center size-12 rounded-xl bg-secondary mb-4">
              <BookOpen className="size-6 text-muted-foreground/50" />
            </div>
            <p className="font-medium text-foreground mb-1">No data available</p>
            <p>API endpoint not connected yet.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-sm text-muted-foreground">
            <div className="flex items-center justify-center size-12 rounded-xl bg-secondary mb-4">
              <BookOpen className="size-6 text-muted-foreground/50" />
            </div>
            {data.length === 0 ? (
              <>
                <p className="font-medium text-foreground mb-1">
                  Your recipe library is empty
                </p>
                <p className="max-w-xs text-center">
                  Scan a recipe card, or ask CarabinerOS to create one from a dish description.
                </p>
              </>
            ) : (
              <p>No recipes match your filters.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((recipe, i) => (
              <RecipeCard key={recipe.id} recipe={recipe} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
