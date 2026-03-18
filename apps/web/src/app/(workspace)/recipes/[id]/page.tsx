"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useRecipe } from "@/hooks/use-api";
import { useUpdateRecipe, useDeleteRecipe } from "@/hooks/use-mutations";
import { useToast } from "@/components/ui/toast";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ChefHat,
  Clock,
  DollarSign,
  Flame,
  Scale,
  Trash2,
  Wrench,
  Tag,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Beaker,
} from "lucide-react";
import type {
  RecipeDetail,
  RecipeComponent,
  RecipeComponentIngredient,
  RecipeStep,
} from "@/lib/api";

function statusColor(s: string) {
  switch (s.toLowerCase()) {
    case "active":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
    case "draft":
      return "bg-amber-500/15 text-amber-400 border-amber-500/25";
    case "archived":
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/25";
    default:
      return "";
  }
}

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

// --- Ingredient Table ---
function IngredientTable({
  ingredients,
}: {
  ingredients: RecipeComponentIngredient[];
}) {
  const totalWeight = ingredients.reduce((acc, i) => acc + (i.weight_g || 0), 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40 text-xs text-muted-foreground">
            <th className="text-left py-2 pr-4 font-medium">Ingredient</th>
            <th className="text-right py-2 px-2 font-medium w-24">Weight</th>
            <th className="text-right py-2 px-2 font-medium w-20">%</th>
            <th className="text-left py-2 pl-4 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map((ing) => (
            <tr
              key={ing.id}
              className="border-b border-border/20 hover:bg-muted/20 transition-colors"
            >
              <td className="py-2 pr-4">
                <span className="font-medium">{ing.name}</span>
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {ing.weight_g}
                <span className="text-muted-foreground ml-0.5 text-xs">
                  {ing.unit_display}
                </span>
              </td>
              <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                {ing.percentage != null ? `${ing.percentage}%` : "--"}
              </td>
              <td className="py-2 pl-4 text-xs text-muted-foreground italic">
                {ing.notes || ""}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border/40">
            <td className="py-2 pr-4 text-xs font-semibold text-muted-foreground">
              Total
            </td>
            <td className="py-2 px-2 text-right tabular-nums font-semibold text-xs">
              {totalWeight.toFixed(1)}
              <span className="text-muted-foreground ml-0.5">g</span>
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// --- Steps List ---
function StepsList({ steps }: { steps: RecipeStep[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.id} className="flex gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold tabular-nums">
            {step.step_number}
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm leading-relaxed">{step.instruction}</p>
            <div className="flex flex-wrap gap-2">
              {step.temperature && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                  <Flame className="size-2.5" />
                  {step.temperature}
                </span>
              )}
              {step.duration && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Clock className="size-2.5" />
                  {step.duration}
                </span>
              )}
              {step.technique && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  <Beaker className="size-2.5" />
                  {step.technique}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Component Section ---
function ComponentSection({ component }: { component: RecipeComponent }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-border/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-primary tabular-nums w-5">
            {component.sort_order}
          </span>
          <div>
            <h3 className="font-semibold text-sm">{component.name}</h3>
            {component.yield_quantity && (
              <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                Yield: {component.yield_quantity} {component.yield_unit}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-[10px]">
            {component.ingredients.length} ingredients |{" "}
            {component.steps.length} steps
          </span>
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-5">
          {component.ingredients.length > 0 && (
            <IngredientTable ingredients={component.ingredients} />
          )}
          {component.steps.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Steps
              </h4>
              <StepsList steps={component.steps} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Cost Sidebar Card ---
function CostCard({ recipe }: { recipe: RecipeDetail }) {
  return (
    <Card className="p-4 space-y-3 border-border/50 bg-card/50">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <DollarSign className="size-3" />
        Food Cost
      </h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Cost</span>
          <span className="font-semibold tabular-nums">
            {recipe.total_cost != null ? `$${recipe.total_cost.toFixed(2)}` : "--"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Per Serving</span>
          <span className="font-semibold tabular-nums">
            {recipe.cost_per_serving != null
              ? `$${recipe.cost_per_serving.toFixed(2)}`
              : "--"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Yield</span>
          <span className="tabular-nums">
            {recipe.yield_quantity ?? "--"} {recipe.yield_unit ?? ""}
          </span>
        </div>
        {recipe.total_weight_g != null && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Weight</span>
            <span className="tabular-nums">{recipe.total_weight_g}g</span>
          </div>
        )}
      </div>
    </Card>
  );
}

// --- Equipment Card ---
function EquipmentCard({ equipment }: { equipment: string[] }) {
  return (
    <Card className="p-4 space-y-3 border-border/50 bg-card/50">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Wrench className="size-3" />
        Equipment
      </h3>
      <ul className="space-y-1.5">
        {equipment.map((item, i) => (
          <li key={i} className="text-sm flex items-start gap-2">
            <span className="text-muted-foreground mt-1">-</span>
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// --- Tags Card ---
function TagsCard({ tags }: { tags: string[] }) {
  return (
    <Card className="p-4 space-y-3 border-border/50 bg-card/50">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Tag className="size-3" />
        Tags
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800/60 text-zinc-400 border border-zinc-700/30"
          >
            {tag}
          </span>
        ))}
      </div>
    </Card>
  );
}

// --- Loading skeleton ---
function RecipeDetailSkeleton() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-60 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;
  const { data: recipe, isLoading } = useRecipe(recipeId);
  const updateRecipe = useUpdateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const { toast } = useToast();

  function handleStatusChange(newStatus: string) {
    if (!recipe) return;
    updateRecipe.mutate(
      { id: recipe.id, status: newStatus },
      {
        onSuccess: () =>
          toast({
            title: "Status updated",
            description: `Recipe is now ${newStatus}`,
            variant: "success",
          }),
        onError: (err) =>
          toast({
            title: "Failed to update",
            description: err.message,
            variant: "error",
          }),
      }
    );
  }

  function handleDelete() {
    if (!recipe) return;
    deleteRecipe.mutate(recipe.id, {
      onSuccess: () => {
        toast({
          title: "Recipe deleted",
          description: recipe.name,
          variant: "success",
        });
        router.push("/recipes");
      },
      onError: (err) =>
        toast({
          title: "Failed to delete",
          description: err.message,
          variant: "error",
        }),
    });
  }

  if (isLoading) {
    return (
      <>
        <WorkspaceHeader title="Recipe" subtitle="Loading..." />
        <RecipeDetailSkeleton />
      </>
    );
  }

  if (!recipe) {
    return (
      <>
        <WorkspaceHeader title="Recipe" subtitle="Not found" />
        <div className="flex flex-col items-center justify-center py-20">
          <BookOpen className="size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Recipe not found
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push("/recipes")}
          >
            <ArrowLeft className="size-4 mr-1.5" />
            Back to Recipes
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <WorkspaceHeader title="Recipe" subtitle={recipe.category} />
      <div className="p-4 lg:p-6 space-y-6">
        {/* Title bar */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="mt-0.5"
              onClick={() => router.push("/recipes")}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  {recipe.name}
                </h1>
                <Badge
                  variant={statusVariant(recipe.status)}
                  className={statusColor(recipe.status)}
                >
                  {recipe.status.charAt(0).toUpperCase() +
                    recipe.status.slice(1)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {recipe.category}
                {recipe.source && recipe.source !== "manual" && (
                  <span className="ml-2 text-xs">
                    (imported via {recipe.source})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Status controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {recipe.status === "draft" && (
              <Button
                size="sm"
                variant="default"
                onClick={() => handleStatusChange("active")}
              >
                Activate
              </Button>
            )}
            {recipe.status === "active" && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleStatusChange("draft")}
                >
                  Revert to Draft
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusChange("archived")}
                >
                  Archive
                </Button>
              </>
            )}
            {recipe.status === "archived" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleStatusChange("draft")}
              >
                Restore to Draft
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Description */}
        {recipe.description && (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {recipe.description}
          </p>
        )}

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Left: Components */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Components
            </h2>
            {recipe.components && recipe.components.length > 0 ? (
              recipe.components.map((comp) => (
                <ComponentSection key={comp.id} component={comp} />
              ))
            ) : (
              <Card className="p-8 text-center border-border/30 bg-card/30">
                <ChefHat className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No components defined yet
                </p>
              </Card>
            )}
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-4">
            <CostCard recipe={recipe} />
            {recipe.equipment && recipe.equipment.length > 0 && (
              <EquipmentCard equipment={recipe.equipment} />
            )}
            {recipe.tags && recipe.tags.length > 0 && (
              <TagsCard tags={recipe.tags} />
            )}
            {recipe.notes && (
              <Card className="p-4 space-y-2 border-border/50 bg-card/50">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Chef&apos;s Notes
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {recipe.notes}
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
