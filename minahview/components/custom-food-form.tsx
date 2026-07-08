"use client"

import { useState } from "react"
import { ClipboardPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { FoodRecord } from "@/lib/calorie-dataset"
import { kcalForFood } from "@/lib/calorie-utils"
import { saveCustomFood, scaleNutrition, type FoodNutritionPer100g } from "@/lib/pace-custom-foods-storage"

const CATEGORIES: FoodRecord["category"][] = [
  "밥/면/빵",
  "고기/생선/달걀",
  "유제품",
  "과일",
  "채소",
  "간식/음료",
  "기타",
]

type CustomFoodFormProps = {
  defaultName?: string
  grams: number
  onRegistered: (payload: {
    foodId: string
    name: string
    grams: number
    kcalPer100g: number
    kcal: number
    nutrition?: FoodNutritionPer100g
    isCustom: true
  }) => void
}

function parseOptionalNum(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function CustomFoodForm({ defaultName = "", grams, onRegistered }: CustomFoodFormProps) {
  const [open, setOpen] = useState(Boolean(defaultName.trim()))
  const [name, setName] = useState(defaultName)
  const [kcalPer100g, setKcalPer100g] = useState("")
  const [category, setCategory] = useState<FoodRecord["category"]>("기타")
  const [protein, setProtein] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const [sodium, setSodium] = useState("")
  const [sugar, setSugar] = useState("")
  const [fiber, setFiber] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError("음식 이름을 입력해 주세요.")
      return
    }
    const kcal100 = Number(kcalPer100g)
    if (!Number.isFinite(kcal100) || kcal100 < 0 || kcal100 > 900) {
      setError("100g당 칼로리를 올바르게 입력해 주세요.")
      return
    }
    if (!grams || grams <= 0) {
      setError("섭취량(g)을 1 이상으로 설정해 주세요.")
      return
    }

    const nutritionPer100: FoodNutritionPer100g = {
      proteinG: parseOptionalNum(protein),
      carbsG: parseOptionalNum(carbs),
      fatG: parseOptionalNum(fat),
      sodiumMg: parseOptionalNum(sodium),
      sugarG: parseOptionalNum(sugar),
      fiberG: parseOptionalNum(fiber),
    }

    const saved = saveCustomFood({
      name: trimmed,
      category,
      kcalPer100g: Math.round(kcal100),
      defaultServingG: grams,
      nutrition: nutritionPer100,
    })

    const kcal = kcalForFood(saved, grams)
    const nutritionPortion = scaleNutrition(nutritionPer100, grams)

    onRegistered({
      foodId: saved.id,
      name: saved.name,
      grams,
      kcalPer100g: saved.kcalPer100g,
      kcal,
      nutrition: nutritionPortion,
      isCustom: true,
    })

    setOpen(false)
    setName("")
    setKcalPer100g("")
    setProtein("")
    setCarbs("")
    setFat("")
    setSodium("")
    setSugar("")
    setFiber("")
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-full text-xs text-primary">
          <ClipboardPlus className="h-3.5 w-3.5" aria-hidden />
          검색에 없는 음식 직접 등록
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
        <p className="text-left text-[11px] leading-relaxed text-muted-foreground">
          칼로리·영양 정보를 입력하면 저장되어 다음에도 검색됩니다.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="custom-food-name" className="text-xs">
              음식 이름 *
            </Label>
            <Input
              id="custom-food-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 우리집 된장찌개"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="custom-kcal" className="text-xs">
              칼로리 (kcal/100g) *
            </Label>
            <Input
              id="custom-kcal"
              type="number"
              min={0}
              max={900}
              value={kcalPer100g}
              onChange={(e) => setKcalPer100g(e.target.value)}
              placeholder="예: 120"
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="custom-category" className="text-xs">
              분류
            </Label>
            <select
              id="custom-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FoodRecord["category"])}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-left text-xs font-medium text-foreground">영양 정보 (100g 기준, 선택)</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">단백질(g)</Label>
            <Input value={protein} onChange={(e) => setProtein(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">탄수화물(g)</Label>
            <Input value={carbs} onChange={(e) => setCarbs(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">지방(g)</Label>
            <Input value={fat} onChange={(e) => setFat(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">나트륨(mg)</Label>
            <Input value={sodium} onChange={(e) => setSodium(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">당류(g)</Label>
            <Input value={sugar} onChange={(e) => setSugar(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">식이섬유(g)</Label>
            <Input value={fiber} onChange={(e) => setFiber(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>

        {grams > 0 && kcalPer100g ? (
          <p className="text-left text-[11px] text-muted-foreground">
            {grams}g 섭취 시 약{" "}
            <span className="font-semibold text-primary">
              {kcalForFood({ kcalPer100g: Number(kcalPer100g) || 0 }, grams).toLocaleString()} kcal
            </span>
          </p>
        ) : null}

        {error ? <p className="text-left text-xs text-destructive">{error}</p> : null}

        <Button type="button" size="sm" className="w-full" onClick={handleSubmit}>
          등록하고 식단에 추가
        </Button>
      </CollapsibleContent>
    </Collapsible>
  )
}
