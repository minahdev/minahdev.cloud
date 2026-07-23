export type FavoriteExercise = "gym" | "running" | "cycling" | "other"

export type ExerciseExperience =
  | "under_1"
  | "1_to_2"
  | "2_to_3"
  | "3_to_5"
  | "over_5"

export type WeeklyExerciseGoal = "1_2" | "3_4" | "5_plus"

export type Gender = "male" | "female"

/** 민감 건강 특이사항. 코드는 백엔드 HEALTH_FLAG_LABELS 와 일치해야 한다. */
export type HealthFlag =
  | "diabetes"
  | "pregnant"
  | "medication"
  | "smoking"
  | "drinking"
  | "none"

export type MyPageProfile = {
  name: string
  nickname: string
  gender: Gender
  birthDate: string
  phone: string
  heightCm: string
  weightKg: string
  favoriteExercises: FavoriteExercise[]
  favoriteExerciseOther: string
  experience: ExerciseExperience
  weeklyGoal: WeeklyExerciseGoal
  healthFlags: HealthFlag[]
  healthNote: string
  /** 서버가 암호문을 복호화하지 못한 경우 true (읽기 전용) */
  healthUnreadable: boolean
  updatedAt: string
}

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "남성" },
  { value: "female", label: "여성" },
]

export const FAVORITE_EXERCISE_OPTIONS: { value: FavoriteExercise; label: string }[] = [
  { value: "gym", label: "헬스" },
  { value: "running", label: "러닝" },
  { value: "cycling", label: "자전거" },
  { value: "other", label: "기타" },
]

export const EXPERIENCE_OPTIONS: { value: ExerciseExperience; label: string }[] = [
  { value: "under_1", label: "1년 미만" },
  { value: "1_to_2", label: "1년 이상 ~ 2년 미만" },
  { value: "2_to_3", label: "2년 이상 ~ 3년 미만" },
  { value: "3_to_5", label: "3년 이상 ~ 5년 미만" },
  { value: "over_5", label: "5년 이상" },
]

export const WEEKLY_GOAL_OPTIONS: { value: WeeklyExerciseGoal; label: string }[] = [
  { value: "1_2", label: "주 1~2회" },
  { value: "3_4", label: "주 3~4회" },
  { value: "5_plus", label: "주 5회 이상" },
]

/** '해당 없음'은 배타 선택 — 다른 항목과 함께 고를 수 없다. */
export const HEALTH_FLAG_OPTIONS: { value: HealthFlag; label: string }[] = [
  { value: "diabetes", label: "당뇨" },
  { value: "pregnant", label: "임신·임산부" },
  { value: "medication", label: "상시 복용약" },
  { value: "smoking", label: "흡연" },
  { value: "drinking", label: "음주" },
  { value: "none", label: "해당 없음" },
]

const experienceLabelByValue = Object.fromEntries(
  EXPERIENCE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ExerciseExperience, string>

const weeklyGoalLabelByValue = Object.fromEntries(
  WEEKLY_GOAL_OPTIONS.map((o) => [o.value, o.label]),
) as Record<WeeklyExerciseGoal, string>

const favoriteExerciseLabelByValue = Object.fromEntries(
  FAVORITE_EXERCISE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<FavoriteExercise, string>

const genderLabelByValue = Object.fromEntries(
  GENDER_OPTIONS.map((o) => [o.value, o.label]),
) as Record<Gender, string>

const healthFlagLabelByValue = Object.fromEntries(
  HEALTH_FLAG_OPTIONS.map((o) => [o.value, o.label]),
) as Record<HealthFlag, string>

export function getGenderLabel(value: Gender): string {
  return genderLabelByValue[value] ?? value
}

export function getExperienceLabel(value: ExerciseExperience): string {
  return experienceLabelByValue[value] ?? value
}

export function getWeeklyGoalLabel(value: WeeklyExerciseGoal): string {
  return weeklyGoalLabelByValue[value] ?? value
}

export function getFavoriteExerciseLabel(
  value: FavoriteExercise,
  otherText?: string,
): string {
  if (value === "other" && otherText?.trim()) return otherText.trim()
  return favoriteExerciseLabelByValue[value] ?? value
}

export function getFavoriteExercisesLabel(
  values: FavoriteExercise[],
  otherText?: string,
): string {
  return values.map((v) => getFavoriteExerciseLabel(v, otherText)).join(", ")
}

export function getHealthFlagLabel(value: HealthFlag): string {
  return healthFlagLabelByValue[value] ?? value
}

/** '해당 없음'과 나머지 항목이 섞이지 않도록 정리한 선택 결과를 돌려준다. */
export function toggleHealthFlag(
  flags: HealthFlag[],
  value: HealthFlag,
): HealthFlag[] {
  if (flags.includes(value)) return flags.filter((f) => f !== value)
  if (value === "none") return ["none"]
  return [...flags.filter((f) => f !== "none"), value]
}

type ApiMyPageProfile = {
  userId?: string
  name?: string | null
  nickname?: string | null
  gender?: Gender | null
  genderLabel?: string | null
  birthDate?: string | null
  phone?: string | null
  heightCm?: number | null
  weightKg?: number | null
  favoriteExercise?: FavoriteExercise | null
  favoriteExercises?: FavoriteExercise[] | null
  favoriteExerciseOther?: string | null
  experience?: ExerciseExperience | null
  weeklyGoal?: WeeklyExerciseGoal | null
  healthFlags?: HealthFlag[] | null
  healthFlagLabels?: string[] | null
  healthNote?: string | null
  healthUnreadable?: boolean
  message?: string
  error?: string
}

export async function fetchMyPageProfileFromApi(
  userId: string,
): Promise<MyPageProfile | null> {
  const res = await fetch(`/api/mypage/profile?userId=${encodeURIComponent(userId)}`, {
    cache: "no-store",
  })
  const json = (await res.json()) as ApiMyPageProfile
  if (!res.ok) {
    throw new Error(json.error ?? "프로필을 불러오지 못했습니다.")
  }
  // 연락처는 선택 입력이라 프로필 존재 판단에서 뺀다.
  if (!json.name && !json.birthDate) {
    return null
  }
  const gender: Gender = json.gender === "female" ? "female" : "male"
  // 복수선택 도입 전 데이터는 단일 필드만 있다.
  const favoriteExercises =
    json.favoriteExercises?.length
      ? json.favoriteExercises
      : json.favoriteExercise
        ? [json.favoriteExercise]
        : []

  return {
    name: json.name ?? "",
    nickname: json.nickname ?? "",
    gender,
    birthDate: json.birthDate ?? "",
    phone: json.phone ?? "",
    heightCm: json.heightCm != null ? String(json.heightCm) : "",
    weightKg: json.weightKg != null ? String(json.weightKg) : "",
    favoriteExercises,
    favoriteExerciseOther: json.favoriteExerciseOther ?? "",
    experience: (json.experience as ExerciseExperience) ?? "under_1",
    weeklyGoal: (json.weeklyGoal as WeeklyExerciseGoal) ?? "3_4",
    healthFlags: json.healthFlags ?? [],
    healthNote: json.healthNote ?? "",
    healthUnreadable: json.healthUnreadable ?? false,
    updatedAt: new Date().toISOString(),
  }
}

export async function saveMyPageProfileToApi(
  userId: string,
  profile: Omit<MyPageProfile, "updatedAt" | "healthUnreadable">,
): Promise<string> {
  const res = await fetch("/api/mypage/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      name: profile.name,
      nickname: profile.nickname,
      gender: profile.gender,
      birthDate: profile.birthDate,
      phone: profile.phone,
      heightCm: Number(profile.heightCm),
      weightKg: Number(profile.weightKg),
      favoriteExercises: profile.favoriteExercises,
      favoriteExerciseOther: profile.favoriteExerciseOther,
      experience: profile.experience,
      weeklyGoal: profile.weeklyGoal,
      healthFlags: profile.healthFlags,
      healthNote: profile.healthNote,
    }),
  })
  const json = (await res.json()) as ApiMyPageProfile
  if (!res.ok) {
    throw new Error(json.error ?? "프로필 저장에 실패했습니다.")
  }
  return json.message ?? "마이페이지 정보가 저장되었습니다."
}

export function calcBmi(heightCm: string, weightKg: string): number | null {
  const h = Number(heightCm)
  const w = Number(weightKg)
  if (!h || !w || h <= 0) return null
  const m = h / 100
  return Math.round((w / (m * m)) * 10) / 10
}

export function formatBirthDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`
}

export function isValidBirthDate(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  if (digits.length !== 8) return false
  const y = Number(digits.slice(0, 4))
  const m = Number(digits.slice(4, 6))
  const d = Number(digits.slice(6, 8))
  if (y < 1900 || y > new Date().getFullYear()) return false
  if (m < 1 || m > 12) return false
  if (d < 1 || d > 31) return false
  return true
}
