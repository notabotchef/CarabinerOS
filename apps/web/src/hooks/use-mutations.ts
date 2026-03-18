"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  InboxItem,
  Order,
  InventoryItem,
  PrepTask,
  FoodCostItem,
  MenuItem,
  Campaign,
  Location,
  Recipe,
  RecipeDetail,
} from "@/lib/api";

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Generic fetch helpers
// ---------------------------------------------------------------------------

async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${ENGINE_URL}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
}

// ---------------------------------------------------------------------------
// Inbox mutations
// ---------------------------------------------------------------------------

export function useUpdateInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiPatch<InboxItem>(`/api/inbox/${id}`, data),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ["inbox"] });
      const prev = qc.getQueriesData<InboxItem[]>({ queryKey: ["inbox"] });
      qc.setQueriesData<InboxItem[]>({ queryKey: ["inbox"] }, (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  });
}

export function useDeleteInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/inbox/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["inbox"] });
      const prev = qc.getQueriesData<InboxItem[]>({ queryKey: ["inbox"] });
      qc.setQueriesData<InboxItem[]>({ queryKey: ["inbox"] }, (old) =>
        old?.filter((item) => item.id !== id)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  });
}

// ---------------------------------------------------------------------------
// Orders mutations
// ---------------------------------------------------------------------------

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiPatch<Order>(`/api/orders/${id}`, data),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ["orders"] });
      const prev = qc.getQueriesData<Order[]>({ queryKey: ["orders"] });
      qc.setQueriesData<Order[]>({ queryKey: ["orders"] }, (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/orders/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["orders"] });
      const prev = qc.getQueriesData<Order[]>({ queryKey: ["orders"] });
      qc.setQueriesData<Order[]>({ queryKey: ["orders"] }, (old) =>
        old?.filter((item) => item.id !== id)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

// ---------------------------------------------------------------------------
// Inventory mutations
// ---------------------------------------------------------------------------

export function useUpdateInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiPatch<InventoryItem>(`/api/inventory/${id}`, data),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ["inventory"] });
      const prev = qc.getQueriesData<InventoryItem[]>({ queryKey: ["inventory"] });
      qc.setQueriesData<InventoryItem[]>({ queryKey: ["inventory"] }, (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useDeleteInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/inventory/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["inventory"] });
      const prev = qc.getQueriesData<InventoryItem[]>({ queryKey: ["inventory"] });
      qc.setQueriesData<InventoryItem[]>({ queryKey: ["inventory"] }, (old) =>
        old?.filter((item) => item.id !== id)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

// ---------------------------------------------------------------------------
// Prep mutations
// ---------------------------------------------------------------------------

export function useUpdatePrep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiPatch<PrepTask>(`/api/prep/${id}`, data),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ["prep"] });
      const prev = qc.getQueriesData<PrepTask[]>({ queryKey: ["prep"] });
      qc.setQueriesData<PrepTask[]>({ queryKey: ["prep"] }, (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["prep"] }),
  });
}

export function useDeletePrep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/prep/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["prep"] });
      const prev = qc.getQueriesData<PrepTask[]>({ queryKey: ["prep"] });
      qc.setQueriesData<PrepTask[]>({ queryKey: ["prep"] }, (old) =>
        old?.filter((item) => item.id !== id)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["prep"] }),
  });
}

// ---------------------------------------------------------------------------
// Food Cost mutations
// ---------------------------------------------------------------------------

export function useUpdateFoodCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiPatch<FoodCostItem>(`/api/food-cost/${id}`, data),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ["food-cost"] });
      const prev = qc.getQueriesData<FoodCostItem[]>({ queryKey: ["food-cost"] });
      qc.setQueriesData<FoodCostItem[]>({ queryKey: ["food-cost"] }, (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["food-cost"] }),
  });
}

export function useDeleteFoodCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/food-cost/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["food-cost"] });
      const prev = qc.getQueriesData<FoodCostItem[]>({ queryKey: ["food-cost"] });
      qc.setQueriesData<FoodCostItem[]>({ queryKey: ["food-cost"] }, (old) =>
        old?.filter((item) => item.id !== id)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["food-cost"] }),
  });
}

// ---------------------------------------------------------------------------
// Menu mutations
// ---------------------------------------------------------------------------

export function useUpdateMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiPatch<MenuItem>(`/api/menu/${id}`, data),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ["menu"] });
      const prev = qc.getQueriesData<MenuItem[]>({ queryKey: ["menu"] });
      qc.setQueriesData<MenuItem[]>({ queryKey: ["menu"] }, (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["menu"] }),
  });
}

export function useDeleteMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/menu/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["menu"] });
      const prev = qc.getQueriesData<MenuItem[]>({ queryKey: ["menu"] });
      qc.setQueriesData<MenuItem[]>({ queryKey: ["menu"] }, (old) =>
        old?.filter((item) => item.id !== id)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["menu"] }),
  });
}

// ---------------------------------------------------------------------------
// Marketing (Campaign) mutations
// ---------------------------------------------------------------------------

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiPatch<Campaign>(`/api/marketing/${id}`, data),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ["marketing"] });
      const prev = qc.getQueriesData<Campaign[]>({ queryKey: ["marketing"] });
      qc.setQueriesData<Campaign[]>({ queryKey: ["marketing"] }, (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["marketing"] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/marketing/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["marketing"] });
      const prev = qc.getQueriesData<Campaign[]>({ queryKey: ["marketing"] });
      qc.setQueriesData<Campaign[]>({ queryKey: ["marketing"] }, (old) =>
        old?.filter((item) => item.id !== id)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["marketing"] }),
  });
}

// ---------------------------------------------------------------------------
// Location mutations
// ---------------------------------------------------------------------------

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiPatch<Location>(`/api/locations/${id}`, data),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ["locations"] });
      const prev = qc.getQueriesData<Location[]>({ queryKey: ["locations"] });
      qc.setQueriesData<Location[]>({ queryKey: ["locations"] }, (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });
}

// ---------------------------------------------------------------------------
// Recipe mutations
// ---------------------------------------------------------------------------

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost<RecipeDetail>("/api/recipes", data),
    onSettled: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useUpdateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      apiPatch<RecipeDetail>(`/api/recipes/${id}`, data),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ["recipes"] });
      const prev = qc.getQueriesData<Recipe[]>({ queryKey: ["recipes"] });
      qc.setQueriesData<Recipe[]>({ queryKey: ["recipes"] }, (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["recipe"] });
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/recipes/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["recipes"] });
      const prev = qc.getQueriesData<Recipe[]>({ queryKey: ["recipes"] });
      qc.setQueriesData<Recipe[]>({ queryKey: ["recipes"] }, (old) =>
        old?.filter((item) => item.id !== id)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/locations/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["locations"] });
      const prev = qc.getQueriesData<Location[]>({ queryKey: ["locations"] });
      qc.setQueriesData<Location[]>({ queryKey: ["locations"] }, (old) =>
        old?.filter((item) => item.id !== id)
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        for (const [key, data] of context.prev) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["locations"] }),
  });
}
