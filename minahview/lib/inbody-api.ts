import { getLoggedInUserId } from "@/lib/auth-session"

function apiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback
  const d = data as { error?: string; detail?: string }
  if (typeof d.error === "string" && d.error.trim()) return d.error
  if (typeof d.detail === "string") return d.detail
  return fallback
}

export async function inbodyFetch<T>(
  path: string,
  init?: RequestInit & { userId?: string | null },
): Promise<T> {
  const userId = init?.userId ?? getLoggedInUserId()
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const res = await fetch(path, { ...init, headers, cache: "no-store" })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(apiError(data, "요청에 실패했습니다."))
  }
  return data as T
}

export function withUserId(path: string, userId: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({ userId, ...extra })
  return `${path}?${params}`
}
