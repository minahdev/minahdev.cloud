/** 오늘의 이야기 · 감정 기록 (Neon / inbody API) */

import { getLoggedInUserId } from "@/lib/auth-session"
import { inbodyFetch, withUserId } from "@/lib/inbody-api"

export type MoodTag =
  | "활기참"
  | "평온"
  | "피곤"
  | "무기력"
  | "스트레스"
  | "불안"
  | "우울"
  | "짜증"

export type TodayStoryEntry = {
  date: string
  mood: MoodTag | null
  story: string
  recommendation: string | null
  updatedAt: string
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function isMoodTag(v: string | null | undefined): v is MoodTag {
  return v != null && (MOOD_OPTIONS as readonly string[]).includes(v)
}

type ApiTodayStory = {
  date: string
  mood: string | null
  story: string
  updatedAt: string
}

function normalizeStory(row: unknown): TodayStoryEntry | null {
  if (!row || typeof row !== "object") return null
  const data = row as ApiTodayStory
  if (typeof data.date !== "string") return null
  return {
    date: data.date,
    mood: isMoodTag(data.mood) ? data.mood : null,
    story: data.story ?? "",
    recommendation: null,
    updatedAt: data.updatedAt ?? "",
  }
}

export function hasTodayStoryContent(entry: TodayStoryEntry): boolean {
  return Boolean(entry.mood) || Boolean(entry.story.trim())
}

export async function loadTodayStories(): Promise<TodayStoryEntry[]> {
  const userId = getLoggedInUserId()
  if (!userId) return []
  const rows = await inbodyFetch<unknown[]>(withUserId("/api/inbody/today-stories", userId))
  if (!Array.isArray(rows)) return []
  return rows.map(normalizeStory).filter((e): e is TodayStoryEntry => e !== null)
}

export async function loadTodayStory(): Promise<TodayStoryEntry | null> {
  const userId = getLoggedInUserId()
  if (!userId) return null
  const data = await inbodyFetch<ApiTodayStory | null>(
    withUserId("/api/inbody/today-story", userId, { date: todayKey() }),
  )
  if (!data) return null
  return normalizeStory(data)
}

export async function saveTodayStory(
  story: string,
  mood: MoodTag | null,
  _recommendation?: string | null,
): Promise<TodayStoryEntry> {
  const userId = getLoggedInUserId()
  if (!userId) throw new Error("로그인이 필요합니다.")
  const data = await inbodyFetch<ApiTodayStory>("/api/inbody/today-story", {
    method: "PUT",
    body: JSON.stringify({
      userId,
      date: todayKey(),
      mood,
      story: story.trim(),
    }),
  })
  return {
    date: data.date,
    mood: isMoodTag(data.mood) ? data.mood : null,
    story: data.story ?? "",
    recommendation: null,
    updatedAt: data.updatedAt,
  }
}

export const MOOD_OPTIONS: MoodTag[] = [
  "활기참",
  "평온",
  "피곤",
  "무기력",
  "스트레스",
  "불안",
  "우울",
  "짜증",
]
