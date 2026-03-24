/**
 * Recipe utilities: ingredient parsing, unit conversion, and scaling.
 *
 * Ported from mepai-capture interaction patterns, adapted for CarabinerOS
 * data models (weight_g-based, RecipeComponentDraft structures).
 */

import type { UnitSystem, RecipeIngredientDraft, RecipeComponentDraft } from "./types";

// ---------------------------------------------------------------------------
// Ingredient Parser (Smart Add)
// ---------------------------------------------------------------------------

export interface ParsedIngredient {
  qty?: number;
  unit?: string;
  name: string;
  notes?: string;
}

const UNIT_ALIASES: Record<string, string> = {
  gram: "g", grams: "g", gr: "g",
  kilogram: "kg", kilograms: "kg",
  milligram: "mg",
  milliliter: "ml", milliliters: "ml",
  liter: "l", liters: "l",
  teaspoon: "tsp", teaspoons: "tsp",
  tablespoon: "tbsp", tablespoons: "tbsp",
  cups: "cup", c: "cup",
  ounce: "oz", ounces: "oz",
  lbs: "lb", pound: "lb", pounds: "lb",
  each: "ea", pc: "ea", pcs: "ea", piece: "ea", pieces: "ea",
};

const FILLER_WORDS = ["of"];

export function parseIngredientLine(line: string): ParsedIngredient {
  let trimmed = line.trim().replace(/^([-*]|\d+[.)])\s*/, "").trim();
  if (!trimmed) return { name: "" };

  const originalInput = trimmed;

  // 1. Parse quantity (fractions, compound fractions, decimals)
  const qtyRegex = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s*/;
  const qtyMatch = trimmed.match(qtyRegex);

  let qty: number | undefined;
  if (qtyMatch) {
    const qtyStr = qtyMatch[1].trim();
    if (qtyStr.includes("/")) {
      const parts = qtyStr.split(/\s+/);
      if (parts.length === 2) {
        const [num, den] = parts[1].split("/").map(Number);
        qty = Number(parts[0]) + num / den;
      } else {
        const [num, den] = parts[0].split("/").map(Number);
        qty = num / den;
      }
    } else {
      qty = Number(qtyStr);
    }
    trimmed = trimmed.slice(qtyMatch[0].length).trim();
  }

  // 2. Parse unit
  const knownUnits = [
    "fl oz", ...Object.keys(UNIT_ALIASES),
    "g", "kg", "ml", "l", "oz", "lb", "tsp", "tbsp", "cup", "ea", "mg",
  ];
  const sortedUnits = knownUnits.sort((a, b) => b.length - a.length);
  const unitRegex = new RegExp(`^(${sortedUnits.join("|")})\\b`, "i");
  const unitMatch = trimmed.match(unitRegex);

  let unit: string | undefined;
  if (unitMatch) {
    const foundUnit = unitMatch[1].toLowerCase();
    unit = UNIT_ALIASES[foundUnit] || foundUnit;
    trimmed = trimmed.slice(unitMatch[0].length).trim();
  }

  // 3. Remove filler words
  for (const filler of FILLER_WORDS) {
    const fillerRegex = new RegExp(`^${filler}\\s+`, "i");
    if (fillerRegex.test(trimmed)) {
      trimmed = trimmed.replace(fillerRegex, "").trim();
    }
  }

  // 4. Extract notes from separators
  let name = trimmed;
  let notes: string | undefined;

  if (name.toLowerCase().endsWith("to taste")) {
    notes = "to taste";
    name = name.slice(0, -8).replace(/[\s,]+$/, "").trim();
  }

  for (const sep of [",", "-", "("]) {
    if (name.includes(sep)) {
      const parts = name.split(sep);
      const possibleName = parts[0].trim();
      const possibleNote = parts.slice(1).join(sep).replace(/\)$/, "").trim();
      if (!notes) {
        name = possibleName;
        notes = possibleNote;
      }
      break;
    }
  }

  // 5. Fallback: if no qty/unit parsed, return whole input as name
  if (qty === undefined && !unit) {
    return { name: originalInput };
  }

  return {
    qty: qty !== undefined && !isNaN(qty) ? Number(qty.toFixed(3)) : undefined,
    unit,
    name: name || "Unknown Ingredient",
    notes,
  };
}

/**
 * Convert a parsed ingredient into a RecipeIngredientDraft with weight_g.
 */
export function parsedToIngredientDraft(
  parsed: ParsedIngredient,
  sortOrder: number,
): RecipeIngredientDraft {
  const weightG = parsed.qty != null && parsed.unit
    ? convertToGrams(parsed.qty, parsed.unit)
    : parsed.qty ?? 0;

  return {
    id: crypto.randomUUID(),
    name: parsed.name,
    weight_g: weightG,
    unit_display: parsed.unit ?? "g",
    sort_order: sortOrder,
    notes: parsed.notes,
  };
}

// ---------------------------------------------------------------------------
// Unit Conversion
// ---------------------------------------------------------------------------

const METRIC_VOLUME = ["ml", "l"];
const US_VOLUME = ["tsp", "tbsp", "fl oz", "cup"];

/** Convert any unit+qty to grams (weight) or ml-as-grams (volume). */
export function convertToGrams(qty: number, unit: string): number {
  const u = unit.toLowerCase().trim();
  if (u === "g") return qty;
  if (u === "kg") return qty * 1000;
  if (u === "mg") return qty / 1000;
  if (u === "oz") return qty * 28.3495;
  if (u === "lb") return qty * 453.592;
  // Volume units: treat as ml equivalent for storage
  if (u === "ml") return qty;
  if (u === "l") return qty * 1000;
  if (u === "tsp") return qty * 4.92892;
  if (u === "tbsp") return qty * 14.7868;
  if (u === "fl oz") return qty * 29.5735;
  if (u === "cup") return qty * 236.588;
  if (u === "ea") return qty;
  return qty;
}

/** Convert weight_g back to a display quantity for a given unit. */
export function gramsToDisplay(weightG: number, unitDisplay: string): number {
  const u = unitDisplay.toLowerCase().trim();
  if (u === "g") return weightG;
  if (u === "kg") return weightG / 1000;
  if (u === "mg") return weightG * 1000;
  if (u === "oz") return weightG / 28.3495;
  if (u === "lb") return weightG / 453.592;
  if (u === "ml") return weightG;
  if (u === "l") return weightG / 1000;
  if (u === "tsp") return weightG / 4.92892;
  if (u === "tbsp") return weightG / 14.7868;
  if (u === "fl oz") return weightG / 29.5735;
  if (u === "cup") return weightG / 236.588;
  if (u === "ea") return weightG;
  return weightG;
}

/** Convert an ingredient's display between metric and US. */
export function convertIngredientDisplay(
  weightG: number,
  currentUnit: string,
  target: UnitSystem,
): { qty: number; unit: string } {
  if (target === "metric") {
    const isVolume = [...METRIC_VOLUME, ...US_VOLUME].includes(currentUnit.toLowerCase());
    if (isVolume) {
      if (weightG >= 1000) return { qty: Math.round(weightG / 10) / 100, unit: "L" };
      return { qty: Math.round(weightG), unit: "ml" };
    }
    if (weightG >= 1000) return { qty: Math.round(weightG / 10) / 100, unit: "kg" };
    return { qty: Math.round(weightG), unit: "g" };
  }

  // US conversion
  const isVolume = [...METRIC_VOLUME, ...US_VOLUME].includes(currentUnit.toLowerCase());
  if (isVolume) {
    const cups = weightG / 236.588;
    if (cups >= 1) return { qty: Math.round(cups * 20) / 20, unit: "cup" };
    const floz = weightG / 29.5735;
    if (floz >= 2) return { qty: Math.round(floz * 10) / 10, unit: "fl oz" };
    const tbsp = weightG / 14.7868;
    if (tbsp >= 1) return { qty: Math.round(tbsp * 4) / 4, unit: "tbsp" };
    const tsp = weightG / 4.92892;
    return { qty: Math.round(tsp * 4) / 4, unit: "tsp" };
  }
  const lb = weightG / 453.592;
  if (lb >= 1) return { qty: Math.round(lb * 10) / 10, unit: "lb" };
  const oz = weightG / 28.3495;
  return { qty: Math.round(oz * 10) / 10, unit: "oz" };
}

// ---------------------------------------------------------------------------
// Scaling
// ---------------------------------------------------------------------------

function roundScaled(val: number, unit: string): number {
  const u = unit.toLowerCase().trim();
  if (["g", "ml", "kg", "l"].includes(u)) return Math.round(val);
  if (["oz", "fl oz", "lb"].includes(u)) return Math.round(val * 10) / 10;
  if (["tbsp", "tsp"].includes(u)) return Math.round(val * 4) / 4;
  if (["cup"].includes(u)) return Math.round(val * 20) / 20;
  if (u === "ea") return Math.round(val * 2) / 2;
  return Math.round(val * 100) / 100;
}

/** Scale all components by a factor. Returns new components array. */
export function scaleComponents(
  components: RecipeComponentDraft[],
  factor: number,
): RecipeComponentDraft[] {
  return components.map((comp) => ({
    ...comp,
    ingredients: comp.ingredients.map((ing) => ({
      ...ing,
      weight_g: roundScaled(ing.weight_g * factor, ing.unit_display),
    })),
    yield_quantity: comp.yield_quantity
      ? Math.round(comp.yield_quantity * factor * 10) / 10
      : undefined,
  }));
}

/** Format a number for display: removes trailing zeros. */
export function formatQty(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
