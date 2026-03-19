"use client";

import { BookOpen } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Skeleton } from "@/components/ui/skeleton";

interface Recipe {
  name: string;
  category: string;
  ingredient_count: number;
  estimated_cost: number;
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-semibold text-foreground">{recipe.name}</h3>
      <p className="text-sm text-muted-foreground mt-1">{recipe.category}</p>
      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="text-muted-foreground">
          {recipe.ingredient_count} ingredient{recipe.ingredient_count !== 1 ? "s" : ""}
        </span>
        <span className="font-medium text-foreground">
          ${Number(recipe.estimated_cost).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default function RecipesPage() {
  const { data, loading, error } = useWorkspace<Recipe>("/api/recipes");

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Recipes</h1>
        <span className="ml-auto text-sm text-muted-foreground">
          {!loading && !error && `${data.length} recipes`}
        </span>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-sm text-destructive">
            Failed to load recipes
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No recipes yet
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((recipe, i) => (
              <RecipeCard key={i} recipe={recipe} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
