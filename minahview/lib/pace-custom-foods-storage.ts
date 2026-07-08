/** 사용자가 등록한 음식 (localStorage) */

import type { FoodRecord } from "@/lib/calorie-dataset"

export const PACE_CUSTOM_FOODS_KEY = "pace-custom-foods"

export type FoodNutritionPer100g = {
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  sodiumMg: number | null
  sugarG: number | null
  fiberG: number | null
}

export type CustomFoodRecord = FoodRecord & {
  isCustom: true
  nutrition: FoodNutritionPer100g
  createdAt: string
}

export function emptyNutrition(): FoodNutritionPer100g {
  return {
    proteinG: null,
    carbsG: null,
    fatG: null,
    sodiumMg: null,
    sugarG: null,
    fiberG: null,
  }
}

function isCustomFood(row: unknown): row is CustomFoodRecord {
  if (row === null || typeof row !== "object") return false
  const o = row as Record<string, unknown>
  return (
    o.isCustom === true &&
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.kcalPer100g === "number" &&
    typeof o.defaultServingG === "number" &&
    typeof o.category === "string" &&
    o.nutrition !== null &&
    typeof o.nutrition === "object"
  )
}

export function loadCustomFoods(): CustomFoodRecord[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(PACE_CUSTOM_FOODS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCustomFood)
  } catch {
    return []
  }
}

export function saveCustomFood(
  food: Omit<CustomFoodRecord, "id" | "isCustom" | "createdAt"> & { name: string },
): CustomFoodRecord {
  const entry: CustomFoodRecord = {
    id: `custom-${Date.now()}`,
    isCustom: true,
    name: food.name.trim(),
    category: food.category,
    kcalPer100g: food.kcalPer100g,
    defaultServingG: food.defaultServingG,
    aliases: food.aliases,
    nutrition: food.nutrition,
    createdAt: new Date().toISOString(),
  }
  const rest = loadCustomFoods()
  rest.unshift(entry)
  localStorage.setItem(PACE_CUSTOM_FOODS_KEY, JSON.stringify(rest.slice(0, 200)))
  return entry
}

export function scaleNutrition(
  nutrition: FoodNutritionPer100g,
  grams: number,
): FoodNutritionPer100g {
  const ratio = grams / 100
  const scale = (v: number | null) =>
    v != null && Number.isFinite(v) ? Math.round(v * ratio * 10) / 10 : null
  return {
    proteinG: scale(nutrition.proteinG),
    carbsG: scale(nutrition.carbsG),
    fatG: scale(nutrition.fatG),
    sodiumMg: scale(nutrition.sodiumMg),
    sugarG: scale(nutrition.sugarG),
    fiberG: scale(nutrition.fiberG),
  }
}
