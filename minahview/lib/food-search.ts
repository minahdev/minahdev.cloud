import {
  FOOD_DATASET,
  MAFRA_FOOD_DATASET,
  matchesFood,
  normalizeQuery,
  type FoodRecord,
} from "@/lib/calorie-dataset"
import { loadCustomFoods, type CustomFoodRecord } from "@/lib/pace-custom-foods-storage"

export type SearchableFood = FoodRecord | CustomFoodRecord

export function getAllFoods(): SearchableFood[] {
  return [...loadCustomFoods(), ...MAFRA_FOOD_DATASET, ...FOOD_DATASET]
}

export function searchFoods(query: string, limit = 12): SearchableFood[] {
  const q = normalizeQuery(query)
  if (!q) return []
  return getAllFoods().filter((f) => matchesFood(f, q)).slice(0, limit)
}

export function isCustomFood(food: SearchableFood): food is CustomFoodRecord {
  return "isCustom" in food && food.isCustom === true
}
