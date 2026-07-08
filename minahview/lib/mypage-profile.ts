export type FavoriteExercise = "gym" | "running" | "cycling" | "other"

export type ExerciseExperience =
  | "under_1"
  | "1_to_2"
  | "2_to_3"
  | "3_to_5"
  | "over_5"

export type WeeklyExerciseGoal = "1_2" | "3_4" | "5_plus"

export type Gender = "male" | "female"

export type MyPageProfile = {
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

type ApiMyPageProfile = {
  userId?: string
  name?: string | null
  gender?: Gender | null
  genderLabel?: string | null
  birthDate?: string | null
  phone?: string | null
  heightCm?: number | null
  weightKg?: number | null
  favoriteExercise?: FavoriteExercise | null
  favoriteExerciseOther?: string | null
  experience?: ExerciseExperience | null
  weeklyGoal?: WeeklyExerciseGoal | null
  healthNote?: string | null
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
  if (!json.name && !json.birthDate && !json.phone) {
    return null
  }
  const gender: Gender = json.gender === "female" ? "female" : "male"

  return {
    name: json.name ?? "",
    gender,
    birthDate: json.birthDate ?? "",
    phone: json.phone ?? "",
    heightCm: json.heightCm != null ? String(json.heightCm) : "",
    weightKg: json.weightKg != null ? String(json.weightKg) : "",
    favoriteExercise: (json.favoriteExercise as FavoriteExercise) ?? "gym",
    favoriteExerciseOther: json.favoriteExerciseOther ?? "",
    experience: (json.experience as ExerciseExperience) ?? "under_1",
    weeklyGoal: (json.weeklyGoal as WeeklyExerciseGoal) ?? "3_4",
    healthNote: json.healthNote ?? "",
    updatedAt: new Date().toISOString(),
  }
}

export async function saveMyPageProfileToApi(
  userId: string,
  profile: Omit<MyPageProfile, "updatedAt">,
): Promise<string> {
  const res = await fetch("/api/mypage/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      name: profile.name,
      gender: profile.gender,
      birthDate: profile.birthDate,
      phone: profile.phone,
      heightCm: Number(profile.heightCm),
      weightKg: Number(profile.weightKg),
      favoriteExercise: profile.favoriteExercise,
      favoriteExerciseOther: profile.favoriteExerciseOther,
      experience: profile.experience,
      weeklyGoal: profile.weeklyGoal,
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
