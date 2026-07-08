/** 앱 공지사항 (Neon / inbody API) */

import { getLoggedInUserId } from "@/lib/auth-session"
import { inbodyFetch, withUserId } from "@/lib/inbody-api"

export type Notice = {
  id: string
  title: string
  body: string
  authorId: string
  createdAt: string
}

function isNotice(row: unknown): row is Notice {
  if (row === null || typeof row !== "object") return false
  const o = row as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.body === "string" &&
    typeof o.authorId === "string" &&
    typeof o.createdAt === "string"
  )
}

export async function loadNotices(): Promise<Notice[]> {
  const rows = await inbodyFetch<unknown[]>("/api/inbody/notices")
  if (!Array.isArray(rows)) return []
  return rows
    .filter(isNotice)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function addNotice(authorId: string, title: string, body: string): Promise<Notice> {
  const userId = getLoggedInUserId() ?? authorId
  return inbodyFetch<Notice>("/api/inbody/notices", {
    method: "POST",
    body: JSON.stringify({ userId, title: title.trim(), body: body.trim() }),
  })
}

export async function deleteNotice(id: string): Promise<void> {
  const userId = getLoggedInUserId()
  if (!userId) throw new Error("로그인이 필요합니다.")
  await inbodyFetch(withUserId(`/api/inbody/notices/${encodeURIComponent(id)}`, userId), {
    method: "DELETE",
  })
}
