import { backendBase, backendFetch } from "@/lib/backend"

function err(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback
  const d = data as { detail?: string; error?: string }
  return d.detail || d.error || fallback
}

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId")
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : ""
  const res = await backendFetch(`${backendBase}/inbody/community/posts${qs}`, { cache: "no-store" })
  const data = await res.json().catch(() => [])
  if (!res.ok) return Response.json({ error: err(data, "조회 실패") }, { status: res.status })
  return Response.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const res = await backendFetch(`${backendBase}/inbody/community/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return Response.json({ error: err(data, "등록 실패") }, { status: res.status })
  return Response.json(data)
}
