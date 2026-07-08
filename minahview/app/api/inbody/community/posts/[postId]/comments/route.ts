import { backendBase, backendFetch } from "@/lib/backend"

function err(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback
  const d = data as { detail?: string; error?: string }
  return d.detail || d.error || fallback
}

type RouteCtx = { params: Promise<{ postId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const { postId } = await ctx.params
  const res = await backendFetch(`${backendBase}/inbody/community/posts/${postId}/comments`, {
    cache: "no-store",
  })
  const data = await res.json().catch(() => [])
  if (!res.ok) return Response.json({ error: err(data, "댓글 조회 실패") }, { status: res.status })
  return Response.json(data)
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { postId } = await ctx.params
  const body = await req.json()
  const res = await backendFetch(`${backendBase}/inbody/community/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return Response.json({ error: err(data, "댓글 등록 실패") }, { status: res.status })
  return Response.json(data)
}
