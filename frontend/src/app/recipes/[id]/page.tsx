"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  Undo2,
  ScanLine,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  parseIngredientLine,
  parsedToIngredientDraft,
  gramsToDisplay,
  convertToGrams,
  convertIngredientDisplay,
  scaleComponents,
  formatQty,
} from "@/lib/recipe-utils";
import type {
  UnitSystem,
  RecipeDetail,
  RecipeComponentDraft,
  RecipeIngredientDraft,
  RecipeStepDraft,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SCALE_FACTORS = [0.5, 0.75, 1, 2, 3];
const CATEGORIES = [
  "Sauces",
  "Proteins",
  "Sides",
  "Desserts",
  "Appetizers",
  "Beverages",
  "Prep",
  "Pastry",
  "Other",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function emptyComponent(sortOrder: number): RecipeComponentDraft {
  return {
    id: crypto.randomUUID(),
    name: "Main",
    sort_order: sortOrder,
    ingredients: [],
    steps: [{ id: crypto.randomUUID(), step_number: 1, instruction: "" }],
  };
}

function recipeToComponents(recipe: RecipeDetail): RecipeComponentDraft[] {
  return recipe.components.map((c) => ({
    id: c.id,
    name: c.name,
    sort_order: c.sort_order,
    yield_quantity: c.yield_quantity ?? undefined,
    yield_unit: c.yield_unit ?? undefined,
    ingredients: c.ingredients.map((ing) => ({
      id: ing.id,
      name: ing.name,
      weight_g: ing.weight_g,
      unit_display: ing.unit_display,
      sort_order: ing.sort_order,
      notes: ing.notes,
      percentage: ing.percentage ?? undefined,
    })),
    steps: c.steps.map((s) => ({
      id: s.id,
      step_number: s.step_number,
      instruction: s.instruction,
      temperature: s.temperature,
      duration: s.duration,
      technique: s.technique,
    })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function RecipeEditorPage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;
  const isNew = recipeId === "new";

  // Core state
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [yieldQty, setYieldQty] = useState("");
  const [yieldUnit, setYieldUnit] = useState("portions");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [components, setComponents] = useState<RecipeComponentDraft[]>([
    emptyComponent(0),
  ]);
  const [locationId, setLocationId] = useState<string | null>(null);

  // Editor state
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [scaleFactor, setScaleFactor] = useState<number | null>(null);
  const [preScaleComponents, setPreScaleComponents] =
    useState<RecipeComponentDraft[] | null>(null);
  const [targetYieldQty, setTargetYieldQty] = useState("");
  const [targetYieldUnit, setTargetYieldUnit] = useState("g");
  const [quickAdd, setQuickAdd] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [dirty, setDirty] = useState(false);

  // Refs
  const quickAddRef = useRef<HTMLInputElement>(null);
  const methodRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // ---------- Fetch recipe ----------

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    fetch(`/api/recipes/${recipeId}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        const recipe: RecipeDetail = json.data ?? json;
        if (cancelled) return;
        setName(recipe.name);
        setCategory(recipe.category);
        setDescription(recipe.description ?? "");
        setStatus(recipe.status);
        setYieldQty(
          recipe.yield_quantity != null ? String(recipe.yield_quantity) : "",
        );
        setYieldUnit(recipe.yield_unit ?? "portions");
        setNotes(recipe.notes ?? "");
        setTags(recipe.tags ?? []);
        setLocationId(recipe.location_id);
        const comps = recipeToComponents(recipe);
        setComponents(comps.length > 0 ? comps : [emptyComponent(0)]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipeId, isNew]);

  // ---------- Location fallback ----------

  useEffect(() => {
    if (locationId || !isNew) return;
    fetch("/api/hq", { credentials: "include" })
      .then((r) => r.json())
      .then((hq) => {
        if (hq.active_location_id) setLocationId(hq.active_location_id);
        else if (hq.locations?.length) setLocationId(hq.locations[0].id);
      })
      .catch(() => {});
  }, [isNew, locationId]);

  // ---------- Save ----------

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        category,
        description: description || undefined,
        status,
        yield_quantity: yieldQty ? Number(yieldQty) : undefined,
        yield_unit: yieldUnit || undefined,
        notes: notes || undefined,
        tags: tags.length > 0 ? tags : undefined,
        components: components.map((c) => ({
          name: c.name,
          sort_order: c.sort_order,
          yield_quantity: c.yield_quantity,
          yield_unit: c.yield_unit,
          ingredients: c.ingredients.map((ing) => ({
            name: ing.name,
            weight_g: ing.weight_g,
            unit_display: ing.unit_display,
            sort_order: ing.sort_order,
            notes: ing.notes || undefined,
            percentage: ing.percentage,
          })),
          steps: c.steps
            .filter((s) => s.instruction.trim())
            .map((s) => ({
              step_number: s.step_number,
              instruction: s.instruction,
              temperature: s.temperature || undefined,
              duration: s.duration || undefined,
              technique: s.technique || undefined,
            })),
        })),
        ...(isNew && locationId ? { location_id: locationId } : {}),
      };

      const url = isNew ? "/api/recipes" : `/api/recipes/${recipeId}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      const json = await res.json();
      setDirty(false);

      if (isNew && json.data?.id) {
        router.replace(`/recipes/${json.data.id}`);
      }
    } catch {
      // Fail silently for now; toast system can be added later
    } finally {
      setSaving(false);
    }
  }, [
    name, category, description, status, yieldQty, yieldUnit,
    notes, tags, components, isNew, recipeId, locationId, router,
  ]);

  // ---------- Delete ----------

  const handleDelete = useCallback(async () => {
    if (isNew) return;
    const res = await fetch(`/api/recipes/${recipeId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) router.push("/recipes");
  }, [isNew, recipeId, router]);

  // ---------- Scaling ----------

  const handleScale = useCallback(
    (factor: number) => {
      if (!preScaleComponents) setPreScaleComponents(components);
      const base = preScaleComponents ?? components;
      setComponents(scaleComponents(base, factor));
      setScaleFactor(factor);
      if (yieldQty) {
        const baseYield = preScaleComponents
          ? Number(yieldQty) / (scaleFactor ?? 1)
          : Number(yieldQty);
        setYieldQty(String(Math.round(baseYield * factor * 10) / 10));
      }
      setDirty(true);
    },
    [components, preScaleComponents, yieldQty, scaleFactor],
  );

  const handleUndoScale = useCallback(() => {
    if (preScaleComponents) {
      setComponents(preScaleComponents);
      setPreScaleComponents(null);
      setScaleFactor(null);
      setDirty(true);
    }
  }, [preScaleComponents]);

  // ---------- Smart Add (ingredient parsing) ----------

  const activeCompIndex = 0; // For now, add to first component

  const handleQuickAddKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter" || !quickAdd.trim()) return;
      const parsed = parseIngredientLine(quickAdd);
      const comp = components[activeCompIndex];
      const draft = parsedToIngredientDraft(parsed, comp.ingredients.length);
      const newComps = [...components];
      newComps[activeCompIndex] = {
        ...comp,
        ingredients: [...comp.ingredients, draft],
      };
      setComponents(newComps);
      setQuickAdd("");
      setDirty(true);
    },
    [quickAdd, components],
  );

  const handleQuickAddPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text");
      if (!text.includes("\n")) return;
      e.preventDefault();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const comp = components[activeCompIndex];
      const newIngs = lines.map((line, i) =>
        parsedToIngredientDraft(
          parseIngredientLine(line),
          comp.ingredients.length + i,
        ),
      );
      const newComps = [...components];
      newComps[activeCompIndex] = {
        ...comp,
        ingredients: [...comp.ingredients, ...newIngs],
      };
      setComponents(newComps);
      setQuickAdd("");
      setDirty(true);
    },
    [components],
  );

  // ---------- Ingredient CRUD ----------

  const updateIngredient = useCallback(
    (compIdx: number, ingIdx: number, updates: Partial<RecipeIngredientDraft>) => {
      const newComps = [...components];
      const comp = { ...newComps[compIdx] };
      const ings = [...comp.ingredients];
      ings[ingIdx] = { ...ings[ingIdx], ...updates };
      comp.ingredients = ings;
      newComps[compIdx] = comp;
      setComponents(newComps);
      setDirty(true);
    },
    [components],
  );

  const removeIngredient = useCallback(
    (compIdx: number, ingIdx: number) => {
      const newComps = [...components];
      const comp = { ...newComps[compIdx] };
      comp.ingredients = comp.ingredients.filter((_, i) => i !== ingIdx);
      newComps[compIdx] = comp;
      setComponents(newComps);
      setDirty(true);
    },
    [components],
  );

  const addIngredientRow = useCallback(
    (compIdx: number) => {
      const newComps = [...components];
      const comp = { ...newComps[compIdx] };
      comp.ingredients = [
        ...comp.ingredients,
        {
          id: crypto.randomUUID(),
          name: "",
          weight_g: 0,
          unit_display: "g",
          sort_order: comp.ingredients.length,
        },
      ];
      newComps[compIdx] = comp;
      setComponents(newComps);
      setDirty(true);
    },
    [components],
  );

  // ---------- Step CRUD ----------

  const updateStep = useCallback(
    (compIdx: number, stepIdx: number, instruction: string) => {
      const newComps = [...components];
      const comp = { ...newComps[compIdx] };
      const steps = [...comp.steps];
      steps[stepIdx] = { ...steps[stepIdx], instruction };
      comp.steps = steps;
      newComps[compIdx] = comp;
      setComponents(newComps);
      setDirty(true);
    },
    [components],
  );

  const removeStep = useCallback(
    (compIdx: number, stepIdx: number) => {
      const newComps = [...components];
      const comp = { ...newComps[compIdx] };
      comp.steps = comp.steps
        .filter((_, i) => i !== stepIdx)
        .map((s, i) => ({ ...s, step_number: i + 1 }));
      newComps[compIdx] = comp;
      setComponents(newComps);
      setDirty(true);
    },
    [components],
  );

  const handleStepKeyDown = useCallback(
    (compIdx: number, stepIdx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      if (e.key === "Enter" && !e.shiftKey) {
        if (target.selectionStart === target.value.length && target.value.trim()) {
          e.preventDefault();
          const newComps = [...components];
          const comp = { ...newComps[compIdx] };
          const newStep: RecipeStepDraft = {
            id: crypto.randomUUID(),
            step_number: comp.steps.length + 1,
            instruction: "",
          };
          comp.steps = [
            ...comp.steps.slice(0, stepIdx + 1),
            newStep,
            ...comp.steps.slice(stepIdx + 1).map((s) => ({
              ...s,
              step_number: s.step_number + 1,
            })),
          ];
          newComps[compIdx] = comp;
          setComponents(newComps);
          setDirty(true);
          setTimeout(() => {
            methodRefs.current[newStep.id]?.focus();
          }, 20);
        }
      } else if (
        e.key === "Backspace" &&
        !target.value &&
        components[compIdx].steps.length > 1
      ) {
        e.preventDefault();
        const prevIdx = Math.max(0, stepIdx - 1);
        const prevId = components[compIdx].steps[prevIdx]?.id;
        removeStep(compIdx, stepIdx);
        setTimeout(() => {
          if (prevId) methodRefs.current[prevId]?.focus();
        }, 20);
      }
    },
    [components, removeStep],
  );

  const handleStepPaste = useCallback(
    (compIdx: number, stepIdx: number, e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text");
      if (!text.includes("\n")) return;
      e.preventDefault();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/^\d+[.)]\s*/, ""))
        .filter(Boolean);
      if (lines.length === 0) return;
      const newComps = [...components];
      const comp = { ...newComps[compIdx] };
      const newSteps = lines.map((line, i) => ({
        id: crypto.randomUUID(),
        step_number: stepIdx + i + 1,
        instruction: line,
      }));
      comp.steps = [
        ...comp.steps.slice(0, stepIdx),
        ...newSteps,
        ...comp.steps.slice(stepIdx + 1).map((s, i) => ({
          ...s,
          step_number: stepIdx + newSteps.length + i + 1,
        })),
      ];
      newComps[compIdx] = comp;
      setComponents(newComps);
      setDirty(true);
    },
    [components],
  );

  // ---------- Auto-resize textareas ----------

  const handleAutoResize = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      target.style.height = "auto";
      target.style.height = target.scrollHeight + "px";
    },
    [],
  );

  // ---------- Chat send ----------

  const handleChatSend = useCallback(() => {
    if (!chatInput.trim()) return;
    // Send to A0 with recipe context
    const contextPrefix = name
      ? `[Recipe: ${name}] `
      : "[Recipe Editor] ";
    fetch("/message", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: contextPrefix + chatInput.trim() }),
    }).catch(() => {});
    setChatInput("");
  }, [chatInput, name]);

  // ---------- Scan recipe ----------

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleScanRecipe = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const contextPrefix = name
        ? `[Recipe: ${name}] `
        : "[Recipe Editor] ";
      fetch("/message", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${contextPrefix}Parse this recipe image and return structured ingredients and steps: [Attached: ${file.name}]`,
        }),
      }).catch(() => {});
      e.target.value = "";
    },
    [name],
  );

  // ---------- Display helpers ----------

  const getDisplayQty = useCallback(
    (ing: RecipeIngredientDraft): string => {
      if (unitSystem === "metric") {
        return formatQty(gramsToDisplay(ing.weight_g, ing.unit_display));
      }
      const converted = convertIngredientDisplay(
        ing.weight_g,
        ing.unit_display,
        "us",
      );
      return formatQty(converted.qty);
    },
    [unitSystem],
  );

  const getDisplayUnit = useCallback(
    (ing: RecipeIngredientDraft): string => {
      if (unitSystem === "metric") return ing.unit_display;
      const converted = convertIngredientDisplay(
        ing.weight_g,
        ing.unit_display,
        "us",
      );
      return converted.unit;
    },
    [unitSystem],
  );

  // ---------- Keyboard shortcuts ----------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if (isCmd && e.key === "k") {
        e.preventDefault();
        quickAddRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  // ---------- Loading ----------

  if (loading) {
    return (
      <div className="flex flex-col h-dvh bg-background">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0 bg-card">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-48" />
        </header>
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ---------- Render ----------

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* ---- Header ---- */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0 bg-card">
        <button
          onClick={() => router.push("/recipes")}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="text-[10px] font-medium px-2 py-0.5 h-auto rounded-full capitalize"
            >
              {status}
            </Badge>
            {dirty && (
              <span className="text-[10px] text-muted-foreground">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleScanRecipe}
            >
              <ScanLine className="h-3.5 w-3.5 mr-1.5" />
              Scan
            </Button>
            {!isNew && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf"
          onChange={handleFileSelected}
        />
      </header>

      {/* ---- Editor body ---- */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {/* Title */}
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              placeholder="Recipe Title"
              className="w-full text-xl font-bold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDirty(true);
              }}
              placeholder="Brief description..."
              className="w-full mt-1 text-sm text-muted-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Meta row: category, yield, scale, unit toggle */}
          <div className="flex flex-wrap items-start gap-6 border-t border-border pt-6">
            {/* Category */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Category
              </span>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setDirty(true);
                }}
                className="block text-sm font-medium text-foreground bg-card border border-border rounded-lg px-2 py-1 outline-none focus:border-primary/50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Yield */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Yield
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={yieldQty}
                  onChange={(e) => {
                    setYieldQty(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="0"
                  className="w-16 text-sm font-mono font-semibold text-foreground bg-card border border-border rounded-lg px-2 py-1 outline-none focus:border-primary/50"
                />
                <input
                  type="text"
                  value={yieldUnit}
                  onChange={(e) => {
                    setYieldUnit(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="unit"
                  className="w-20 text-sm text-muted-foreground bg-card border border-border rounded-lg px-2 py-1 outline-none focus:border-primary/50"
                />
              </div>
            </div>

            {/* Scaling */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Scale
              </span>
              <div className="flex items-center gap-1">
                {SCALE_FACTORS.map((f) => (
                  <button
                    key={f}
                    onClick={() => handleScale(f)}
                    className={`px-2 py-1 font-mono text-[11px] font-semibold rounded-lg border transition-colors ${
                      scaleFactor === f
                        ? "border-primary text-primary bg-primary/5"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {f}x
                  </button>
                ))}
                <div className="w-px h-5 bg-border mx-1" />
                <input
                  type="number"
                  placeholder="Qty"
                  value={targetYieldQty}
                  onChange={(e) => setTargetYieldQty(e.target.value)}
                  className="w-14 text-[11px] font-mono font-semibold bg-card border border-border rounded-lg px-2 py-1 outline-none focus:border-primary/50"
                />
                <select
                  value={targetYieldUnit}
                  onChange={(e) => setTargetYieldUnit(e.target.value)}
                  className="text-[10px] font-semibold uppercase tracking-widest bg-card border border-border rounded-lg px-1 py-1 outline-none"
                >
                  {["g", "kg", "ml", "l", "oz", "lb", "fl oz", "cup"].map(
                    (u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ),
                  )}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => {
                    const qty = parseFloat(targetYieldQty);
                    if (isNaN(qty) || !yieldQty) return;
                    const factor = qty / Number(yieldQty);
                    if (factor > 0 && isFinite(factor)) handleScale(factor);
                  }}
                >
                  Scale
                </Button>
                {scaleFactor !== null && scaleFactor !== 1 && (
                  <button
                    onClick={handleUndoScale}
                    className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Undo2 className="h-3 w-3" />
                    Undo
                  </button>
                )}
              </div>
            </div>

            {/* Unit toggle */}
            <div className="space-y-1 ml-auto">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Units
              </span>
              <div className="flex items-center p-0.5 bg-secondary rounded-lg border border-border">
                <button
                  onClick={() => setUnitSystem("metric")}
                  className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-widest rounded-md transition-all ${
                    unitSystem === "metric"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  Metric
                </button>
                <button
                  onClick={() => setUnitSystem("us")}
                  className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-widest rounded-md transition-all ${
                    unitSystem === "us"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  US
                </button>
              </div>
            </div>
          </div>

          {/* ---- Mise en Place ---- */}
          {components.map((comp, compIdx) => (
            <section key={comp.id} className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground">
                  Mise en Place
                  {components.length > 1 && (
                    <span className="text-muted-foreground ml-2">
                      / {comp.name}
                    </span>
                  )}
                </h3>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {comp.ingredients.length} ingredient
                  {comp.ingredients.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Smart Add */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40">
                  <Plus className="h-4 w-4" />
                </div>
                <input
                  ref={compIdx === 0 ? quickAddRef : undefined}
                  value={compIdx === 0 ? quickAdd : undefined}
                  onChange={
                    compIdx === 0
                      ? (e) => setQuickAdd(e.target.value)
                      : undefined
                  }
                  onKeyDown={compIdx === 0 ? handleQuickAddKeyDown : undefined}
                  onPaste={compIdx === 0 ? handleQuickAddPaste : undefined}
                  placeholder='Smart Add: "200g salt" or "5 cups flour"'
                  className="w-full bg-card border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Ingredient table */}
              <div className="space-y-0">
                {/* Header */}
                <div className="grid grid-cols-[72px_64px_1fr_32px] gap-4 px-2 pb-2 border-b border-border">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Qty
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Unit
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Ingredient
                  </span>
                  <span />
                </div>

                {/* Rows */}
                {comp.ingredients.map((ing, ingIdx) => (
                  <motion.div
                    key={ing.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-[72px_64px_1fr_32px] gap-4 py-2 px-2 items-start border-b border-border/50 group"
                  >
                    <input
                      className="font-mono text-sm font-semibold text-foreground bg-transparent border-none outline-none w-full"
                      value={getDisplayQty(ing)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          const newWeightG = convertToGrams(val, getDisplayUnit(ing));
                          updateIngredient(compIdx, ingIdx, { weight_g: newWeightG });
                        }
                      }}
                    />
                    <input
                      className="text-[11px] font-semibold text-muted-foreground bg-transparent border-none outline-none w-full uppercase"
                      value={getDisplayUnit(ing)}
                      onChange={(e) =>
                        updateIngredient(compIdx, ingIdx, {
                          unit_display: e.target.value,
                        })
                      }
                    />
                    <div className="min-w-0 space-y-0.5">
                      <input
                        className="text-sm font-medium text-foreground bg-transparent border-none outline-none w-full"
                        value={ing.name}
                        placeholder="Ingredient name..."
                        onChange={(e) =>
                          updateIngredient(compIdx, ingIdx, {
                            name: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            ingIdx === comp.ingredients.length - 1
                          ) {
                            e.preventDefault();
                            addIngredientRow(compIdx);
                          }
                        }}
                      />
                      <input
                        className="text-[11px] text-muted-foreground italic bg-transparent border-none outline-none w-full"
                        placeholder="notes..."
                        value={ing.notes ?? ""}
                        onChange={(e) =>
                          updateIngredient(compIdx, ingIdx, {
                            notes: e.target.value,
                          })
                        }
                      />
                    </div>
                    <button
                      onClick={() => removeIngredient(compIdx, ingIdx)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground/40 hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}

                {/* Add row */}
                <button
                  onClick={() => addIngredientRow(compIdx)}
                  className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mt-3 px-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Row
                </button>
              </div>

              {/* ---- Execution (Steps) ---- */}
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground">
                    Execution
                    {components.length > 1 && (
                      <span className="text-muted-foreground ml-2">
                        / {comp.name}
                      </span>
                    )}
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {comp.steps.filter((s) => s.instruction.trim()).length} step
                    {comp.steps.filter((s) => s.instruction.trim()).length !== 1
                      ? "s"
                      : ""}
                  </span>
                </div>

                <div className="space-y-2">
                  {comp.steps.map((step, stepIdx) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-4 group"
                    >
                      <div className="font-mono text-xs font-semibold text-muted-foreground pt-2 w-8 shrink-0 text-right">
                        {String(stepIdx + 1).padStart(2, "0")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <textarea
                          ref={(el) => {
                            methodRefs.current[step.id] = el;
                          }}
                          className="w-full text-sm text-foreground bg-transparent border-none outline-none resize-none leading-relaxed placeholder:text-muted-foreground/40"
                          value={step.instruction}
                          rows={1}
                          placeholder="Describe this step..."
                          onChange={(e) =>
                            updateStep(compIdx, stepIdx, e.target.value)
                          }
                          onInput={handleAutoResize}
                          onKeyDown={(e) =>
                            handleStepKeyDown(compIdx, stepIdx, e)
                          }
                          onPaste={(e) =>
                            handleStepPaste(compIdx, stepIdx, e)
                          }
                        />
                      </div>
                      <button
                        onClick={() => removeStep(compIdx, stepIdx)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground/40 hover:text-destructive transition-all pt-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newComps = [...components];
                      const c = { ...newComps[compIdx] };
                      c.steps = [
                        ...c.steps,
                        {
                          id: crypto.randomUUID(),
                          step_number: c.steps.length + 1,
                          instruction: "",
                        },
                      ];
                      newComps[compIdx] = c;
                      setComponents(newComps);
                      setDirty(true);
                    }}
                    className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors ml-12"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Step
                  </button>
                </div>
              </div>
            </section>
          ))}

          {/* ---- Critical Controls (Chef Notes) ---- */}
          <section className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-foreground">
              Critical Controls
            </h3>
            <textarea
              className="w-full text-sm text-foreground bg-transparent border-none outline-none resize-none leading-relaxed placeholder:text-muted-foreground/40"
              placeholder="Key technical notes, temperatures, storage requirements..."
              value={notes}
              rows={3}
              onInput={handleAutoResize}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
            />
          </section>

          {/* ---- Chat ---- */}
          <section className="border-t border-border pt-6 space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Ask CarabinerOS
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSend();
                  }
                }}
                placeholder="Generate steps for this recipe, cost it out, scale to 5x..."
                className="flex-1 bg-card border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
              />
              <Button
                size="sm"
                onClick={handleChatSend}
                disabled={!chatInput.trim()}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Generate steps for this recipe",
                "What's the plate cost?",
                "Scale to 5x",
                "Suggest ingredient substitutions",
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => {
                    setChatInput(chip);
                  }}
                  className="text-[10px] text-muted-foreground bg-secondary hover:bg-secondary/80 px-2.5 py-1 rounded-full transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
