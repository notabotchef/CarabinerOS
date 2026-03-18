"use client";

import { useParams, useRouter } from "next/navigation";
import { useRecipe } from "@/hooks/use-api";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen } from "lucide-react";

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
  const locationId = useWorkspaceStore((s) => s.activeLocationId);
  const { data: recipe, isLoading } = useRecipe(recipeId);

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
      <WorkspaceHeader title="Recipe Editor" subtitle={recipe.category} />
      <RecipeEditor
        recipe={recipe}
        locationId={locationId || undefined}
      />
    </>
  );
}
