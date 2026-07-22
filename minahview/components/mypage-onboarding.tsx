"use client"

import { type ReactNode, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Heart, Mars, Venus } from "lucide-react"

import {
  calcBmi,
  EXPERIENCE_OPTIONS,
  FAVORITE_EXERCISE_OPTIONS,
  formatBirthDate,
  GENDER_OPTIONS,
  isValidBirthDate,
  type Gender,
  type MyPageProfile,
  saveMyPageProfileToApi,
  WEEKLY_GOAL_OPTIONS,
} from "@/lib/mypage-profile"

type ProfileFields = Omit<MyPageProfile, "updatedAt">

const inputClass =
  "w-full bg-secondary border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"

/** 한 단계 = 질문 하나. validate가 문자열을 반환하면 그 메시지로 진행을 막는다. */
type Step = {
  id: string
  question: string
  hint?: string
  /** 선택지를 고르면 자동으로 다음 단계로 넘어간다 (설문 리듬 유지) */
  autoAdvance?: boolean
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
    id: "gender",
    question: "성별을 선택해 주세요",
    autoAdvance: true,
    render: ({ fields, set, advance }) => (
      <ChoiceList
        options={GENDER_OPTIONS}
        value={fields.gender}
        onPick={(v: Gender) => {
          set({ gender: v })
          advance()
        }}
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
    hint: "숫자 8자리로 입력해 주세요 (예: 20030401)",
    validate: (f) => (isValidBirthDate(f.birthDate) ? null : "생년월일을 8자리로 입력해 주세요."),
    render: ({ fields, set, advance }) => (
      <input
        autoFocus
        inputMode="numeric"
        maxLength={10}
        className={inputClass}
        placeholder="20030401"
        value={formatBirthDate(fields.birthDate)}
        onChange={(e) => set({ birthDate: e.target.value.replace(/\D/g, "").slice(0, 8) })}
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
    id: "phone",
    question: "연락처를 입력해 주세요",
    validate: (f) => (f.phone.trim() ? null : "전화번호를 입력해 주세요."),
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
    id: "favoriteExercise",
    question: "어떤 운동을 자주 하나요?",
    validate: (f) =>
      f.favoriteExercise === "other" && !f.favoriteExerciseOther.trim()
        ? "어떤 운동인지 입력해 주세요."
        : null,
    render: ({ fields, set, advance }) => (
      <div className="space-y-3">
        <ChoiceList
          options={FAVORITE_EXERCISE_OPTIONS}
          value={fields.favoriteExercise}
          onPick={(v) => {
            set({ favoriteExercise: v })
            // '기타'는 종목을 더 받아야 하므로 자동으로 넘기지 않는다.
            if (v !== "other") advance()
          }}
        />
        {fields.favoriteExercise === "other" ? (
          <input
            autoFocus
            className={inputClass}
            placeholder="예: 수영, 요가, 클라이밍"
            value={fields.favoriteExerciseOther}
            onChange={(e) => set({ favoriteExerciseOther: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                advance()
              }
            }}
          />
        ) : null}
      </div>
    ),
  },
  {
    id: "experience",
    question: "운동은 얼마나 하셨나요?",
    autoAdvance: true,
    render: ({ fields, set, advance }) => (
      <ChoiceList
        options={EXPERIENCE_OPTIONS}
        value={fields.experience}
        onPick={(v) => {
          set({ experience: v })
          advance()
        }}
      />
    ),
  },
  {
    id: "weeklyGoal",
    question: "일주일에 몇 번 운동하고 싶으세요?",
    autoAdvance: true,
    render: ({ fields, set, advance }) => (
      <ChoiceList
        options={WEEKLY_GOAL_OPTIONS}
        value={fields.weeklyGoal}
        onPick={(v) => {
          set({ weeklyGoal: v })
          advance()
        }}
      />
    ),
  },
  {
    id: "healthNote",
    question: "코치가 알아야 할 게 있나요?",
    hint: "부상 이력, 알레르기, 복용 중인 약 등",
    optional: true,
    render: ({ fields, set }) => (
      <textarea
        autoFocus
        rows={4}
        className={`${inputClass} min-h-[7rem] resize-y`}
        placeholder="예: 무릎 통증 있어 러닝 시 주의"
        value={fields.healthNote}
        onChange={(e) => set({ healthNote: e.target.value })}
      />
    ),
  },
]

export function MyPageOnboarding({
  userId,
  initial,
  onComplete,
  onUseFullForm,
}: {
  userId: string
  initial: ProfileFields
  onComplete: (fields: ProfileFields, message: string) => void
  onUseFullForm: () => void
}) {
  const [index, setIndex] = useState(0)
  const [fields, setFields] = useState<ProfileFields>(initial)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const step = STEPS[index]
  const isLast = index === STEPS.length - 1
  const progress = useMemo(() => Math.round(((index + 1) / STEPS.length) * 100), [index])

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
  const advance = (override?: Partial<ProfileFields>) => {
    const next = override ? { ...fields, ...override } : fields
    const message = step.validate?.(next) ?? null
    if (message) {
      setError(message)
      return
    }
    if (isLast) {
      void submit(next)
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
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {index + 1} / {STEPS.length}
          </span>
          <button
            type="button"
            onClick={onUseFullForm}
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            한 번에 입력하기
          </button>
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
          {step.render({ fields, set, advance: () => advance() })}
        </div>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

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
            onClick={() => advance()}
            disabled={submitting}
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
