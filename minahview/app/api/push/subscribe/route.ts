import { backendBase, backendFetch } from "@/lib/backend"

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const res = await backendFetch(`${backendBase}/api/comm_agent/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })
    const data: unknown = await res.json().catch(() => ({}))
    return Response.json(data, { status: res.status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error"
    return Response.json({ error: `백엔드에 연결할 수 없습니다. (${msg})` }, { status: 503 })
  }
}
