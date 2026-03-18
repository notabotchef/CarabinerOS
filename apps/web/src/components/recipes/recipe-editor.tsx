"use client";

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useUpdateRecipe, useDeleteRecipe, useCreateRecipe } from "@/hooks/use-mutations";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ChefHat,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  DollarSign,
  Flame,
  GripVertical,
  Beaker,
  Package,
  Plus,
  Save,
  Scale,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Wrench,
  X,
  AlertTriangle,
  Check,
  FileText,
} from "lucide-react";
import { useRecipeLinkedMenuItems } from "@/hooks/use-api";
import type {
  RecipeDetail,
  RecipeComponent,
  RecipeComponentIngredient,
  RecipeStep,
  MenuItem,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Types for the local editor state (mutable versions of API types)
// ---------------------------------------------------------------------------

interface EditorIngredient {
  _key: string;
  name: string;
  weight_g: number;
  percentage: number | null;
  unit_display: string;
  sort_order: number;
  notes: string;
  item_id: string | null;
}

interface EditorStep {
  _key: string;
  step_number: number;
  instruction: string;
  temperature: string;
  duration: string;
  technique: string;
}

interface EditorComponent {
  _key: string;
  name: string;
  sort_order: number;
  yield_quantity: number | null;
  yield_unit: string;
  ingredients: EditorIngredient[];
  steps: EditorStep[];
  expanded: boolean;
}

interface EditorState {
  name: string;
  category: string;
  description: string;
  status: string;
  yield_quantity: number | null;
  yield_unit: string;
  total_weight_g: number | null;
  total_cost: number | null;
  cost_per_serving: number | null;
  image_url: string;
  equipment: string[];
  notes: string;
  tags: string[];
  components: EditorComponent[];
  source: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _keyCounter = 0;
function genKey(): string {
  return `_k${++_keyCounter}_${Date.now()}`;
}

function apiComponentsFromEditor(components: EditorComponent[]) {
  return components.map((c, ci) => ({
    name: c.name,
    sort_order: ci,
    yield_quantity: c.yield_quantity,
    yield_unit: c.yield_unit || null,
    ingredients: c.ingredients.map((ing, ii) => ({
      name: ing.name,
      weight_g: ing.weight_g,
      percentage: ing.percentage,
      unit_display: ing.unit_display || "g",
      sort_order: ii,
      notes: ing.notes || null,
      item_id: ing.item_id || null,
    })),
    steps: c.steps.map((s, si) => ({
      step_number: si + 1,
      instruction: s.instruction,
      temperature: s.temperature || null,
      duration: s.duration || null,
      technique: s.technique || null,
    })),
  }));
}

function editorStateFromRecipe(recipe: RecipeDetail): EditorState {
  return {
    name: recipe.name,
    category: recipe.category,
    description: recipe.description || "",
    status: recipe.status,
    yield_quantity: recipe.yield_quantity,
    yield_unit: recipe.yield_unit || "",
    total_weight_g: recipe.total_weight_g,
    total_cost: recipe.total_cost,
    cost_per_serving: recipe.cost_per_serving,
    image_url: recipe.image_url || "",
    equipment: recipe.equipment || [],
    notes: recipe.notes || "",
    tags: recipe.tags || [],
    source: recipe.source || "manual",
    components: (recipe.components || []).map((c) => ({
      _key: genKey(),
      name: c.name,
      sort_order: c.sort_order,
      yield_quantity: c.yield_quantity,
      yield_unit: c.yield_unit || "",
      expanded: true,
      ingredients: (c.ingredients || []).map((ing) => ({
        _key: genKey(),
        name: ing.name,
        weight_g: ing.weight_g,
        percentage: ing.percentage,
        unit_display: ing.unit_display || "g",
        sort_order: ing.sort_order,
        notes: ing.notes || "",
        item_id: ing.item_id || null,
      })),
      steps: (c.steps || []).map((s) => ({
        _key: genKey(),
        step_number: s.step_number,
        instruction: s.instruction,
        temperature: s.temperature || "",
        duration: s.duration || "",
        technique: s.technique || "",
      })),
    })),
  };
}

function blankIngredient(sortOrder: number): EditorIngredient {
  return {
    _key: genKey(),
    name: "",
    weight_g: 0,
    percentage: null,
    unit_display: "g",
    sort_order: sortOrder,
    notes: "",
    item_id: null,
  };
}

function blankStep(stepNum: number): EditorStep {
  return {
    _key: genKey(),
    step_number: stepNum,
    instruction: "",
    temperature: "",
    duration: "",
    technique: "",
  };
}

function blankComponent(sortOrder: number): EditorComponent {
  return {
    _key: genKey(),
    name: "",
    sort_order: sortOrder,
    yield_quantity: null,
    yield_unit: "",
    ingredients: [blankIngredient(0)],
    steps: [blankStep(1)],
    expanded: true,
  };
}

// Status config
const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  draft: {
    label: "Draft",
    color: "text-amber-400",
    dot: "bg-amber-400",
    bg: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  },
  active: {
    label: "Active",
    color: "text-emerald-400",
    dot: "bg-emerald-400",
    bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  },
  archived: {
    label: "Archived",
    color: "text-zinc-400",
    dot: "bg-zinc-400",
    bg: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
  },
};

const CATEGORIES = [
  "Bread", "Pastry", "Entree", "Appetizer", "Sauce",
  "Dessert", "Beverage", "Sous Vide", "Fermentation",
  "Base/Stock", "Garnish", "Other",
];

// ---------------------------------------------------------------------------
// Inline editable cell
// ---------------------------------------------------------------------------

function EditableCell({
  value,
  onChange,
  className = "",
  type = "text",
  placeholder = "",
  onTab,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  type?: "text" | "number";
  placeholder?: string;
  onTab?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (local !== value) onChange(local);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      commit();
    } else if (e.key === "Escape") {
      setLocal(value);
      setEditing(false);
    } else if (e.key === "Tab" && onTab) {
      commit();
      onTab();
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={`bg-transparent border-b border-primary/40 outline-none px-0 py-0.5 w-full ${className}`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-text hover:bg-muted/30 rounded px-1 -mx-1 py-0.5 transition-colors inline-block min-w-[2rem] ${
        !value ? "text-muted-foreground/40 italic" : ""
      } ${className}`}
    >
      {value || placeholder || "---"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Ingredient row
// ---------------------------------------------------------------------------

function IngredientRow({
  ingredient,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  ingredient: EditorIngredient;
  onUpdate: (updates: Partial<EditorIngredient>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="border-b border-border/20 hover:bg-muted/10 transition-colors group"
    >
      <td className="py-1.5 pr-2 w-6">
        <div className="flex flex-col opacity-0 group-hover:opacity-60 transition-opacity">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="text-muted-foreground hover:text-foreground disabled:invisible p-0 leading-none"
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="text-muted-foreground hover:text-foreground disabled:invisible p-0 leading-none"
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
      </td>
      <td className="py-1.5 pr-4">
        <EditableCell
          value={ingredient.name}
          onChange={(v) => onUpdate({ name: v })}
          className="font-medium text-sm"
          placeholder="Ingredient name"
        />
      </td>
      <td className="py-1.5 px-2 text-right">
        <EditableCell
          value={String(ingredient.weight_g || "")}
          onChange={(v) => onUpdate({ weight_g: parseFloat(v) || 0 })}
          type="number"
          className="text-sm tabular-nums text-right w-16 inline-block"
          placeholder="0"
        />
        <span className="text-muted-foreground text-xs ml-0.5">
          {ingredient.unit_display}
        </span>
      </td>
      <td className="py-1.5 px-2 text-right tabular-nums text-sm text-muted-foreground">
        <EditableCell
          value={ingredient.percentage != null ? String(ingredient.percentage) : ""}
          onChange={(v) => onUpdate({ percentage: v ? parseFloat(v) : null })}
          type="number"
          className="text-right w-12 inline-block tabular-nums text-muted-foreground"
          placeholder="--"
        />
        {ingredient.percentage != null && <span className="text-xs">%</span>}
      </td>
      <td className="py-1.5 pl-3">
        <EditableCell
          value={ingredient.notes}
          onChange={(v) => onUpdate({ notes: v })}
          className="text-xs text-muted-foreground italic"
          placeholder="Notes"
        />
      </td>
      <td className="py-1.5 pl-2 w-8">
        <button
          onClick={onRemove}
          className="text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </td>
    </motion.tr>
  );
}

// ---------------------------------------------------------------------------
// Step row
// ---------------------------------------------------------------------------

function StepRow({
  step,
  onUpdate,
  onRemove,
}: {
  step: EditorStep;
  onUpdate: (updates: Partial<EditorStep>) => void;
  onRemove: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex gap-3 group"
    >
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold tabular-nums mt-0.5">
        {step.step_number}
      </div>
      <div className="flex-1 space-y-1.5">
        <EditableCell
          value={step.instruction}
          onChange={(v) => onUpdate({ instruction: v })}
          className="text-sm leading-relaxed block w-full"
          placeholder="Describe this step..."
        />
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1">
            <Flame className="size-3 text-red-400/60" />
            <EditableCell
              value={step.temperature}
              onChange={(v) => onUpdate({ temperature: v })}
              className="text-[10px] text-red-400/80 w-24"
              placeholder="Temperature"
            />
          </div>
          <div className="flex items-center gap-1">
            <Clock className="size-3 text-blue-400/60" />
            <EditableCell
              value={step.duration}
              onChange={(v) => onUpdate({ duration: v })}
              className="text-[10px] text-blue-400/80 w-20"
              placeholder="Duration"
            />
          </div>
          <div className="flex items-center gap-1">
            <Beaker className="size-3 text-violet-400/60" />
            <EditableCell
              value={step.technique}
              onChange={(v) => onUpdate({ technique: v })}
              className="text-[10px] text-violet-400/80 w-20"
              placeholder="Technique"
            />
          </div>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 mt-1"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Component section
// ---------------------------------------------------------------------------

function ComponentEditor({
  component,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  component: EditorComponent;
  onUpdate: (updates: Partial<EditorComponent>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const totalWeight = component.ingredients.reduce(
    (acc, i) => acc + (i.weight_g || 0),
    0
  );

  function updateIngredient(idx: number, updates: Partial<EditorIngredient>) {
    const next = [...component.ingredients];
    next[idx] = { ...next[idx], ...updates };
    onUpdate({ ingredients: next });
  }

  function removeIngredient(idx: number) {
    onUpdate({
      ingredients: component.ingredients.filter((_, i) => i !== idx),
    });
  }

  function moveIngredient(idx: number, dir: -1 | 1) {
    const next = [...component.ingredients];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onUpdate({ ingredients: next });
  }

  function addIngredient() {
    onUpdate({
      ingredients: [
        ...component.ingredients,
        blankIngredient(component.ingredients.length),
      ],
    });
  }

  function updateStep(idx: number, updates: Partial<EditorStep>) {
    const next = [...component.steps];
    next[idx] = { ...next[idx], ...updates };
    onUpdate({ steps: next });
  }

  function removeStep(idx: number) {
    onUpdate({
      steps: component.steps
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, step_number: i + 1 })),
    });
  }

  function addStep() {
    onUpdate({
      steps: [
        ...component.steps,
        blankStep(component.steps.length + 1),
      ],
    });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="border border-border/30 rounded-lg overflow-hidden"
    >
      {/* Component header */}
      <div className="flex items-center gap-2 p-3 bg-muted/10">
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="text-muted-foreground/40 hover:text-foreground disabled:invisible p-0"
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="text-muted-foreground/40 hover:text-foreground disabled:invisible p-0"
          >
            <ChevronDown className="size-3" />
          </button>
        </div>

        <button
          onClick={() => onUpdate({ expanded: !component.expanded })}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {component.expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <div className="flex-1">
            <EditableCell
              value={component.name}
              onChange={(v) => onUpdate({ name: v })}
              className="font-semibold text-sm uppercase tracking-wide"
              placeholder="Component Name"
            />
          </div>
        </button>

        <span className="text-[10px] text-muted-foreground tabular-nums mr-2">
          {component.ingredients.length} ing. | {component.steps.length} steps
          {totalWeight > 0 && ` | ${totalWeight.toFixed(0)}g`}
        </span>

        <button
          onClick={onRemove}
          className="text-muted-foreground/30 hover:text-destructive transition-colors p-1"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {component.expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 space-y-5">
              {/* Ingredients table */}
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  Ingredients
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 text-[10px] text-muted-foreground uppercase tracking-widest">
                        <th className="w-6" />
                        <th className="text-left py-1.5 pr-4 font-medium">
                          Ingredient
                        </th>
                        <th className="text-right py-1.5 px-2 font-medium w-28">
                          Weight
                        </th>
                        <th className="text-right py-1.5 px-2 font-medium w-20">
                          Scaling
                        </th>
                        <th className="text-left py-1.5 pl-3 font-medium">
                          Notes
                        </th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <AnimatePresence>
                      <tbody>
                        {component.ingredients.map((ing, idx) => (
                          <IngredientRow
                            key={ing._key}
                            ingredient={ing}
                            onUpdate={(u) => updateIngredient(idx, u)}
                            onRemove={() => removeIngredient(idx)}
                            onMoveUp={() => moveIngredient(idx, -1)}
                            onMoveDown={() => moveIngredient(idx, 1)}
                            isFirst={idx === 0}
                            isLast={idx === component.ingredients.length - 1}
                          />
                        ))}
                      </tbody>
                    </AnimatePresence>
                    <tfoot>
                      <tr className="border-t border-border/40">
                        <td />
                        <td className="py-1.5 pr-4 text-[10px] font-semibold text-muted-foreground uppercase">
                          Total
                        </td>
                        <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-xs">
                          {totalWeight.toFixed(1)}
                          <span className="text-muted-foreground ml-0.5">g</span>
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addIngredient}
                  className="mt-1 text-xs text-muted-foreground"
                >
                  <Plus className="size-3 mr-1" />
                  Add Ingredient
                </Button>
              </div>

              {/* Steps */}
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Procedure
                </h4>
                <div className="space-y-3">
                  <AnimatePresence>
                    {component.steps.map((step, idx) => (
                      <StepRow
                        key={step._key}
                        step={step}
                        onUpdate={(u) => updateStep(idx, u)}
                        onRemove={() => removeStep(idx)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addStep}
                  className="mt-2 text-xs text-muted-foreground"
                >
                  <Plus className="size-3 mr-1" />
                  Add Step
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Natural language input banner
// ---------------------------------------------------------------------------

function NaturalLanguageInput({
  onParsed,
  locationId,
}: {
  onParsed: (state: EditorState) => void;
  locationId: string;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:8000";

  async function handleSubmit() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${ENGINE_URL}/api/recipes/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`Parse failed: ${res.status}`);
      const data = await res.json();
      const draft = data.draft;
      // Convert parsed draft into editor state
      const state: EditorState = {
        name: draft.name || "",
        category: draft.category || "Other",
        description: draft.description || "",
        status: "draft",
        yield_quantity: draft.yield_quantity,
        yield_unit: draft.yield_unit || "",
        total_weight_g: draft.total_weight_g || null,
        total_cost: draft.total_cost || null,
        cost_per_serving: draft.cost_per_serving || null,
        image_url: draft.image_url || "",
        equipment: draft.equipment || [],
        notes: draft.notes || "",
        tags: [...(draft.tags || []), "ai-generated"],
        source: draft.source || "llm",
        components: (draft.components || []).map((c: any) => ({
          _key: genKey(),
          name: c.name || "",
          sort_order: c.sort_order || 0,
          yield_quantity: c.yield_quantity || null,
          yield_unit: c.yield_unit || "",
          expanded: true,
          ingredients: (c.ingredients || []).map((ing: any) => ({
            _key: genKey(),
            name: ing.name || "",
            weight_g: ing.weight_g || 0,
            percentage: ing.percentage,
            unit_display: ing.unit_display || "g",
            sort_order: ing.sort_order || 0,
            notes: ing.notes || "",
            item_id: null,
          })),
          steps: (c.steps || []).map((s: any) => ({
            _key: genKey(),
            step_number: s.step_number || 0,
            instruction: s.instruction || "",
            temperature: s.temperature || "",
            duration: s.duration || "",
            technique: s.technique || "",
          })),
        })),
      };
      onParsed(state);
      setText("");
      setExpanded(false);
    } catch {
      // silently fail for now
    } finally {
      setLoading(false);
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-primary/20 bg-primary/[0.02] hover:bg-primary/5 hover:border-primary/30 transition-all text-sm text-muted-foreground"
      >
        <Sparkles className="size-4 text-primary/60" />
        <span>Describe your recipe in natural language...</span>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-primary/20 bg-primary/[0.02] p-4 space-y-3"
    >
      <div className="flex items-center gap-2 text-xs text-primary/80">
        <Sparkles className="size-3.5" />
        <span className="font-medium uppercase tracking-wider">
          AI Recipe Generation
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe your recipe... e.g., 'Duck confit with orange glaze, sous vide at 155F for 36 hours, served with roasted root vegetables and a citrus gastrique'"
        className="w-full bg-transparent border border-border/30 rounded-md p-3 text-sm resize-none h-24 focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground/40"
        autoFocus
      />
      <div className="flex justify-between items-center">
        <button
          onClick={() => {
            setExpanded(false);
            setText("");
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
        >
          {loading ? (
            <>
              <span className="animate-pulse">Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="size-3.5 mr-1.5" />
              Generate Recipe
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// AI parsed banner
// ---------------------------------------------------------------------------

function AIParsedBanner({ source }: { source: string }) {
  if (source !== "llm" && source !== "ocr") return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
      <Sparkles className="size-3.5" />
      <span>
        Parsed by AI ({source === "llm" ? "text" : "image/scan"}) — review and
        edit all fields before activating
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan Recipe button (file upload)
// ---------------------------------------------------------------------------

function ScanRecipeButton({
  onParsed,
}: {
  onParsed: (state: EditorState) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:8000";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      // For now, send the filename as text to the parse endpoint
      const res = await fetch(`${ENGINE_URL}/api/recipes/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Scanned recipe from file: ${file.name}`,
          image_url: null,
        }),
      });
      if (!res.ok) throw new Error(`Parse failed: ${res.status}`);
      const data = await res.json();
      const draft = data.draft;
      const state: EditorState = {
        name: draft.name || file.name.replace(/\.[^.]+$/, ""),
        category: draft.category || "Other",
        description: draft.description || "",
        status: "draft",
        yield_quantity: draft.yield_quantity,
        yield_unit: draft.yield_unit || "",
        total_weight_g: null,
        total_cost: null,
        cost_per_serving: null,
        image_url: "",
        equipment: draft.equipment || [],
        notes: "",
        tags: [...(draft.tags || []), "scanned"],
        source: "ocr",
        components: (draft.components || []).map((c: any) => ({
          _key: genKey(),
          name: c.name || "",
          sort_order: c.sort_order || 0,
          yield_quantity: c.yield_quantity || null,
          yield_unit: c.yield_unit || "",
          expanded: true,
          ingredients: (c.ingredients || []).map((ing: any) => ({
            _key: genKey(),
            name: ing.name || "",
            weight_g: ing.weight_g || 0,
            percentage: ing.percentage,
            unit_display: ing.unit_display || "g",
            sort_order: ing.sort_order || 0,
            notes: ing.notes || "",
            item_id: null,
          })),
          steps: (c.steps || []).map((s: any) => ({
            _key: genKey(),
            step_number: s.step_number || 0,
            instruction: s.instruction || "",
            temperature: s.temperature || "",
            duration: s.duration || "",
            technique: s.technique || "",
          })),
        })),
      };
      onParsed(state);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf,.txt"
        onChange={handleFile}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={loading}
      >
        <Upload className="size-4 mr-1.5" />
        {loading ? "Scanning..." : "Scan Recipe"}
      </Button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cost & Inventory sidebar
// ---------------------------------------------------------------------------

function CostPanel({ state }: { state: EditorState }) {
  const totalWeight = state.components.reduce(
    (acc, c) => acc + c.ingredients.reduce((a, i) => a + (i.weight_g || 0), 0),
    0
  );
  const totalIngredients = state.components.reduce(
    (acc, c) => acc + c.ingredients.length,
    0
  );

  return (
    <Card className="p-4 space-y-3 border-border/50 bg-card/50">
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
        <DollarSign className="size-3" />
        Cost & Inventory
      </h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Cost</span>
          <span className="font-semibold tabular-nums">
            {state.total_cost != null ? `$${state.total_cost.toFixed(2)}` : "--"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Per Serving</span>
          <span className="font-semibold tabular-nums">
            {state.cost_per_serving != null
              ? `$${state.cost_per_serving.toFixed(2)}`
              : "--"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Yield</span>
          <span className="tabular-nums">
            {state.yield_quantity ?? "--"} {state.yield_unit}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Weight</span>
          <span className="tabular-nums">{totalWeight.toFixed(0)}g</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Ingredients</span>
          <span className="tabular-nums">{totalIngredients}</span>
        </div>
      </div>

      {/* Inventory status indicators */}
      <div className="pt-2 border-t border-border/30 space-y-1.5">
        <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Inventory Status
        </h4>
        {state.components.flatMap((c) => c.ingredients).filter((i) => i.name).slice(0, 8).map((ing) => (
          <div key={ing._key} className="flex items-center gap-2 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            <span className="flex-1 truncate text-muted-foreground">
              {ing.name}
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              Not linked
            </span>
          </div>
        ))}
        {totalIngredients === 0 && (
          <p className="text-[10px] text-muted-foreground/40 italic">
            Add ingredients to see inventory status
          </p>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Equipment & tags sidebar
// ---------------------------------------------------------------------------

function MetadataSidebar({
  state,
  onUpdate,
}: {
  state: EditorState;
  onUpdate: (updates: Partial<EditorState>) => void;
}) {
  const [newEquipment, setNewEquipment] = useState("");
  const [newTag, setNewTag] = useState("");

  return (
    <div className="space-y-4">
      {/* Equipment */}
      <Card className="p-4 space-y-3 border-border/50 bg-card/50">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Wrench className="size-3" />
          Equipment
        </h3>
        <ul className="space-y-1">
          {state.equipment.map((item, i) => (
            <li
              key={i}
              className="flex items-center gap-2 text-sm group"
            >
              <span className="flex-1">{item}</span>
              <button
                onClick={() =>
                  onUpdate({
                    equipment: state.equipment.filter((_, idx) => idx !== i),
                  })
                }
                className="text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1">
          <Input
            value={newEquipment}
            onChange={(e) => setNewEquipment(e.target.value)}
            placeholder="Add equipment..."
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newEquipment.trim()) {
                onUpdate({
                  equipment: [...state.equipment, newEquipment.trim()],
                });
                setNewEquipment("");
              }
            }}
          />
        </div>
      </Card>

      {/* Tags */}
      <Card className="p-4 space-y-3 border-border/50 bg-card/50">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Tag className="size-3" />
          Tags
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {state.tags.map((tag, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800/60 text-zinc-400 border border-zinc-700/30 flex items-center gap-1 group"
            >
              {tag}
              <button
                onClick={() =>
                  onUpdate({
                    tags: state.tags.filter((_, idx) => idx !== i),
                  })
                }
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add tag..."
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTag.trim()) {
                onUpdate({ tags: [...state.tags, newTag.trim()] });
                setNewTag("");
              }
            }}
          />
        </div>
      </Card>

      {/* Chef's Notes */}
      <Card className="p-4 space-y-3 border-border/50 bg-card/50">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <FileText className="size-3" />
          Chef&apos;s Notes
        </h3>
        <textarea
          value={state.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Add preparation notes, tips, or variations..."
          className="w-full bg-transparent border border-border/30 rounded-md p-2 text-sm resize-none h-20 focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground/40"
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linked Menu Items
// ---------------------------------------------------------------------------

function LinkedMenuItems({ recipeId }: { recipeId: string | null }) {
  const { data: menuItems } = useRecipeLinkedMenuItems(recipeId);

  if (!recipeId) return null;

  return (
    <Card className="p-4 space-y-3 border-border/50 bg-card/50">
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
        <Package className="size-3" />
        Linked Menu Items
      </h3>
      {menuItems && menuItems.length > 0 ? (
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 font-medium">{item.item_name}</span>
              <span className="text-[10px] text-muted-foreground">
                {item.category}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground/50 italic">
          No menu items linked to this recipe. Link from the Menu module.
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Recipe Editor
// ---------------------------------------------------------------------------

interface RecipeEditorProps {
  recipe?: RecipeDetail;
  isNew?: boolean;
  locationId?: string;
}

export function RecipeEditor({ recipe, isNew, locationId }: RecipeEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const updateRecipe = useUpdateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const createRecipe = useCreateRecipe();

  const [state, setState] = useState<EditorState>(() => {
    if (recipe) return editorStateFromRecipe(recipe);
    return {
      name: "",
      category: "Other",
      description: "",
      status: "draft",
      yield_quantity: null,
      yield_unit: "servings",
      total_weight_g: null,
      total_cost: null,
      cost_per_serving: null,
      image_url: "",
      equipment: [],
      notes: "",
      tags: [],
      source: "manual",
      components: [blankComponent(0)],
    };
  });

  const [dirty, setDirty] = useState(false);
  const [showAIBanner, setShowAIBanner] = useState(
    recipe?.source === "llm" || recipe?.source === "ocr"
  );

  function update(updates: Partial<EditorState>) {
    setState((prev) => ({ ...prev, ...updates }));
    setDirty(true);
  }

  function updateComponent(idx: number, updates: Partial<EditorComponent>) {
    setState((prev) => {
      const next = [...prev.components];
      next[idx] = { ...next[idx], ...updates };
      return { ...prev, components: next };
    });
    setDirty(true);
  }

  function removeComponent(idx: number) {
    setState((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== idx),
    }));
    setDirty(true);
  }

  function moveComponent(idx: number, dir: -1 | 1) {
    setState((prev) => {
      const next = [...prev.components];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, components: next };
    });
    setDirty(true);
  }

  function addComponent() {
    setState((prev) => ({
      ...prev,
      components: [...prev.components, blankComponent(prev.components.length)],
    }));
    setDirty(true);
  }

  // Validate for activation
  function canActivate(): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    if (!state.name.trim()) warnings.push("Recipe name is required");
    if (state.components.length === 0)
      warnings.push("At least one component is required");
    const hasIngredients = state.components.some(
      (c) => c.ingredients.length > 0 && c.ingredients.some((i) => i.name.trim())
    );
    if (!hasIngredients)
      warnings.push("At least one ingredient is required");
    return { valid: warnings.length === 0, warnings };
  }

  function handleStatusChange(newStatus: string) {
    if (newStatus === "active") {
      const { valid, warnings } = canActivate();
      if (!valid) {
        toast({
          title: "Cannot activate recipe",
          description: warnings.join(". "),
          variant: "error",
        });
        return;
      }
    }
    update({ status: newStatus });
    // If editing existing recipe, save the status change immediately
    if (recipe) {
      updateRecipe.mutate(
        { id: recipe.id, status: newStatus },
        {
          onSuccess: () =>
            toast({
              title: "Status updated",
              description: `Recipe is now ${newStatus}`,
              variant: "success",
            }),
        }
      );
    }
  }

  async function handleSave() {
    const payload = {
      name: state.name,
      category: state.category,
      description: state.description || null,
      status: state.status,
      yield_quantity: state.yield_quantity,
      yield_unit: state.yield_unit || null,
      total_weight_g: state.total_weight_g,
      total_cost: state.total_cost,
      cost_per_serving: state.cost_per_serving,
      image_url: state.image_url || null,
      equipment: state.equipment,
      notes: state.notes || null,
      tags: state.tags,
      source: state.source,
      components: apiComponentsFromEditor(state.components),
    };

    if (isNew || !recipe) {
      createRecipe.mutate(
        { ...payload, location_id: locationId || "00000000-0000-0000-0001-000000000001" } as any,
        {
          onSuccess: (data: any) => {
            toast({
              title: "Recipe created",
              description: state.name,
              variant: "success",
            });
            setDirty(false);
            router.push(`/recipes/${data.id}`);
          },
          onError: (err: any) =>
            toast({
              title: "Failed to create",
              description: err.message,
              variant: "error",
            }),
        }
      );
    } else {
      updateRecipe.mutate(
        { id: recipe.id, ...payload } as any,
        {
          onSuccess: () => {
            toast({
              title: "Recipe saved",
              description: state.name,
              variant: "success",
            });
            setDirty(false);
          },
          onError: (err: any) =>
            toast({
              title: "Failed to save",
              description: err.message,
              variant: "error",
            }),
        }
      );
    }
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

  function handleAIParsed(parsedState: EditorState) {
    setState(parsedState);
    setDirty(true);
    setShowAIBanner(true);
  }

  const statusConf = STATUS_CONFIG[state.status] || STATUS_CONFIG.draft;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* AI Banner */}
      {showAIBanner && <AIParsedBanner source={state.source} />}

      {/* Natural Language Input */}
      <NaturalLanguageInput
        onParsed={handleAIParsed}
        locationId={locationId || ""}
      />

      {/* Title bar */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            onClick={() => router.push("/recipes")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="space-y-2 flex-1">
            {/* Recipe name - large editable */}
            <input
              value={state.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="RECIPE NAME"
              className="text-xl font-bold tracking-tight bg-transparent border-none outline-none w-full uppercase placeholder:text-muted-foreground/30"
            />

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {/* Status */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${statusConf.dot}`}
                />
                <select
                  value={state.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="bg-transparent text-xs font-medium border-none outline-none cursor-pointer"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Category */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="uppercase tracking-widest text-[10px]">
                  Category
                </span>
                <select
                  value={state.category}
                  onChange={(e) => update({ category: e.target.value })}
                  className="bg-transparent text-xs border-none outline-none cursor-pointer text-foreground"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Yield */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="uppercase tracking-widest text-[10px]">
                  Yield
                </span>
                <input
                  value={state.yield_quantity ?? ""}
                  onChange={(e) =>
                    update({
                      yield_quantity: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                  type="number"
                  className="bg-transparent border-none outline-none w-12 tabular-nums text-xs text-foreground"
                  placeholder="--"
                />
                <input
                  value={state.yield_unit}
                  onChange={(e) => update({ yield_unit: e.target.value })}
                  className="bg-transparent border-none outline-none w-20 text-xs text-foreground"
                  placeholder="unit"
                />
              </div>
            </div>

            {/* Description */}
            <textarea
              value={state.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Recipe description..."
              className="w-full bg-transparent border-none outline-none text-sm text-muted-foreground resize-none leading-relaxed placeholder:text-muted-foreground/30"
              rows={2}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {dirty && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/25">
                Unsaved
              </Badge>
            </motion.div>
          )}

          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateRecipe.isPending || createRecipe.isPending}
          >
            <Save className="size-4 mr-1.5" />
            {isNew ? "Create" : "Save"}
          </Button>

          {recipe && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Activation warning */}
      {state.status === "active" && (() => {
        const { valid, warnings } = canActivate();
        if (!valid)
          return (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              <AlertTriangle className="size-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">Incomplete recipe is active: </span>
                {warnings.join(". ")}
              </div>
            </div>
          );
        return null;
      })()}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Left: Components */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Components
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={addComponent}
              className="text-xs"
            >
              <Plus className="size-3 mr-1" />
              Add Component
            </Button>
          </div>

          <AnimatePresence>
            {state.components.map((comp, idx) => (
              <ComponentEditor
                key={comp._key}
                component={comp}
                onUpdate={(u) => updateComponent(idx, u)}
                onRemove={() => removeComponent(idx)}
                onMoveUp={() => moveComponent(idx, -1)}
                onMoveDown={() => moveComponent(idx, 1)}
                isFirst={idx === 0}
                isLast={idx === state.components.length - 1}
              />
            ))}
          </AnimatePresence>

          {state.components.length === 0 && (
            <Card className="p-8 text-center border-dashed border-border/30 bg-card/30">
              <ChefHat className="size-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                No components yet
              </p>
              <Button variant="outline" size="sm" onClick={addComponent}>
                <Plus className="size-3 mr-1" />
                Add First Component
              </Button>
            </Card>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">
          <CostPanel state={state} />
          {recipe && <LinkedMenuItems recipeId={recipe.id} />}
          <MetadataSidebar state={state} onUpdate={update} />
        </div>
      </div>
    </div>
  );
}
