import { backendBase, backendFetch } from "@/lib/backend"

export async function GET() {
  try {
    const res = await backendFetch(`${backendBase}/api/comm_agent/push/vapid-public-key`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    })
    const data: unknown = await res.json().catch(() => ({}))
    return Response.json(data, { status: res.status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error"
    return Response.json({ error: `백엔드에 연결할 수 없습니다. (${msg})` }, { status: 503 })
  }
}
