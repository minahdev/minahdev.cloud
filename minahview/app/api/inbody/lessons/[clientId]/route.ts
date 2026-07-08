import { backendBase, backendFetch } from "@/lib/backend"

function err(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback
  const d = data as { detail?: string; error?: string }
  return d.detail || d.error || fallback
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await ctx.params
  const params = new URL(req.url).searchParams
  const userId = params.get("userId")?.trim()
  if (!userId) return Response.json({ error: "userId가 필요합니다." }, { status: 400 })
  const q = new URLSearchParams({ userId })
  const memberUserId = params.get("memberUserId")
  if (memberUserId) q.set("memberUserId", memberUserId)
  const res = await backendFetch(
    `${backendBase}/inbody/lessons/${encodeURIComponent(clientId)}?${q}`,
    { method: "DELETE" },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return Response.json({ error: err(data, "삭제 실패") }, { status: res.status })
  return Response.json(data)
}
