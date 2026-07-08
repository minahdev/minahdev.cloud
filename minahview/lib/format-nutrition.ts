import type { FoodNutritionPer100g } from "@/lib/pace-custom-foods-storage"

export function formatNutritionBrief(n: FoodNutritionPer100g): string {
  const parts: string[] = []
  if (n.proteinG != null) parts.push(`단백질 ${n.proteinG}g`)
  if (n.carbsG != null) parts.push(`탄수 ${n.carbsG}g`)
  if (n.fatG != null) parts.push(`지방 ${n.fatG}g`)
  if (n.sodiumMg != null) parts.push(`나트륨 ${n.sodiumMg}mg`)
  if (n.sugarG != null) parts.push(`당 ${n.sugarG}g`)
  if (n.fiberG != null) parts.push(`식이섬유 ${n.fiberG}g`)
  return parts.join(" · ")
}

export function hasNutritionData(n: FoodNutritionPer100g | undefined): boolean {
  if (!n) return false
  return formatNutritionBrief(n).length > 0
}
