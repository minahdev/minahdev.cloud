import {
  calcBmi,
  getExperienceLabel,
  getFavoriteExerciseLabel,
  getGenderLabel,
  getWeeklyGoalLabel,
  type MyPageProfile,
} from "@/lib/mypage-profile"
import type { TodayStoryEntry } from "@/lib/pace-today-story-storage"

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const

function todayWeekdayLabel(): string {
  return WEEKDAY_KO[new Date().getDay()]
}

export function buildTodayWorkoutPrompt(
  profile: MyPageProfile,
  todayStory: TodayStoryEntry | null,
): string {
  const bmi = calcBmi(profile.heightCm, profile.weightKg)
  const favorite = getFavoriteExerciseLabel(profile.favoriteExercise, profile.favoriteExerciseOther)
  const lines = [
    "당신은 친절한 헬스케어·운동 코치입니다. 아래 회원 프로필을 바탕으로 **오늘 하루**에 맞는 운동 추천만 작성하세요.",
    "",
    "## 회원 정보",
    `- 이름: ${profile.name}`,
    `- 성별: ${getGenderLabel(profile.gender)}`,
    profile.heightCm && profile.weightKg
      ? `- 신체: 키 ${profile.heightCm}cm, 몸무게 ${profile.weightKg}kg${bmi != null ? `, BMI ${bmi}` : ""}`
      : null,
    `- 선호 운동: ${favorite}`,
    `- 운동 경력: ${getExperienceLabel(profile.experience)}`,
    `- 주간 운동 목표: ${getWeeklyGoalLabel(profile.weeklyGoal)}`,
    profile.healthNote.trim() ? `- 건강 메모: ${profile.healthNote.trim()}` : null,
    todayStory?.mood ? `- 오늘 기분(홈 기록): ${todayStory.mood}` : null,
    todayStory?.story.trim()
      ? `- 오늘 한 줄 기록: ${todayStory.story.trim().slice(0, 200)}`
      : null,
    "",
    `오늘은 ${todayWeekdayLabel()}요일입니다.`,
    "",
    "## 출력 형식 (한국어)",
    "1. 인사 한 줄",
    "2. 오늘 추천 운동 요약 1~2문장",
    "3. 불릿 3개: 준비 · 본운동 · 마무리(각 1문장)",
    "4. 주의·휴식 한 줄",
    "의학적 진단은 하지 말고, 통증·질환 언급 시 전문의 상담을 권하세요. 400자 이내.",
  ].filter((line): line is string => line != null)

  return lines.join("\n")
}

/** Gemini 실패 시 표시할 간단 규칙 기반 추천 */
export function fallbackTodayWorkout(profile: MyPageProfile): string {
  const favorite = getFavoriteExerciseLabel(profile.favoriteExercise, profile.favoriteExerciseOther)
  const weekly = getWeeklyGoalLabel(profile.weeklyGoal)
  const exp = getExperienceLabel(profile.experience)

  let focus = "가벼운 전신 워밍업과 스트레칭"
  if (profile.favoriteExercise === "gym") focus = "상·하체를 나눠 45~60분 헬스(가슴·등·하체 중 1~2부위)"
  if (profile.favoriteExercise === "running") focus = "20~35분 조깅 또는 인터벌 러닝"
  if (profile.favoriteExercise === "cycling") focus = "30~45분 편안한 페이스 사이클 또는 실내 바이크"
  if (profile.favoriteExercise === "other" && profile.favoriteExerciseOther.trim()) {
    focus = `${profile.favoriteExerciseOther.trim()} 위주 30~40분`
  }

  const intensity =
    profile.experience === "under_1"
      ? "강도는 낮게, 폼과 호흡에 집중하세요."
      : profile.experience === "over_5" || profile.experience === "3_to_5"
        ? "평소 페이스를 유지하되, 피로가 쌓였다면 볼륨을 10% 줄이세요."
        : "중간 강도로 진행하고, 마지막 세트는 여유 있게 마무리하세요."

  const health = profile.healthNote.trim()
    ? `\n건강 메모를 반영해 무리한 점프·고중량은 피하고, ${profile.healthNote.trim()}에 맞게 조절하세요.`
    : ""

  return (
    `${profile.name}님, 오늘은 ${favorite} 성향에 맞춰 ${focus}을 추천합니다.\n\n` +
    `· 준비: 5~8분 동적 스트레칭과 가벼운 유산소\n` +
    `· 본운동: ${focus}\n` +
    `· 마무리: 5분 정적 스트레칭과 수분 보충\n\n` +
    `주간 목표(${weekly})와 경력(${exp})을 고려했습니다. ${intensity}${health}`
  )
}
