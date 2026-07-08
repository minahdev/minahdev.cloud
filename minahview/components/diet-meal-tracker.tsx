"use client"

import { useMemo, useState } from "react"
import { Plus, Search, X } from "lucide-react"

import { CustomFoodForm } from "@/components/custom-food-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { foodKcalLabel } from "@/lib/calorie-dataset"
import { kcalForFood } from "@/lib/calorie-utils"
import { formatNutritionBrief, hasNutritionData } from "@/lib/format-nutrition"
import { isCustomFood, searchFoods, type SearchableFood } from "@/lib/food-search"
import { scaleNutrition } from "@/lib/pace-custom-foods-storage"
import { mealKcal, type DietFoodEntry, type DietMeal } from "@/lib/pace-train-storage"
import { cn } from "@/lib/utils"

type DietMealTrackerProps = {
  label: string
  meal: DietMeal
  onChange: (meal: DietMeal) => void
}

function addFoodFromSearch(meal: DietMeal, food: SearchableFood, grams: number): DietMeal {
  const kcal = kcalForFood(food, grams)
  const entry: DietFoodEntry = {
    foodId: food.id,
    name: food.name,
    grams,
    kcalPer100g: food.kcalPer100g,
    kcal,
    isCustom: isCustomFood(food),
    nutrition: isCustomFood(food) ? scaleNutrition(food.nutrition, grams) : undefined,
  }
  return { ...meal, foods: [...meal.foods, entry] }
}

function addCustomEntry(meal: DietMeal, entry: DietFoodEntry): DietMeal {
  return { ...meal, foods: [...meal.foods, entry] }
}

function removeFood(meal: DietMeal, index: number): DietMeal {
  return { ...meal, foods: meal.foods.filter((_, i) => i !== index) }
}

export function DietMealTracker({ label, meal, onChange }: DietMealTrackerProps) {
  const [query, setQuery] = useState("")
  const [grams, setGrams] = useState(100)
  const [searchTick, setSearchTick] = useState(0)

  const results = useMemo(() => {
    void searchTick
    return searchFoods(query, 8)
  }, [query, searchTick])

  const subtotal = mealKcal(meal)
  const showNoResults = query.trim().length > 0 && results.length === 0

  return (
    <div className="rounded-xl border border-border/70 bg-secondary/15 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        {subtotal > 0 ? (
          <Badge variant="secondary" className="tabular-nums">
            {subtotal.toLocaleString()} kcal
          </Badge>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="음식 검색 (예: 밥, 닭가슴살)"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Input
            type="number"
            min={1}
            max={5000}
            value={grams}
            onChange={(e) => {
              const n = Number(e.target.value)
              setGrams(Number.isFinite(n) && n > 0 ? n : 100)
            }}
            className="h-9 w-20 shrink-0 text-sm"
            aria-label="그램"
          />
          <span className="flex h-9 items-center text-xs text-muted-foreground">g</span>
        </div>

        {results.length > 0 ? (
          <ul className="max-h-36 overflow-y-auto rounded-lg border border-border/60 bg-card/80">
            {results.map((food) => (
              <li
                key={food.id}
                className="flex items-center justify-between gap-2 border-b border-border/40 px-2.5 py-2 last:border-0"
              >
                <div className="min-w-0 text-left">
                  <p className="truncate text-xs font-medium text-foreground">
                    {food.name}
                    {isCustomFood(food) ? (
                      <span className="ml-1 text-[10px] text-primary">내 등록</span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {foodKcalLabel(food)} · {grams}g ≈ {kcalForFood(food, grams).toLocaleString()} kcal
                  </p>
                  {isCustomFood(food) && hasNutritionData(food.nutrition) ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground/90">
                      {formatNutritionBrief(scaleNutrition(food.nutrition, grams))}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={() => {
                    const addG =
                      food.kcalPerServing != null && grams === 100
                        ? food.defaultServingG
                        : grams
                    onChange(addFoodFromSearch(meal, food, addG))
                    setQuery("")
                  }}
                >
                  <Plus className="h-3 w-3" aria-hidden />
                  추가
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {showNoResults ? (
          <p className="text-center text-xs text-muted-foreground">검색 결과가 없습니다.</p>
        ) : null}

        <CustomFoodForm
          defaultName={showNoResults ? query.trim() : ""}
          grams={grams}
          onRegistered={(entry) => {
            onChange(addCustomEntry(meal, entry))
            setSearchTick((t) => t + 1)
            setQuery("")
          }}
        />

        {meal.foods.length > 0 ? (
          <ul className="space-y-1.5">
            {meal.foods.map((f, index) => (
              <li
                key={`${f.foodId}-${index}-${f.grams}`}
                className="rounded-lg border border-border/50 bg-card/60 px-2.5 py-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-foreground">
                    {f.name}{" "}
                    <span className="text-muted-foreground">{f.grams}g</span>
                    {f.isCustom ? (
                      <span className="ml-1 text-[10px] text-primary">직접등록</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold tabular-nums text-primary">
                      {f.kcal.toLocaleString()} kcal
                    </span>
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label={`${f.name} 삭제`}
                      onClick={() => onChange(removeFood(meal, index))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
                {hasNutritionData(f.nutrition) ? (
                  <p className="mt-1 text-left text-[10px] text-muted-foreground">
                    {formatNutritionBrief(f.nutrition!)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <Textarea
          value={meal.note}
          onChange={(e) => onChange({ ...meal, note: e.target.value })}
          placeholder="메모 (선택)"
          rows={2}
          className={cn("resize-none text-sm", meal.foods.length === 0 && "min-h-[52px]")}
        />
      </div>
    </div>
  )
}
