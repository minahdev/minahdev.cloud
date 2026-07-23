"use client"

import { type ReactNode, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Heart, Mars, Venus } from "lucide-react"

import { WheelPicker } from "@/components/wheel-picker"
import {
  calcBmi,
  EXPERIENCE_OPTIONS,
  FAVORITE_EXERCISE_OPTIONS,
  formatBirthDate,
  GENDER_OPTIONS,
  HEALTH_FLAG_OPTIONS,
  isValidBirthDate,
  toggleHealthFlag,
  type FavoriteExercise,
  type Gender,
  type HealthFlag,
  type MyPageProfile,
  saveMyPageProfileToApi,
  WEEKLY_GOAL_OPTIONS,
} from "@/lib/mypage-profile"

type ProfileFields = Omit<MyPageProfile, "updatedAt" | "healthUnreadable">

const inputClass =
  "w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"

/** 한 단계 = 질문 하나. validate가 문자열을 반환하면 그 메시지로 진행을 막는다. */
type Step = {
  id: string
  question: string
  hint?: string
  optional?: boolean
  validate?: (f: ProfileFields) => string | null
  render: (ctx: {
    fields: ProfileFields
    set: (partial: Partial<ProfileFields>) => void
    advance: () => void
  }) => ReactNode
}

function ChoiceList<T extends string>({
  options,
  value,
  onPick,
  icons,
}: {
  options: { value: T; label: string }[]
  value: T
  onPick: (v: T) => void
  icons?: Record<string, ReactNode>
}) {
  return (
    <div className="grid gap-2.5">
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(opt.value)}
            className={`flex items-center gap-3 rounded-xl border px-5 py-4 text-left text-base transition-colors ${
              selected
                ? "border-primary/60 bg-primary/10 text-foreground"
                : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            {icons?.[opt.value] ? (
              <span className={selected ? "text-primary" : "text-muted-foreground"}>
                {icons[opt.value]}
              </span>
            ) : null}
            <span className="font-medium">{opt.label}</span>
            {selected ? <Check className="ml-auto size-4 text-primary" aria-hidden /> : null}
          </button>
        )
      })}
    </div>
  )
}

function MultiChoiceList<T extends string>({
  options,
  values,
  onToggle,
}: {
  options: { value: T; label: string }[]
  values: T[]
  onToggle: (v: T) => void
}) {
  return (
    <div className="grid gap-2.5">
      {options.map((opt) => {
        const selected = values.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(opt.value)}
            className={`flex items-center gap-3 rounded-xl border px-5 py-4 text-left text-base transition-colors ${
              selected
                ? "border-primary/60 bg-primary/10 text-foreground"
                : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${
                selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              {selected ? <Check className="size-3.5" aria-hidden /> : null}
            </span>
            <span className="font-medium">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function toggleExercise(
  values: FavoriteExercise[],
  value: FavoriteExercise,
): FavoriteExercise[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

const STEPS: Step[] = [
  {
    id: "name",
    question: "이름을 알려주세요",
    validate: (f) => (f.name.trim() ? null : "이름을 입력해 주세요."),
    render: ({ fields, set, advance }) => (
      <input
        autoFocus
        className={inputClass}
        placeholder="홍길동"
        value={fields.name}
        onChange={(e) => set({ name: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            advance()
          }
        }}
      />
    ),
  },
  {
    id: "nickname",
    question: "닉네임을 정해주세요",
    hint: "커뮤니티에서 보일 이름이에요",
    validate: (f) => (f.nickname.trim() ? null : "닉네임을 입력해 주세요."),
    render: ({ fields, set, advance }) => (
      <input
        autoFocus
        maxLength={20}
        className={inputClass}
        placeholder="러닝하는곰"
        value={fields.nickname}
        onChange={(e) => set({ nickname: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            advance()
          }
        }}
      />
    ),
  },
  {
    id: "gender",
    question: "성별을 선택해 주세요",
    render: ({ fields, set }) => (
      <ChoiceList
        options={GENDER_OPTIONS}
        value={fields.gender}
        onPick={(v: Gender) => set({ gender: v })}
        icons={{
          male: <Mars className="size-5" aria-hidden />,
          female: <Venus className="size-5" aria-hidden />,
        }}
      />
    ),
  },
  {
    id: "birthDate",
    question: "생년월일이 언제인가요?",
    hint: "위아래로 굴려서 맞춰 주세요",
    validate: (f) => (isValidBirthDate(f.birthDate) ? null : "생년월일을 선택해 주세요."),
    render: ({ fields, set }) => (
      <WheelPicker value={fields.birthDate} onChange={(v) => set({ birthDate: v })} />
    ),
  },
  {
    id: "phone",
    question: "연락처를 입력해 주세요",
    hint: "선택 사항이에요. 지금 넘어가도 괜찮아요",
    optional: true,
    render: ({ fields, set, advance }) => (
      <input
        autoFocus
        type="tel"
        className={inputClass}
        placeholder="010-1234-5678"
        value={fields.phone}
        onChange={(e) => set({ phone: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            advance()
          }
        }}
      />
    ),
  },
  {
    id: "heightCm",
    question: "키가 어떻게 되나요?",
    hint: "cm 단위로 입력해 주세요",
    validate: (f) => {
      const h = Number(f.heightCm)
      return h >= 100 && h <= 250 ? null : "키를 100~250cm 사이로 입력해 주세요."
    },
    render: ({ fields, set, advance }) => (
      <div className="flex items-center gap-3">
        <input
          autoFocus
          type="number"
          min={100}
          max={250}
          className={inputClass}
          placeholder="170"
          value={fields.heightCm}
          onChange={(e) => set({ heightCm: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              advance()
            }
          }}
        />
        <span className="shrink-0 text-sm text-muted-foreground">cm</span>
      </div>
    ),
  },
  {
    id: "weightKg",
    question: "몸무게가 어떻게 되나요?",
    hint: "kg 단위로 입력해 주세요",
    validate: (f) => {
      const w = Number(f.weightKg)
      return w >= 30 && w <= 300 ? null : "몸무게를 30~300kg 사이로 입력해 주세요."
    },
    render: ({ fields, set, advance }) => {
      const bmi = calcBmi(fields.heightCm, fields.weightKg)
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              autoFocus
              type="number"
              min={30}
              max={300}
              step="0.1"
              className={inputClass}
              placeholder="65"
              value={fields.weightKg}
              onChange={(e) => set({ weightKg: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  advance()
                }
              }}
            />
            <span className="shrink-0 text-sm text-muted-foreground">kg</span>
          </div>
          {bmi != null ? (
            <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
              BMI <strong className="text-primary">{bmi}</strong>
              <span className="ml-2 text-muted-foreground">(참고용)</span>
            </p>
          ) : null}
        </div>
      )
    },
  },
  {
    id: "favoriteExercises",
    question: "어떤 운동을 자주 하나요?",
    hint: "여러 개 고를 수 있어요",
    validate: (f) => {
      if (!f.favoriteExercises.length) return "하나 이상 선택해 주세요."
      if (f.favoriteExercises.includes("other") && !f.favoriteExerciseOther.trim()) {
        return "어떤 운동인지 입력해 주세요."
      }
      return null
    },
    render: ({ fields, set }) => (
      <div className="space-y-3">
        <MultiChoiceList
          options={FAVORITE_EXERCISE_OPTIONS}
          values={fields.favoriteExercises}
          onToggle={(v) => set({ favoriteExercises: toggleExercise(fields.favoriteExercises, v) })}
        />
        {fields.favoriteExercises.includes("other") ? (
          <input
            autoFocus
            className={inputClass}
            placeholder="예: 수영, 요가, 클라이밍"
            value={fields.favoriteExerciseOther}
            onChange={(e) => set({ favoriteExerciseOther: e.target.value })}
          />
        ) : null}
      </div>
    ),
  },
  {
    id: "experience",
    question: "운동은 얼마나 하셨나요?",
    render: ({ fields, set }) => (
      <ChoiceList
        options={EXPERIENCE_OPTIONS}
        value={fields.experience}
        onPick={(v) => set({ experience: v })}
      />
    ),
  },
  {
    id: "weeklyGoal",
    question: "일주일에 운동 목표가 어느 정도인가요?",
    render: ({ fields, set }) => (
      <ChoiceList
        options={WEEKLY_GOAL_OPTIONS}
        value={fields.weeklyGoal}
        onPick={(v) => set({ weeklyGoal: v })}
      />
    ),
  },
  {
    id: "healthFlags",
    question: "Pace가 알아야 할 점이 있을까요?",
    hint: "해당하는 것을 모두 골라 주세요. 본인만 볼 수 있어요",
    validate: (f) =>
      f.healthFlags.length ? null : "해당 없으면 '해당 없음'을 선택해 주세요.",
    render: ({ fields, set }) => (
      <div className="space-y-3">
        <MultiChoiceList
          options={HEALTH_FLAG_OPTIONS}
          values={fields.healthFlags}
          onToggle={(v: HealthFlag) => {
            const next = toggleHealthFlag(fields.healthFlags, v)
            // '해당 없음'을 고르면 자유입력도 함께 비운다.
            set(next.includes("none") ? { healthFlags: next, healthNote: "" } : { healthFlags: next })
          }}
        />
        {fields.healthFlags.includes("none") ? null : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">기타 (직접 입력)</p>
            <textarea
              rows={3}
              className={`${inputClass} min-h-[5.5rem] resize-y`}
              placeholder="예: 무릎 통증 있어 러닝 시 주의"
              value={fields.healthNote}
              onChange={(e) => set({ healthNote: e.target.value })}
            />
          </div>
        )}
      </div>
    ),
  },
]

export function MyPageOnboarding({
  userId,
  initial,
  onComplete,
}: {
  userId: string
  initial: ProfileFields
  onComplete: (fields: ProfileFields, message: string) => void
}) {
  const [index, setIndex] = useState(0)
  const [fields, setFields] = useState<ProfileFields>(initial)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const step = STEPS[index]
  const isLast = index === STEPS.length - 1
  const progress = useMemo(() => Math.round(((index + 1) / STEPS.length) * 100), [index])
  // 필수 항목이 안 채워졌으면 [다음]을 막고 무엇이 필요한지 보여준다.
  const blockedBy = step.validate?.(fields) ?? null

  const set = (partial: Partial<ProfileFields>) => {
    setFields((prev) => ({ ...prev, ...partial }))
    setError(null)
  }

  const submit = async (finalFields: ProfileFields) => {
    setSubmitting(true)
    setError(null)
    try {
      const message = await saveMyPageProfileToApi(userId, finalFields)
      onComplete(finalFields, message)
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  /** 검증 후 다음 단계로. 마지막 단계면 저장한다. */
  const advance = () => {
    if (blockedBy) {
      setError(blockedBy)
      return
    }
    if (isLast) {
      void submit(fields)
      return
    }
    setError(null)
    setIndex((i) => i + 1)
  }

  const back = () => {
    setError(null)
    setIndex((i) => Math.max(0, i - 1))
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-6">
        <div className="mb-2 text-xs text-muted-foreground">
          {index + 1} / {STEPS.length}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/90 p-6 shadow-lg shadow-black/10 backdrop-blur-sm md:p-8">
        <h2 className="text-2xl font-bold text-foreground md:text-3xl">{step.question}</h2>
        {step.hint ? <p className="mt-2 text-sm text-muted-foreground">{step.hint}</p> : null}

        {/* key로 단계마다 입력 상태를 새로 마운트해 autoFocus가 매번 걸리게 한다 */}
        <div className="mt-6" key={step.id}>
          {step.render({ fields, set, advance })}
        </div>

        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : blockedBy ? (
          <p className="mt-4 text-sm text-muted-foreground">{blockedBy}</p>
        ) : null}

        <div className="mt-8 flex items-center gap-3">
          {index > 0 ? (
            <button
              type="button"
              onClick={back}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 disabled:opacity-60"
            >
              <ArrowLeft className="size-4" aria-hidden />
              이전
            </button>
          ) : null}

          <button
            type="button"
            onClick={advance}
            disabled={submitting || blockedBy != null}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? (
              "저장 중…"
            ) : isLast ? (
              <>
                <Check className="size-4" aria-hidden />
                완료
              </>
            ) : step.optional ? (
              <>
                건너뛰기
                <ArrowRight className="size-4" aria-hidden />
              </>
            ) : (
              <>
                다음
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </button>
        </div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Heart className="size-3.5 text-primary" aria-hidden />
        입력한 정보는 맞춤 운동 추천에만 사용돼요
      </p>
    </div>
  )
}
