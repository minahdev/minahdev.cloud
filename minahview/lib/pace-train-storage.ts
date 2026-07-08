/** 일일 훈련 로그 (Neon / inbody API) */

import { getLoggedInUserId } from "@/lib/auth-session"
import { inbodyFetch, withUserId } from "@/lib/inbody-api"
import type { FoodNutritionPer100g } from "@/lib/pace-custom-foods-storage"

export const PACE_TRAIN_LOGS_KEY = "pace-train-daily-logs"

export type DietFoodEntry = {
  foodId: string
  name: string
  grams: number
  kcalPer100g: number
  kcal: number
  /** 1회 섭취량 기준 영양소 (있을 때) */
  nutrition?: FoodNutritionPer100g
  isCustom?: boolean
}

export type DietMeal = {
  note: string
  foods: DietFoodEntry[]
}

export type TrainDiet = {
  breakfast: DietMeal
  lunch: DietMeal
  dinner: DietMeal
  snack: DietMeal
  waterMl: number | null
  supplements: string
}

export type TrainDailyLog = {
  date: string
  muscles: string[]
  /** 오늘 한 운동 — 자유 서술 */
  workout: string
  weightKg: number | null
  diet: TrainDiet
  memo: string
  exerciseMinutes: number | null
}

export function emptyDietMeal(): DietMeal {
  return { note: "", foods: [] }
}

export function emptyDiet(): TrainDiet {
  return {
    breakfast: emptyDietMeal(),
    lunch: emptyDietMeal(),
    dinner: emptyDietMeal(),
    snack: emptyDietMeal(),
    waterMl: null,
    supplements: "",
  }
}

export function mealKcal(meal: DietMeal): number {
  return meal.foods.reduce((sum, f) => sum + f.kcal, 0)
}

export function dietTotalKcal(diet: TrainDiet): number {
  return (
    mealKcal(diet.breakfast) +
    mealKcal(diet.lunch) +
    mealKcal(diet.dinner) +
    mealKcal(diet.snack)
  )
}

export function mealHasContent(meal: DietMeal): boolean {
  return Boolean(meal.note.trim()) || meal.foods.length > 0
}

function normalizeNutrition(raw: unknown): FoodNutritionPer100g | undefined {
  if (raw === null || typeof raw !== "object") return undefined
  const n = raw as Record<string, unknown>
  const num = (k: string) => {
    const v = n[k]
    if (v === null || v === undefined || v === "") return null
    const x = typeof v === "number" ? v : Number(v)
    return Number.isFinite(x) ? x : null
  }
  const hasAny =
    num("proteinG") != null ||
    num("carbsG") != null ||
    num("fatG") != null ||
    num("sodiumMg") != null ||
    num("sugarG") != null ||
    num("fiberG") != null
  if (!hasAny) return undefined
  return {
    proteinG: num("proteinG"),
    carbsG: num("carbsG"),
    fatG: num("fatG"),
    sodiumMg: num("sodiumMg"),
    sugarG: num("sugarG"),
    fiberG: num("fiberG"),
  }
}

function normalizeFoodEntry(raw: unknown): DietFoodEntry | null {
  if (raw === null || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (typeof o.foodId !== "string" || typeof o.name !== "string") return null
  const grams = typeof o.grams === "number" ? o.grams : Number(o.grams)
  const kcalPer100g = typeof o.kcalPer100g === "number" ? o.kcalPer100g : Number(o.kcalPer100g)
  const kcal = typeof o.kcal === "number" ? o.kcal : Number(o.kcal)
  if (!Number.isFinite(grams) || grams <= 0) return null
  if (!Number.isFinite(kcalPer100g)) return null
  const nutrition = normalizeNutrition(o.nutrition)
  return {
    foodId: o.foodId,
    name: o.name,
    grams: Math.round(grams),
    kcalPer100g,
    kcal: Number.isFinite(kcal) ? Math.round(kcal) : Math.round((kcalPer100g * grams) / 100),
    nutrition,
    isCustom: o.isCustom === true,
  }
}

function normalizeMeal(raw: unknown): DietMeal {
  if (typeof raw === "string") {
    return { note: raw, foods: [] }
  }
  if (raw === null || typeof raw !== "object") return emptyDietMeal()
  const o = raw as Record<string, unknown>
  const foods = Array.isArray(o.foods)
    ? o.foods.map(normalizeFoodEntry).filter((f): f is DietFoodEntry => f !== null)
    : []
  return {
    note: typeof o.note === "string" ? o.note : "",
    foods,
  }
}

export function trainLogTodayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function normalizeWorkout(raw: unknown): string {
  if (typeof raw === "string") return raw
  if (raw === null || typeof raw !== "object") return ""
  const w = raw as Record<string, unknown>
  const parts: string[] = []
  if (typeof w.title === "string" && w.title.trim()) parts.push(w.title.trim())
  const detail: string[] = []
  if (w.sets != null && w.reps != null) detail.push(`${w.sets}세트 × ${w.reps}회`)
  else if (w.sets != null) detail.push(`${w.sets}세트`)
  else if (w.reps != null) detail.push(`${w.reps}회`)
  if (w.weightKg != null) detail.push(`${w.weightKg}kg`)
  if (w.distanceKm != null) detail.push(`${w.distanceKm}km`)
  if (w.durationMin != null) detail.push(`${w.durationMin}분`)
  if (w.intensity === "easy") detail.push("강도: 가볍게")
  if (w.intensity === "moderate") detail.push("강도: 보통")
  if (w.intensity === "hard") detail.push("강도: 강하게")
  if (detail.length) parts.push(detail.join(", "))
  if (typeof w.notes === "string" && w.notes.trim()) parts.push(w.notes.trim())
  return parts.join("\n")
}

function normalizeLog(row: unknown): TrainDailyLog | null {
  if (row === null || typeof row !== "object") return null
  const o = row as Record<string, unknown>
  const dietRaw = o.diet as Record<string, unknown> | undefined
  if (typeof o.date !== "string") return null

  const muscles = Array.isArray(o.muscles)
    ? o.muscles.filter((m): m is string => typeof m === "string")
    : []

  return {
    date: o.date,
    muscles,
    workout: normalizeWorkout(o.workout),
    weightKg: o.weightKg === null || typeof o.weightKg === "number" ? (o.weightKg as number | null) : null,
    diet: {
      breakfast: normalizeMeal(dietRaw?.breakfast),
      lunch: normalizeMeal(dietRaw?.lunch),
      dinner: normalizeMeal(dietRaw?.dinner),
      snack: normalizeMeal(dietRaw?.snack),
      waterMl:
        dietRaw?.waterMl === null || typeof dietRaw?.waterMl === "number"
          ? (dietRaw.waterMl as number | null)
          : null,
      supplements: typeof dietRaw?.supplements === "string" ? dietRaw.supplements : "",
    },
    memo: typeof o.memo === "string" ? o.memo : "",
    exerciseMinutes:
      o.exerciseMinutes === null || typeof o.exerciseMinutes === "number"
        ? (o.exerciseMinutes as number | null)
        : null,
  }
}

export async function loadTrainLogs(): Promise<TrainDailyLog[]> {
  const userId = getLoggedInUserId()
  if (!userId) return []
  const rows = await inbodyFetch<unknown[]>(withUserId("/api/inbody/train-logs", userId))
  if (!Array.isArray(rows)) return []
  return rows.map(normalizeLog).filter((l): l is TrainDailyLog => l !== null)
}

export async function fetchTodayTrainLog(): Promise<TrainDailyLog | null> {
  const userId = getLoggedInUserId()
  if (!userId) return null
  const key = trainLogTodayKey()
  const row = await inbodyFetch<unknown | null>(
    withUserId("/api/inbody/train-logs", userId, { date: key }),
  )
  if (!row) return null
  return normalizeLog(row)
}

export async function saveTodayTrainLog(fields: {
  muscles: string[]
  workout: string
  weightKg: number | null
  diet: TrainDiet
  memo: string
  exerciseMinutes: number | null
}): Promise<void> {
  const userId = getLoggedInUserId()
  if (!userId) throw new Error("로그인이 필요합니다.")
  const date = trainLogTodayKey()
  await inbodyFetch("/api/inbody/train-logs", {
    method: "PUT",
    body: JSON.stringify({
      userId,
      date,
      muscles: fields.muscles,
      workout: fields.workout,
      weightKg: fields.weightKg,
      diet: fields.diet,
      memo: fields.memo,
      exerciseMinutes: fields.exerciseMinutes,
    }),
  })
}

export function hasWorkoutActivity(log: TrainDailyLog): boolean {
  return Boolean(log.workout.trim()) || log.muscles.length > 0
}

export function dietHasContent(diet: TrainDiet): boolean {
  return (
    mealHasContent(diet.breakfast) ||
    mealHasContent(diet.lunch) ||
    mealHasContent(diet.dinner) ||
    mealHasContent(diet.snack) ||
    diet.waterMl != null ||
    Boolean(diet.supplements.trim())
  )
}
