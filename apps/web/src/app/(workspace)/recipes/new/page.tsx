"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { RecipeEditor } from "@/components/recipes/recipe-editor";

export default function NewRecipePage() {
  const locationId = useWorkspaceStore((s) => s.activeLocationId);

  return (
    <>
      <WorkspaceHeader title="New Recipe" subtitle="Create a new recipe" />
      <RecipeEditor isNew locationId={locationId || undefined} />
    </>
  );
}
