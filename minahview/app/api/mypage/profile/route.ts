import { backendBase, backendFetchAuthed } from "@/lib/backend"

function err(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback
  const d = data as { detail?: string; error?: string }
  return d.detail || d.error || fallback
}

export async function GET() {
  const res = await backendFetchAuthed(`${backendBase}/mypage/profile`, { cache: "no-store" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return Response.json({ error: err(data, "조회 실패") }, { status: res.status })
  return Response.json(data)
}

export async function PUT(req: Request) {
  const body = await req.json()
  const res = await backendFetchAuthed(`${backendBase}/mypage/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return Response.json({ error: err(data, "저장 실패") }, { status: res.status })
  return Response.json(data)
}
