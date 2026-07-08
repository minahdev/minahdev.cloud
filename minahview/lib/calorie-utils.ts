import type { FoodRecord } from "@/lib/calorie-dataset"

export function kcalForFood(
  food: Pick<FoodRecord, "kcalPer100g"> &
    Partial<Pick<FoodRecord, "kcalPerServing" | "defaultServingG">>,
  grams: number,
): number {
  const servingG = food.defaultServingG ?? 0
  if (food.kcalPerServing != null && servingG > 0) {
    return Math.round((food.kcalPerServing * grams) / servingG)
  }
  return Math.round((food.kcalPer100g * grams) / 100)
}
