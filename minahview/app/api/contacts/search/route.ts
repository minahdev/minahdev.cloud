import { backendBase, backendFetch } from "@/lib/backend"

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? ""
  if (!q) return Response.json([])

  try {
    const res = await backendFetch(
      `${backendBase}/api/comm_agent/contacts/search?q=${encodeURIComponent(q)}`,
      { method: "GET", headers: { accept: "application/json" }, cache: "no-store" },
    )
    const data: unknown = await res.json().catch(() => [])
    if (!res.ok) return Response.json([], { status: res.status })
    return Response.json(data)
  } catch {
    return Response.json([], { status: 503 })
  }
}
