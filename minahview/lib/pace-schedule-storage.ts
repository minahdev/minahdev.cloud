/** 레슨 일정·기록 (Neon / inbody API) */

import { getLoggedInUserId } from "@/lib/auth-session"
import { inbodyFetch, withUserId } from "@/lib/inbody-api"

export type LessonMedia = {
  id: string
  type: "image" | "video"
  name: string
  mimeType: string
  dataUrl: string
}

export type LessonRecord = {
  text: string
  media: LessonMedia[]
  updatedAt: string
}

export type LessonEntry = {
  id: string
  date: string
  title: string
  time: string
  /** 코치·회원 메모 (일정) */
  scheduleNote: string
  record: LessonRecord | null
  createdAt: string
  /** 회원 userId — 코치 탭·회원 본인 스케줄 구분 */
  memberUserId?: string
}

export function scheduleDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function lessonQuery(actorId: string, memberUserId: string): string {
  const extra =
    memberUserId !== actorId ? { memberUserId } : undefined
  return withUserId("/api/inbody/lessons", actorId, extra)
}

export async function loadLessons(memberUserId: string): Promise<LessonEntry[]> {
  const userId = getLoggedInUserId()
  if (!userId) return []
  const rows = await inbodyFetch<LessonEntry[]>(lessonQuery(userId, memberUserId))
  return Array.isArray(rows) ? rows : []
}

export async function upsertLesson(entry: LessonEntry, memberUserId: string): Promise<void> {
  const userId = getLoggedInUserId()
  if (!userId) throw new Error("로그인이 필요합니다.")
  await inbodyFetch("/api/inbody/lessons", {
    method: "PUT",
    body: JSON.stringify({
      userId,
      memberUserId: memberUserId !== userId ? memberUserId : undefined,
      id: entry.id,
      date: entry.date,
      title: entry.title,
      time: entry.time,
      scheduleNote: entry.scheduleNote,
      record: entry.record,
      createdAt: entry.createdAt,
    }),
  })
}

export async function deleteLesson(id: string, memberUserId: string): Promise<void> {
  const userId = getLoggedInUserId()
  if (!userId) throw new Error("로그인이 필요합니다.")
  const extra =
    memberUserId !== userId ? { memberUserId } : undefined
  const path = `${withUserId(`/api/inbody/lessons/${encodeURIComponent(id)}`, userId, extra)}`
  await inbodyFetch(path, { method: "DELETE" })
}

export function lessonsForDate(lessons: LessonEntry[], dateKey: string): LessonEntry[] {
  return lessons
    .filter((l) => l.date === dateKey)
    .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title))
}

export function datesWithLessons(lessons: LessonEntry[]): Date[] {
  const keys = new Set(lessons.map((l) => l.date))
  return [...keys].map((k) => {
    const [y, m, d] = k.split("-").map(Number)
    return new Date(y, m - 1, d)
  })
}

export function emptyLessonRecord(): LessonRecord {
  return { text: "", media: [], updatedAt: new Date().toISOString() }
}
