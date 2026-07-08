import { backendBase, backendFetch } from "@/lib/backend"

type RouteCtx = { params: Promise<{ path: string[] }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const { path } = await ctx.params
  const joined = path.map((p) => encodeURIComponent(p)).join("/")
  const res = await backendFetch(`${backendBase}/uploads/${joined}`, { cache: "no-store" })
  if (!res.ok) {
    return new Response("Not found", { status: res.status })
  }
  const blob = await res.blob()
  const contentType = res.headers.get("content-type") ?? "application/octet-stream"
  return new Response(blob, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  })
}
