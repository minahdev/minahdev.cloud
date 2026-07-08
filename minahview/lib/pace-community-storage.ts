/** 커뮤니티 운동 게시물 (Neon / inbody API) */

import { getLoggedInUserId } from "@/lib/auth-session"
import { inbodyFetch } from "@/lib/inbody-api"

export type CommunityMediaItem = {
  url: string
  type: "image" | "video"
}

export const MAX_COMMUNITY_MEDIA = 4

export type CommunityPost = {
  id: string
  authorId: string
  workoutType: string
  content: string
  createdAt: string
  distanceKm?: number | null
  durationMin?: number | null
  calories?: number | null
  media?: CommunityMediaItem[]
  cheerCount: number
  commentCount: number
  cheeredByMe: boolean
}

/** 백엔드 `/uploads/...` 경로를 Next 프록시 URL로 변환 */
export function resolveCommunityMediaUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  const path = url.startsWith("/") ? url.slice(1) : url
  if (path.startsWith("uploads/")) {
    return `/api/inbody/uploads/${path.slice("uploads/".length)}`
  }
  return `/api/inbody/uploads/${path}`
}

export type CommunityComment = {
  id: string
  authorId: string
  content: string
  createdAt: string
}

export const WORKOUT_TYPE_OPTIONS = [
  "러닝",
  "헬스",
  "사이클",
  "수영",
  "요가·필라테스",
  "기타",
] as const

export const WORKOUT_TYPE_EMOJI: Record<string, string> = {
  러닝: "🏃",
  헬스: "🏋️",
  사이클: "🚴",
  수영: "🏊",
  "요가·필라테스": "🧘",
  기타: "✨",
}

export const COMMUNITY_FILTER_CHIPS: { id: string; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "러닝", label: "🏃 러닝" },
  { id: "헬스", label: "🏋️ 헬스" },
  { id: "사이클", label: "🚴 사이클" },
  { id: "수영", label: "🏊 수영" },
  { id: "요가·필라테스", label: "🧘 요가" },
  { id: "기타", label: "✨ 기타" },
]

function isMediaItem(row: unknown): row is CommunityMediaItem {
  if (row === null || typeof row !== "object") return false
  const o = row as Record<string, unknown>
  return (
    typeof o.url === "string" &&
    (o.type === "image" || o.type === "video")
  )
}

function isCommunityPost(row: unknown): row is CommunityPost {
  if (row === null || typeof row !== "object") return false
  const o = row as Record<string, unknown>
  const mediaOk =
    o.media === undefined ||
    (Array.isArray(o.media) && o.media.every(isMediaItem))
  return (
    typeof o.id === "string" &&
    typeof o.authorId === "string" &&
    typeof o.workoutType === "string" &&
    typeof o.content === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.cheerCount === "number" &&
    typeof o.commentCount === "number" &&
    typeof o.cheeredByMe === "boolean" &&
    mediaOk
  )
}

function isCommunityComment(row: unknown): row is CommunityComment {
  if (row === null || typeof row !== "object") return false
  const o = row as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.authorId === "string" &&
    typeof o.content === "string" &&
    typeof o.createdAt === "string"
  )
}

export async function loadCommunityPosts(): Promise<CommunityPost[]> {
  const userId = getLoggedInUserId()
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : ""
  const rows = await inbodyFetch<unknown[]>(`/api/inbody/community/posts${qs}`)
  if (!Array.isArray(rows)) return []
  return rows
    .filter(isCommunityPost)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function uploadCommunityMedia(file: File): Promise<CommunityMediaItem> {
  const userId = getLoggedInUserId()
  if (!userId) throw new Error("로그인이 필요합니다.")

  const form = new FormData()
  form.append("userId", userId)
  form.append("file", file)

  const res = await fetch("/api/inbody/community/media", {
    method: "POST",
    body: form,
    cache: "no-store",
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const d = data as { error?: string; detail?: string }
    throw new Error(d.error || d.detail || "미디어 업로드에 실패했습니다.")
  }
  if (!isMediaItem(data)) throw new Error("업로드 응답 형식이 올바르지 않습니다.")
  return data
}

export async function addCommunityPost(
  authorId: string,
  fields: {
    workoutType: string
    content: string
    distanceKm?: number | null
    durationMin?: number | null
    calories?: number | null
    media?: CommunityMediaItem[]
  },
): Promise<CommunityPost> {
  const userId = getLoggedInUserId() ?? authorId
  const body: Record<string, unknown> = {
    userId,
    workoutType: fields.workoutType.trim() || "기타",
    content: fields.content.trim(),
    media: fields.media ?? [],
  }
  if (fields.distanceKm != null && !Number.isNaN(fields.distanceKm)) {
    body.distanceKm = fields.distanceKm
  }
  if (fields.durationMin != null && !Number.isNaN(fields.durationMin)) {
    body.durationMin = Math.round(fields.durationMin)
  }
  if (fields.calories != null && !Number.isNaN(fields.calories)) {
    body.calories = Math.round(fields.calories)
  }
  return inbodyFetch<CommunityPost>("/api/inbody/community/posts", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function toggleCommunityCheer(
  postId: string,
): Promise<{ cheerCount: number; cheeredByMe: boolean }> {
  const userId = getLoggedInUserId()
  if (!userId) throw new Error("로그인이 필요합니다.")
  return inbodyFetch(`/api/inbody/community/posts/${postId}/cheer`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  })
}

export async function loadCommunityComments(postId: string): Promise<CommunityComment[]> {
  const rows = await inbodyFetch<unknown[]>(
    `/api/inbody/community/posts/${postId}/comments`,
  )
  if (!Array.isArray(rows)) return []
  return rows.filter(isCommunityComment)
}

export async function addCommunityComment(
  postId: string,
  content: string,
): Promise<CommunityComment> {
  const userId = getLoggedInUserId()
  if (!userId) throw new Error("로그인이 필요합니다.")
  return inbodyFetch(`/api/inbody/community/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ userId, content: content.trim() }),
  })
}
