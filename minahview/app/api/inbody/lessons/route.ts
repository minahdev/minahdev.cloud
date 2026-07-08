import { backendBase, backendFetch } from "@/lib/backend"

function err(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback
  const d = data as { detail?: string; error?: string }
  return d.detail || d.error || fallback
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const userId = params.get("userId")?.trim()
  if (!userId) return Response.json({ error: "userId가 필요합니다." }, { status: 400 })
  const q = new URLSearchParams({ userId })
  const memberUserId = params.get("memberUserId")
  if (memberUserId) q.set("memberUserId", memberUserId)
  const res = await backendFetch(`${backendBase}/inbody/lessons?${q}`, { cache: "no-store" })
  const data = await res.json().catch(() => [])
  if (!res.ok) return Response.json({ error: err(data, "조회 실패") }, { status: res.status })
  return Response.json(data)
}

export async function PUT(req: Request) {
  const body = await req.json()
  const res = await backendFetch(`${backendBase}/inbody/lessons`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return Response.json({ error: err(data, "저장 실패") }, { status: res.status })
  return Response.json(data)
}
