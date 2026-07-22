"use client"

import { useRouter } from "next/navigation"
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react"
import { Activity, Dumbbell, Heart, LogOut, Mars, Pencil, Save, Shield, UserRound, Venus, X } from "lucide-react"

import { ScheduleAccessSettings } from "@/components/schedule-access-settings"
import {
  AUTH_SESSION_EVENT,
  changeMyRole,
  clearLoggedInUserId,
  getLoggedInUserId,
  getLoggedInUserRole,
} from "@/lib/auth-session"
import {
  calcBmi,
  EXPERIENCE_OPTIONS,
  FAVORITE_EXERCISE_OPTIONS,
  fetchMyPageProfileFromApi,
  formatBirthDate,
  getExperienceLabel,
  getFavoriteExerciseLabel,
  getGenderLabel,
  getWeeklyGoalLabel,
  isValidBirthDate,
  saveMyPageProfileToApi,
  type ExerciseExperience,
  type FavoriteExercise,
  type Gender,
  type WeeklyExerciseGoal,
  GENDER_OPTIONS,
  WEEKLY_GOAL_OPTIONS,
} from "@/lib/mypage-profile"

const inputClass =
  "w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"

type ProfileFields = {
  name: string
  gender: Gender
  birthDate: string
  phone: string
  heightCm: string
  weightKg: string
  favoriteExercise: FavoriteExercise
  favoriteExerciseOther: string
  experience: ExerciseExperience
  weeklyGoal: WeeklyExerciseGoal
  healthNote: string
}

type MyPageState = ProfileFields & {
  hydrated: boolean
  userId: string | null
  hasProfile: boolean
  editing: boolean
  submitting: boolean
  error: string | null
  savedMessage: string | null
  name: string
  birthDate: string
  phone: string
  heightCm: string
  weightKg: string
  favoriteExercise: FavoriteExercise
  favoriteExerciseOther: string
  experience: ExerciseExperience
  weeklyGoal: WeeklyExerciseGoal
  healthNote: string
}

function hasProfileData(fields: ProfileFields): boolean {
  return Boolean(fields.name.trim() && fields.birthDate.trim() && fields.phone.trim())
}

function pickProfileFields(state: MyPageState): ProfileFields {
  return {
    name: state.name,
    gender: state.gender,
    birthDate: state.birthDate,
    phone: state.phone,
    heightCm: state.heightCm,
    weightKg: state.weightKg,
    favoriteExercise: state.favoriteExercise,
    favoriteExerciseOther: state.favoriteExerciseOther,
    experience: state.experience,
    weeklyGoal: state.weeklyGoal,
    healthNote: state.healthNote,
  }
}

const emptyProfileFields: ProfileFields = {
  name: "",
  gender: "male",
  birthDate: "",
  phone: "",
  heightCm: "",
  weightKg: "",
  favoriteExercise: "gym",
  favoriteExerciseOther: "",
  experience: "under_1",
  weeklyGoal: "3_4",
  healthNote: "",
}

const initialState: MyPageState = {
  hydrated: false,
  userId: null,
  hasProfile: false,
  editing: false,
  submitting: false,
  error: null,
  savedMessage: null,
  ...emptyProfileFields,
}

function RadioGroup<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  disabled,
}: {
  name: string
  legend: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-1 block text-sm font-medium text-foreground">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const id = `${name}-${opt.value}`
          const checked = value === opt.value
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                checked
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              <input
                type="radio"
                id={id}
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="size-4 accent-primary"
              />
              <span>{opt.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/25 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  )
}

function GenderIcon({ gender, className }: { gender: Gender; className?: string }) {
  const cn = className ?? "size-5 shrink-0"
  if (gender === "female") {
    return <Venus className={cn} aria-hidden />
  }
  return <Mars className={cn} aria-hidden />
}

function GenderRadioGroup({
  value,
  onChange,
  disabled,
}: {
  value: Gender
  onChange: (v: Gender) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-1 block text-sm font-medium text-foreground">성별</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {GENDER_OPTIONS.map((opt) => {
          const id = `gender-${opt.value}`
          const checked = value === opt.value
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                checked
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              <input
                type="radio"
                id={id}
                name="gender"
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              <GenderIcon
                gender={opt.value}
                className={`size-5 shrink-0 ${checked ? "text-primary" : "text-muted-foreground"}`}
              />
              <span className="font-medium">{opt.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function isCoachOrAdmin(role: string | null): boolean {
  return role === "coach" || role === "admin"
}

export function MyPageForm({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const [state, setState] = useState<MyPageState>(initialState)
  const [editSnapshot, setEditSnapshot] = useState<ProfileFields | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [roleSwitching, setRoleSwitching] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)
  const coachView = isCoachOrAdmin(role)

  useEffect(() => {
    const sync = () => setRole(getLoggedInUserRole())
    sync()
    window.addEventListener(AUTH_SESSION_EVENT, sync)
    return () => window.removeEventListener(AUTH_SESSION_EVENT, sync)
  }, [])

  const handleChangeRole = async (next: "user" | "coach") => {
    if (roleSwitching || next === role) return
    setRoleError(null)
    setRoleSwitching(true)
    try {
      const updated = await changeMyRole(next)
      setRole(updated)
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : "역할 변경에 실패했습니다.")
    } finally {
      setRoleSwitching(false)
    }
  }

  function handleLogout() {
    if (!getLoggedInUserId()) {
      router.replace("/login?from=/mypage")
      return
    }
    clearLoggedInUserId()
    router.replace("/login?from=/mypage")
  }

  const patch = (partial: Partial<MyPageState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name === "birthDate") {
      patch({ birthDate: value.replace(/\D/g, "").slice(0, 8) })
      return
    }
    patch({ [name]: value } as Partial<MyPageState>)
  }

  useEffect(() => {
    const id = getLoggedInUserId()
    patch({ userId: id })
    if (!id) {
      patch({ hydrated: true })
      return
    }

    void (async () => {
      try {
        const saved = await fetchMyPageProfileFromApi(id)
        if (saved) {
          const fields: ProfileFields = {
            name: saved.name,
            gender: saved.gender,
            birthDate: saved.birthDate,
            phone: saved.phone,
            heightCm: saved.heightCm,
            weightKg: saved.weightKg,
            favoriteExercise: saved.favoriteExercise,
            favoriteExerciseOther: saved.favoriteExerciseOther ?? "",
            experience: saved.experience,
            weeklyGoal: saved.weeklyGoal ?? "3_4",
            healthNote: saved.healthNote ?? "",
          }
          const profileExists = hasProfileData(fields)
          patch({
            ...fields,
            hasProfile: profileExists,
            editing: !profileExists,
          })
        } else {
          patch({ hasProfile: false, editing: true })
        }
      } catch (err) {
        patch({
          error: err instanceof Error ? err.message : "프로필을 불러오지 못했습니다.",
        })
      } finally {
        patch({ hydrated: true })
      }
    })()
  }, [])

  const bmi = useMemo(
    () => calcBmi(state.heightCm, state.weightKg),
    [state.heightCm, state.weightKg],
  )

  const handleSaveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    patch({ error: null, savedMessage: null })

    if (!state.userId) {
      patch({ error: "로그인 후 마이페이지를 저장할 수 있습니다." })
      return
    }

    const entries = Object.fromEntries(new FormData(e.currentTarget).entries())
    const birthDate = String(entries.birthDate ?? "").replace(/\D/g, "")
    const favoriteExercise = String(entries.favoriteExercise ?? "gym") as FavoriteExercise
    const favoriteExerciseOther = String(entries.favoriteExerciseOther ?? "").trim()
    const gender = String(entries.gender ?? "") as Gender

    if (gender !== "male" && gender !== "female") {
      patch({ error: "성별을 선택해 주세요." })
      return
    }
    if (!isValidBirthDate(birthDate)) {
      patch({ error: "생년월일은 8자리(예: 20030401)로 입력해 주세요." })
      return
    }
    if (favoriteExercise === "other" && !favoriteExerciseOther) {
      patch({ error: "기타 운동을 선택한 경우 운동 종목을 입력해 주세요." })
      return
    }

    patch({ submitting: true })
    try {
      const message = await saveMyPageProfileToApi(state.userId, {
        name: String(entries.name ?? "").trim(),
        gender,
        birthDate,
        phone: String(entries.phone ?? "").trim(),
        heightCm: String(entries.heightCm ?? "").trim(),
        weightKg: String(entries.weightKg ?? "").trim(),
        favoriteExercise,
        favoriteExerciseOther,
        experience: String(entries.experience ?? "under_1") as ExerciseExperience,
        weeklyGoal: String(entries.weeklyGoal ?? "3_4") as WeeklyExerciseGoal,
        healthNote: String(entries.healthNote ?? "").trim(),
      })
      patch({ savedMessage: message, hasProfile: true, editing: false })
      setEditSnapshot(null)
    } catch (err) {
      patch({
        error: err instanceof Error ? err.message : "저장에 실패했습니다.",
      })
    } finally {
      patch({ submitting: false })
    }
  }

  const startEditing = () => {
    setEditSnapshot(pickProfileFields(state))
    patch({ editing: true, error: null, savedMessage: null })
  }

  const cancelEditing = () => {
    if (editSnapshot) {
      patch({ ...editSnapshot, editing: false, error: null, savedMessage: null })
    } else {
      patch({ editing: false, error: null, savedMessage: null })
    }
    setEditSnapshot(null)
  }

  const {
    hydrated,
    userId,
    hasProfile,
    editing,
    submitting,
    error,
    savedMessage,
    name,
    gender,
    birthDate,
    phone,
    heightCm,
    weightKg,
    favoriteExercise,
    favoriteExerciseOther,
    experience,
    weeklyGoal,
    healthNote,
  } = state

  if (!hydrated) {
    return <div className="min-h-[20rem] animate-pulse rounded-2xl bg-secondary/30" aria-hidden />
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {!embedded ? (
        <div className="mb-8 text-center md:text-left">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-secondary/80 px-3 py-1.5 text-xs font-medium text-foreground/90">
            <UserRound className="size-3.5 text-primary" aria-hidden />
            헬스 프로필
          </div>
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">마이페이지</h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            맞춤 운동·피드백을 위해 기초 신체 정보와 운동 습관을 입력해 주세요. Neon DB에 저장됩니다.
            {userId ? (
              <span className="mt-1 block text-xs text-muted-foreground">로그인 아이디: {userId}</span>
            ) : null}
          </p>
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">
          저장된 기초 정보를 확인하고, 수정이 필요할 때만 편집할 수 있어요.
          {userId ? (
            <span className="mt-1 block text-xs">로그인 아이디: {userId}</span>
          ) : null}
        </p>
      )}

      {userId ? (
        <div className="mb-6 rounded-2xl border border-border bg-card/90 p-5 shadow-lg shadow-black/10 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">내 역할</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {role === "admin"
                  ? "관리자 계정입니다. 역할은 이메일 기준으로 자동 부여돼요."
                  : "회원/코치를 선택하세요. 코치는 스케줄·회원 관리 기능을 사용합니다."}
              </p>
            </div>
            {role === "admin" ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary">
                <Shield className="size-3.5" aria-hidden />
                관리자
              </span>
            ) : null}
          </div>

          {role !== "admin" ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                { value: "user", label: "회원", Icon: UserRound },
                { value: "coach", label: "코치", Icon: Dumbbell },
              ] as const).map((opt) => {
                const selected = role === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChangeRole(opt.value)}
                    disabled={roleSwitching || selected}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                      selected
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground disabled:opacity-60"
                    }`}
                  >
                    <opt.Icon className="size-4" aria-hidden />
                    {opt.label}
                    {selected ? <span className="text-xs text-primary">(현재)</span> : null}
                  </button>
                )
              })}
            </div>
          ) : null}

          {roleError ? <p className="mt-2 text-sm text-destructive">{roleError}</p> : null}
          {roleSwitching ? <p className="mt-2 text-xs text-muted-foreground">역할 변경 중…</p> : null}
        </div>
      ) : null}

      <div className="space-y-8 rounded-2xl border border-border bg-card/90 p-6 shadow-lg shadow-black/10 backdrop-blur-sm md:p-8">
        {!editing && hasProfile ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <UserRound className="size-5 text-primary" aria-hidden />
                기초 정보
              </h2>
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
              >
                <Pencil className="size-4" aria-hidden />
                수정
              </button>
            </div>

            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">기본 정보</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileRow label="이름" value={name} />
                <div className="rounded-xl border border-border/70 bg-secondary/25 px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground">성별</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground">
                    <GenderIcon gender={gender} className="size-4 text-primary" />
                    {getGenderLabel(gender)}
                  </p>
                </div>
                <ProfileRow label="생년월일" value={formatBirthDate(birthDate)} />
                <ProfileRow label="전화번호" value={phone} />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Activity className="size-4 text-primary" aria-hidden />
                신체 정보
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileRow label="키 (cm)" value={heightCm ? `${heightCm} cm` : ""} />
                <ProfileRow label="몸무게 (kg)" value={weightKg ? `${weightKg} kg` : ""} />
              </div>
              {bmi != null ? (
                <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
                  계산된 BMI: <strong className="text-primary">{bmi}</strong>
                  <span className="ml-2 text-muted-foreground">(참고용)</span>
                </p>
              ) : null}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">운동 습관</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileRow
                  label="자주 하는 운동"
                  value={getFavoriteExerciseLabel(favoriteExercise, favoriteExerciseOther)}
                />
                <ProfileRow label="운동 경력" value={getExperienceLabel(experience)} />
                <ProfileRow label="주간 운동 목표" value={getWeeklyGoalLabel(weeklyGoal)} />
              </div>
            </section>

            {healthNote.trim() ? (
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Heart className="size-4 text-primary" aria-hidden />
                  건강 메모
                </h3>
                <p className="whitespace-pre-wrap rounded-xl border border-border/70 bg-secondary/25 px-4 py-3 text-sm text-foreground">
                  {healthNote}
                </p>
              </section>
            ) : null}

            {savedMessage ? <p className="text-sm text-primary">{savedMessage}</p> : null}
          </>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <UserRound className="size-5 text-primary" aria-hidden />
                {hasProfile ? "기초 정보 수정" : "기초 정보 등록"}
              </h2>
              {hasProfile ? (
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 disabled:opacity-60"
                >
                  <X className="size-4" aria-hidden />
                  취소
                </button>
              ) : null}
            </div>

        <section className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">기본 정보</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="mypage-name" className="mb-2 block text-sm font-medium text-foreground">
                이름
              </label>
              <input
                id="mypage-name"
                name="name"
                required
                disabled={submitting}
                className={inputClass}
                placeholder="홍길동"
                value={name}
                onChange={handleChange}
              />
            </div>
            <div className="sm:col-span-2">
              <GenderRadioGroup
                value={gender}
                onChange={(v) => patch({ gender: v })}
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="mypage-birth" className="mb-2 block text-sm font-medium text-foreground">
                생년월일
              </label>
              <input
                id="mypage-birth"
                name="birthDate"
                required
                inputMode="numeric"
                maxLength={10}
                disabled={submitting}
                className={inputClass}
                placeholder="20030401"
                value={formatBirthDate(birthDate)}
                onChange={handleChange}
              />
              <p className="mt-1 text-xs text-muted-foreground">숫자 8자리 (YYYYMMDD)</p>
            </div>
            <div>
              <label htmlFor="mypage-phone" className="mb-2 block text-sm font-medium text-foreground">
                전화번호
              </label>
              <input
                id="mypage-phone"
                name="phone"
                type="tel"
                required
                disabled={submitting}
                className={inputClass}
                placeholder="010-1234-5678"
                value={phone}
                onChange={handleChange}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Activity className="size-4 text-primary" aria-hidden />
            신체 정보
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mypage-height" className="mb-2 block text-sm font-medium text-foreground">
                키 (cm)
              </label>
              <input
                id="mypage-height"
                name="heightCm"
                type="number"
                min={100}
                max={250}
                required
                disabled={submitting}
                className={inputClass}
                placeholder="170"
                value={heightCm}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="mypage-weight" className="mb-2 block text-sm font-medium text-foreground">
                몸무게 (kg)
              </label>
              <input
                id="mypage-weight"
                name="weightKg"
                type="number"
                min={30}
                max={300}
                step="0.1"
                required
                disabled={submitting}
                className={inputClass}
                placeholder="65"
                value={weightKg}
                onChange={handleChange}
              />
            </div>
          </div>
          {bmi != null ? (
            <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
              계산된 BMI: <strong className="text-primary">{bmi}</strong>
              <span className="ml-2 text-muted-foreground">(참고용, 의료 진단이 아닙니다)</span>
            </p>
          ) : null}
        </section>

        <RadioGroup
          name="favoriteExercise"
          legend="자주 하는 운동"
          options={FAVORITE_EXERCISE_OPTIONS}
          value={favoriteExercise}
          onChange={(v) => patch({ favoriteExercise: v })}
          disabled={submitting}
        />

        {favoriteExercise === "other" ? (
          <div>
            <label htmlFor="mypage-exercise-other" className="mb-2 block text-sm font-medium text-foreground">
              기타 운동 종목
            </label>
            <input
              id="mypage-exercise-other"
              name="favoriteExerciseOther"
              disabled={submitting}
              className={inputClass}
              placeholder="예: 수영, 요가, 클라이밍"
              value={favoriteExerciseOther}
              onChange={handleChange}
            />
          </div>
        ) : null}

        <RadioGroup
          name="experience"
          legend="운동 경력"
          options={EXPERIENCE_OPTIONS}
          value={experience}
          onChange={(v) => patch({ experience: v })}
          disabled={submitting}
        />

        <RadioGroup
          name="weeklyGoal"
          legend="주간 운동 목표 (추가)"
          options={WEEKLY_GOAL_OPTIONS}
          value={weeklyGoal}
          onChange={(v) => patch({ weeklyGoal: v })}
          disabled={submitting}
        />

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Heart className="size-4 text-primary" aria-hidden />
            건강 메모 (추가)
          </h3>
          <p className="text-xs text-muted-foreground">부상 이력, 알레르기, 복용 약 등 AI·코치 참고용 (선택)</p>
          <textarea
            id="mypage-health-note"
            name="healthNote"
            rows={3}
            disabled={submitting}
            className={`${inputClass} resize-y min-h-[5rem]`}
            placeholder="예: 무릎 통증 있어 러닝 시 주의"
            value={healthNote}
            onChange={handleChange}
          />
        </section>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {savedMessage ? <p className="text-sm text-primary">{savedMessage}</p> : null}

        <button
          type="submit"
          disabled={submitting || !userId}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <Save className="size-4" aria-hidden />
          {submitting ? "저장 중…" : hasProfile ? "변경 사항 저장" : "프로필 저장"}
        </button>
          </form>
        )}
      </div>

      {coachView ? (
        <div className="mt-8">
          <ScheduleAccessSettings className="border-dashed border-primary/30 bg-secondary/20" />
        </div>
      ) : null}

    </div>
  )
}
