"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Dumbbell, Droplets, Scale, StickyNote, UtensilsCrossed } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DietMealTracker } from "@/components/diet-meal-tracker"
import {
  dietTotalKcal,
  emptyDiet,
  type TrainDailyLog,
  type TrainDiet,
  fetchTodayTrainLog,
  saveTodayTrainLog,
} from "@/lib/pace-train-storage"
import { cn } from "@/lib/utils"

type TrainFormUi = {
  submitting: boolean
  error: string | null
  saved: string | null
  muscles: string[]
}

const MUSCLE_GROUPS = [
  "가슴",
  "등",
  "어깨",
  "팔(이두/삼두)",
  "복근",
  "하체(허벅지)",
  "둔근",
  "종아리",
] as const

export function TrainPanel({ embedded = false }: { embedded?: boolean }) {
  const [ui, setUi] = useState<TrainFormUi>({
    submitting: false,
    error: null,
    saved: null,
    muscles: [],
  })
  const [initial, setInitial] = useState<TrainDailyLog | null | undefined>(undefined)
  const [diet, setDiet] = useState<TrainDiet>(emptyDiet)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchTodayTrainLog()
      .then((log) => {
        if (cancelled) return
        setInitial(log)
        if (log) {
          setUi((prev) => ({ ...prev, muscles: log.muscles }))
          setDiet(log.diet)
        }
      })
      .catch(() => setInitial(null))
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setUi((prev) => ({ ...prev, error: null, saved: null, submitting: true }))

    const formData = new FormData(e.currentTarget)
    const weightRaw = String(formData.get("weightKg") ?? "").trim()
    const workout = String(formData.get("workout") ?? "").trim()
    const memo = String(formData.get("memo") ?? "").trim()

    let weightKg: number | null = null
    if (weightRaw) {
      const n = Number(weightRaw)
      if (Number.isNaN(n) || n <= 0 || n > 500) {
        setUi((prev) => ({
          ...prev,
          submitting: false,
          error: "몸무게는 1~500kg 범위의 숫자로 입력해 주세요.",
        }))
        return
      }
      weightKg = n
    }

    const waterMlRaw = String(formData.get("waterMl") ?? "").trim()
    const supplements = String(formData.get("supplements") ?? "").trim()

    let waterMl: number | null = null
    if (waterMlRaw) {
      const w = Math.floor(Number(waterMlRaw))
      if (!Number.isNaN(w) && w >= 0 && w <= 20000) waterMl = w
    }

    const dietToSave: TrainDiet = {
      ...diet,
      waterMl,
      supplements,
    }

    try {
      await saveTodayTrainLog({
        muscles: ui.muscles,
        workout,
        weightKg,
        diet: dietToSave,
        memo,
        exerciseMinutes: null,
      })
      setDiet(dietToSave)
      const log = await fetchTodayTrainLog()
      setInitial(log)
      setUi((prev) => ({
        ...prev,
        submitting: false,
        saved: "오늘 기록을 저장했습니다. 마이페이지 분석 탭에서 그래프를 확인할 수 있어요.",
      }))
      setFormKey((k) => k + 1)
    } catch {
      setUi((prev) => ({
        ...prev,
        submitting: false,
        error: "저장에 실패했습니다. 로그인 상태를 확인해 주세요.",
      }))
    }
  }

  const totalDietKcal = dietTotalKcal(diet)

  if (initial === undefined) {
    return (
      <div
        className={
          embedded
            ? "flex min-h-[12rem] items-center justify-center"
            : "flex min-h-[50vh] items-center justify-center pt-28"
        }
      >
        <div
          className="h-12 w-12 animate-pulse rounded-full bg-secondary"
          aria-hidden
        />
      </div>
    )
  }

  return (
    <div className={embedded ? "pb-4" : "pb-16 pt-28 md:pt-32"}>
      <div className={embedded ? "mx-auto w-full max-w-4xl" : "container mx-auto max-w-4xl px-6"}>
        {!embedded ? (
          <header className="mb-10">
            <p className="text-sm font-medium text-primary">Train Log</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              오늘의 훈련 기록
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              운동·몸무게·식단·메모를 하루 단위로 남기면 분석 탭에서 추이를 볼 수 있어요.
            </p>
          </header>
        ) : (
          <p className="mb-6 text-sm text-muted-foreground">
            운동·몸무게·식단·메모를 하루 단위로 기록하세요.
          </p>
        )}

        <form key={formKey} onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="border-border/80 shadow-sm sm:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
                    <Dumbbell className="h-4 w-4 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-base">오늘 한 운동</CardTitle>
                    <CardDescription>
                      부위를 선택하고, 오늘 한 운동을 자유롭게 적어 주세요.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
                <div className="space-y-3">
                  <div className="rounded-xl border border-border/70 bg-secondary/20 p-3">
                    <p className="text-sm font-medium text-foreground">오늘 운동한 부위</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      클릭해서 선택하세요. 여러 부위 선택 가능.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {MUSCLE_GROUPS.map((m) => {
                        const active = ui.muscles.includes(m)
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() =>
                              setUi((prev) => ({
                                ...prev,
                                muscles: active
                                  ? prev.muscles.filter((x) => x !== m)
                                  : [...prev.muscles, m],
                              }))
                            }
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                              active
                                ? "border-primary bg-primary/15 text-primary"
                                : "border-border/70 bg-background text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                            )}
                          >
                            {m}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-card p-3">
                    <p className="text-xs font-medium text-muted-foreground">사람 모형(부위 선택)</p>
                    <BodySelector
                      selected={ui.muscles}
                      onToggle={(muscle) =>
                        setUi((prev) => ({
                          ...prev,
                          muscles: prev.muscles.includes(muscle)
                            ? prev.muscles.filter((x) => x !== muscle)
                            : [...prev.muscles, muscle],
                        }))
                      }
                      className="mt-2"
                    />
                  </div>

                  <input type="hidden" name="muscles" value={ui.muscles.join(",")} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="workout">오늘 한 운동</Label>
                  <Textarea
                    id="workout"
                    name="workout"
                    defaultValue={initial?.workout ?? ""}
                    placeholder={
                      "예:\n스쿼트 4세트 × 10회, 20kg\n러닝 20분\n마지막 세트에서 무릎이 조금 아팠음"
                    }
                    rows={8}
                    className="min-h-[10rem] resize-y leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground">
                    종목·세트·시간·느낀 점 등을 문장으로 편하게 적어 주세요.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm sm:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
                    <Scale className="h-4 w-4 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-base">몸무게</CardTitle>
                    <CardDescription>오늘 측정한 체중 (kg)</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-4">
                <Label htmlFor="weightKg" className="sr-only">
                  몸무게 kg
                </Label>
                <Input
                  id="weightKg"
                  name="weightKg"
                  type="number"
                  min={1}
                  max={500}
                  step={0.1}
                  inputMode="decimal"
                  placeholder="예: 68.5"
                  defaultValue={
                    initial?.weightKg != null ? String(initial.weightKg) : ""
                  }
                  className="h-10 w-40"
                />
                <p className="text-xs text-muted-foreground">
                  입력하면 마이페이지 분석 탭 그래프에 반영됩니다.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm sm:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
                    <UtensilsCrossed className="h-4 w-4 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-base">식단</CardTitle>
                    <CardDescription>음식 검색으로 칼로리를 추가하고, 끼니별·총 칼로리를 확인하세요</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {totalDietKcal > 0 ? (
                  <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
                    <span className="text-sm font-medium text-foreground">오늘 식단 총 칼로리</span>
                    <span className="text-lg font-bold tabular-nums text-primary">
                      {totalDietKcal.toLocaleString()} kcal
                    </span>
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <DietMealTracker
                    label="아침"
                    meal={diet.breakfast}
                    onChange={(breakfast) => setDiet((d) => ({ ...d, breakfast }))}
                  />
                  <DietMealTracker
                    label="점심"
                    meal={diet.lunch}
                    onChange={(lunch) => setDiet((d) => ({ ...d, lunch }))}
                  />
                  <DietMealTracker
                    label="저녁"
                    meal={diet.dinner}
                    onChange={(dinner) => setDiet((d) => ({ ...d, dinner }))}
                  />
                  <DietMealTracker
                    label="간식"
                    meal={diet.snack}
                    onChange={(snack) => setDiet((d) => ({ ...d, snack }))}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-1.5">
                    <Label htmlFor="waterMl" className="flex items-center gap-1.5">
                      <Droplets className="h-4 w-4 text-primary" aria-hidden />
                      물 섭취량(ml)
                    </Label>
                    <Input
                      id="waterMl"
                      name="waterMl"
                      type="number"
                      min={0}
                      max={20000}
                      step={50}
                      inputMode="numeric"
                      placeholder="예: 2000"
                      defaultValue={
                        initial?.diet?.waterMl != null ? String(initial.diet.waterMl) : ""
                      }
                      className="h-10 w-44"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="supplements">영양제</Label>
                    <Input
                      id="supplements"
                      name="supplements"
                      placeholder="예: 오메가3, 비타민D"
                      defaultValue={initial?.diet?.supplements ?? ""}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm sm:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
                    <StickyNote className="h-4 w-4 text-primary" aria-hidden />
                  </div>
                  <div>
                    <CardTitle className="text-base">메모</CardTitle>
                    <CardDescription>컨디션, 수면, 목표 등 자유 메모</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  name="memo"
                  defaultValue={initial?.memo ?? ""}
                  placeholder="오늘의 한 줄 메모..."
                  rows={3}
                  className="resize-none"
                />
              </CardContent>
            </Card>
          </div>

          {ui.error ? (
            <p className="text-sm text-destructive" role="alert">
              {ui.error}
            </p>
          ) : null}
          {ui.saved ? (
            <p className="text-sm text-primary" role="status">
              {ui.saved}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={ui.submitting} size="lg">
              {ui.submitting ? "저장 중…" : "오늘 기록 저장"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BodySelector({
  selected,
  onToggle,
  className,
}: {
  selected: string[]
  onToggle: (muscle: (typeof MUSCLE_GROUPS)[number]) => void
  className?: string
}) {
  const active = (m: (typeof MUSCLE_GROUPS)[number]) => selected.includes(m)
  const regionClass = (m: (typeof MUSCLE_GROUPS)[number]) =>
    cn(
      "cursor-pointer transition-colors",
      active(m) ? "fill-primary/35 stroke-primary" : "fill-secondary/60 stroke-border",
    )

  return (
    <svg
      viewBox="0 0 220 260"
      role="img"
      aria-label="운동 부위 선택 모형"
      className={cn("h-52 w-full max-w-[260px] select-none", className)}
    >
      {/* silhouette */}
      <g>
        <rect x="92" y="20" width="36" height="36" rx="18" className="fill-secondary/40" />
        <rect x="70" y="56" width="80" height="180" rx="32" className="fill-secondary/35" />
      </g>

      {/* chest */}
      <path
        d="M85 82c8-10 42-10 50 0v18c-8 8-42 8-50 0V82z"
        className={regionClass("가슴")}
        onClick={() => onToggle("가슴")}
      />
      {/* abs */}
      <rect
        x="94"
        y="110"
        width="32"
        height="38"
        rx="10"
        className={regionClass("복근")}
        onClick={() => onToggle("복근")}
      />
      {/* shoulders */}
      <rect
        x="64"
        y="76"
        width="20"
        height="30"
        rx="10"
        className={regionClass("어깨")}
        onClick={() => onToggle("어깨")}
      />
      <rect
        x="136"
        y="76"
        width="20"
        height="30"
        rx="10"
        className={regionClass("어깨")}
        onClick={() => onToggle("어깨")}
      />
      {/* arms */}
      <rect
        x="56"
        y="106"
        width="22"
        height="58"
        rx="11"
        className={regionClass("팔(이두/삼두)")}
        onClick={() => onToggle("팔(이두/삼두)")}
      />
      <rect
        x="142"
        y="106"
        width="22"
        height="58"
        rx="11"
        className={regionClass("팔(이두/삼두)")}
        onClick={() => onToggle("팔(이두/삼두)")}
      />
      {/* back (as mid torso) */}
      <rect
        x="82"
        y="152"
        width="56"
        height="26"
        rx="13"
        className={regionClass("등")}
        onClick={() => onToggle("등")}
      />
      {/* glutes */}
      <rect
        x="86"
        y="182"
        width="48"
        height="22"
        rx="11"
        className={regionClass("둔근")}
        onClick={() => onToggle("둔근")}
      />
      {/* thighs */}
      <rect
        x="84"
        y="206"
        width="24"
        height="34"
        rx="10"
        className={regionClass("하체(허벅지)")}
        onClick={() => onToggle("하체(허벅지)")}
      />
      <rect
        x="112"
        y="206"
        width="24"
        height="34"
        rx="10"
        className={regionClass("하체(허벅지)")}
        onClick={() => onToggle("하체(허벅지)")}
      />
      {/* calves */}
      <rect
        x="88"
        y="242"
        width="18"
        height="14"
        rx="7"
        className={regionClass("종아리")}
        onClick={() => onToggle("종아리")}
      />
      <rect
        x="114"
        y="242"
        width="18"
        height="14"
        rx="7"
        className={regionClass("종아리")}
        onClick={() => onToggle("종아리")}
      />
    </svg>
  )
}

export default function TrainPage() {
  return <TrainPanel />
}
