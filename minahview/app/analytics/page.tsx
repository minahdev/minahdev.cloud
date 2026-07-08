"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { ko } from "date-fns/locale"
import { CalendarDays, Dumbbell, Heart, Scale, UtensilsCrossed } from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNutritionBrief, hasNutritionData } from "@/lib/format-nutrition"
import {
  dietHasContent,
  dietTotalKcal,
  hasWorkoutActivity,
  loadTrainLogs,
  mealHasContent,
  mealKcal,
  trainLogTodayKey,
  type DietMeal,
  type TrainDailyLog,
  type TrainDiet,
} from "@/lib/pace-train-storage"
import {
  hasTodayStoryContent,
  loadTodayStories,
  type TodayStoryEntry,
} from "@/lib/pace-today-story-storage"

function dateToKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function hasSavedRecord(log: TrainDailyLog): boolean {
  return (
    hasWorkoutActivity(log) ||
    log.weightKg != null ||
    dietHasContent(log.diet) ||
    Boolean(log.memo.trim())
  )
}

function MealDetail({ label, meal }: { label: string; meal: DietMeal }) {
  if (!mealHasContent(meal)) return null
  const kcal = mealKcal(meal)
  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-foreground">{label}</span>
        {kcal > 0 ? (
          <span className="text-xs font-semibold tabular-nums text-primary">{kcal.toLocaleString()} kcal</span>
        ) : null}
      </div>
      {meal.foods.length > 0 ? (
        <ul className="ml-2 space-y-1 text-xs text-muted-foreground">
          {meal.foods.map((f, i) => (
            <li key={`${f.foodId}-${i}`}>
              <span>
                {f.name} {f.grams}g — {f.kcal.toLocaleString()} kcal
                {f.isCustom ? " (직접등록)" : ""}
              </span>
              {hasNutritionData(f.nutrition) ? (
                <p className="mt-0.5 text-[10px]">{formatNutritionBrief(f.nutrition!)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {meal.note.trim() ? <p className="text-xs text-foreground/90">{meal.note}</p> : null}
    </li>
  )
}

function DietDetail({ diet }: { diet: TrainDiet }) {
  const total = dietTotalKcal(diet)
  const rows = [
    { label: "아침", meal: diet.breakfast },
    { label: "점심", meal: diet.lunch },
    { label: "저녁", meal: diet.dinner },
    { label: "간식", meal: diet.snack },
  ]

  return (
    <div>
      {total > 0 ? (
        <p className="mb-2 text-sm font-semibold text-primary tabular-nums">
          식단 합계 {total.toLocaleString()} kcal
        </p>
      ) : null}
      <ul className="space-y-2.5 rounded-lg border border-border/60 bg-secondary/20 px-3 py-2.5">
        {rows
          .filter((row) => mealHasContent(row.meal))
          .map((row) => (
            <MealDetail key={row.label} label={row.label} meal={row.meal} />
          ))}
        {diet.waterMl != null ? (
          <li>
            <span className="font-medium text-foreground">물</span>
            <span className="text-muted-foreground"> — </span>
            {diet.waterMl} ml
          </li>
        ) : null}
        {diet.supplements.trim() ? (
          <li>
            <span className="font-medium text-foreground">영양제</span>
            <span className="text-muted-foreground"> — </span>
            {diet.supplements}
          </li>
        ) : null}
      </ul>
    </div>
  )
}

function TodayStoryDayDetail({ entry }: { entry: TodayStoryEntry | null }) {
  if (!entry || !hasTodayStoryContent(entry)) return null

  return (
    <div className="space-y-3 rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Heart className="h-3.5 w-3.5 text-rose-400" aria-hidden />
        오늘의 이야기 (메인에서 기록)
      </p>
      {entry.mood ? (
        <Badge variant="secondary" className="border-rose-500/30 bg-rose-500/10 text-foreground">
          {entry.mood}
        </Badge>
      ) : null}
      {entry.story.trim() ? (
        <p className="whitespace-pre-wrap leading-relaxed text-foreground">{entry.story}</p>
      ) : (
        <p className="text-muted-foreground">기분만 선택된 날입니다.</p>
      )}
    </div>
  )
}

function TrainDayDetail({ log }: { log: TrainDailyLog | null }) {
  if (!log || !hasSavedRecord(log)) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-secondary/25 px-4 py-6 text-center text-sm text-muted-foreground">
        이 날짜에 저장된 훈련 기록이 없습니다.
      </p>
    )
  }

  return (
    <div className="space-y-4 text-sm">
      {log.muscles.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">운동 부위</p>
          <div className="flex flex-wrap gap-1.5">
            {log.muscles.map((m) => (
              <Badge key={m} variant="secondary">
                {m}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {log.workout.trim() ? (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Dumbbell className="h-3.5 w-3.5" aria-hidden />
            오늘 한 운동
          </p>
          <p className="whitespace-pre-wrap rounded-lg border border-border/60 bg-secondary/20 px-3 py-2.5 leading-relaxed text-foreground">
            {log.workout}
          </p>
        </div>
      ) : null}

      {log.weightKg != null ? (
        <p className="flex items-center gap-1.5 text-foreground">
          <Scale className="h-4 w-4 text-primary" aria-hidden />
          몸무게 <span className="font-semibold">{log.weightKg} kg</span>
        </p>
      ) : null}

      {dietHasContent(log.diet) ? (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden />
            식단
          </p>
          <DietDetail diet={log.diet} />
        </div>
      ) : null}

      {log.memo.trim() ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">메모</p>
          <p className="whitespace-pre-wrap rounded-lg border border-border/60 px-3 py-2 text-foreground">
            {log.memo}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function DayRecordDetail({
  story,
  log,
}: {
  story: TodayStoryEntry | null
  log: TrainDailyLog | null
}) {
  const hasStory = story != null && hasTodayStoryContent(story)
  const hasTrain = log != null && hasSavedRecord(log)

  if (!hasStory && !hasTrain) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-secondary/25 px-4 py-10 text-center text-sm text-muted-foreground">
        이 날짜에 저장된 기록이 없습니다.
        <br />
        메인에서 감정·이야기를 남기거나, 훈련 탭에서 운동 기록을 저장해 보세요.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <TodayStoryDayDetail entry={story} />
      {hasTrain ? (
        <>
          {hasStory ? (
            <p className="text-xs font-medium text-muted-foreground">훈련 · 식단</p>
          ) : null}
          <TrainDayDetail log={log} />
        </>
      ) : null}
    </div>
  )
}

export function AnalyticsPanel({ embedded = false }: { embedded?: boolean }) {
  const [logs, setLogs] = useState<TrainDailyLog[]>([])
  const [stories, setStories] = useState<TodayStoryEntry[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date())

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      Promise.all([loadTrainLogs(), loadTodayStories()])
        .then(([trainData, storyData]) => {
          if (!cancelled) {
            setLogs(trainData)
            setStories(storyData)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLogs([])
            setStories([])
          }
        })
    }
    refresh()
    window.addEventListener("focus", refresh)
    return () => {
      cancelled = true
      window.removeEventListener("focus", refresh)
    }
  }, [])

  const logsByDate = useMemo(() => {
    const map = new Map<string, TrainDailyLog>()
    for (const log of logs) map.set(log.date, log)
    return map
  }, [logs])

  const storiesByDate = useMemo(() => {
    const map = new Map<string, TodayStoryEntry>()
    for (const s of stories) map.set(s.date, s)
    return map
  }, [stories])

  const selectedKey = dateToKey(selectedDate)
  const selectedLog = logsByDate.get(selectedKey) ?? null
  const selectedStory = storiesByDate.get(selectedKey) ?? null

  const trainLoggedDates = useMemo(
    () => logs.filter(hasSavedRecord).map((l) => parseISO(l.date)),
    [logs],
  )

  const moodLoggedDates = useMemo(
    () => stories.filter(hasTodayStoryContent).map((s) => parseISO(s.date)),
    [stories],
  )

  const weightChartRows = useMemo(() => {
    return logs
      .filter((l) => l.weightKg != null)
      .map((l) => {
        const [, m, d] = l.date.split("-")
        return { label: `${m}/${d}`, weight: l.weightKg, date: l.date }
      })
  }, [logs])

  const hasWeight = weightChartRows.length > 0

  const selectedLabel = format(selectedDate, "yyyy년 M월 d일 (EEE)", { locale: ko })

  return (
    <div className={embedded ? "pb-4" : "pb-16 pt-28 md:pt-32"}>
      <div className={embedded ? "mx-auto w-full max-w-5xl" : "container mx-auto max-w-5xl px-6"}>
        {!embedded ? (
          <header className="mb-8">
            <p className="text-sm font-medium text-primary">Analytics</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              나의 훈련 기록
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              메인에서 남긴 감정·이야기와 훈련 탭 기록을 날짜별로 확인하고, 몸무게 추이는 아래
              그래프에서 볼 수 있습니다.
            </p>
          </header>
        ) : (
          <p className="mb-6 text-sm text-muted-foreground">
            메인에서 남긴 감정·이야기와 훈련 기록을 날짜별로 확인하고, 몸무게 추이를 볼 수 있어요.
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
                기록 캘린더
              </CardTitle>
              <CardDescription className="space-y-1">
                <span className="block">
                  <span className="mr-1.5 inline-block size-2 rounded-full bg-primary align-middle" />
                  훈련 기록
                </span>
                <span className="block">
                  <span className="mr-1.5 inline-block size-2 rounded-full bg-rose-400 align-middle" />
                  감정·이야기 (메인)
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                modifiers={{ train: trainLoggedDates, mood: moodLoggedDates }}
                modifiersClassNames={{
                  train:
                    "relative font-semibold after:pointer-events-none after:absolute after:bottom-1 after:left-[42%] after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                  mood:
                    "relative font-semibold after:pointer-events-none after:absolute after:bottom-1 after:left-[58%] after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-rose-400",
                }}
                className="rounded-lg [--cell-size:--spacing(9)]"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => {
                  const today = new Date()
                  setSelectedDate(today)
                  setCalendarMonth(today)
                }}
              >
                오늘로 이동
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{selectedLabel}</CardTitle>
              <CardDescription>
                {selectedKey === trainLogTodayKey() ? "오늘" : "선택한 날"}의 감정·훈련 기록
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DayRecordDetail story={selectedStory} log={selectedLog} />
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">몸무게 추이</CardTitle>
            <CardDescription>
              마이페이지 훈련 탭에서 입력한 체중만 모아 표시합니다. 기록이 있는 날짜만 연결됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasWeight ? (
              <p className="rounded-lg border border-dashed border-border bg-secondary/30 py-12 text-center text-sm text-muted-foreground">
                아직 몸무게 데이터가 없습니다. 마이페이지 훈련 탭에서 체중을 입력해 보세요.
              </p>
            ) : (
              <div className="h-[300px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightChartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                      labelFormatter={(l) => `날짜 ${l}`}
                      formatter={(value: number | string) => [
                        value === null || value === undefined ? "—" : `${value} kg`,
                        "몸무게",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      name="몸무게"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "hsl(var(--primary))" }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  return <AnalyticsPanel />
}
