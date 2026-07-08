import { backendBase, backendFetch } from "@/lib/backend"

export async function GET() {
  try {
    const res = await backendFetch(`${backendBase}/api/comm_agent/contacts`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    })

    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err =
        data && typeof data === "object" && "detail" in data
          ? String((data as { detail?: string }).detail ?? "주소록을 불러오지 못했습니다.")
          : "주소록을 불러오지 못했습니다."
      return Response.json({ error: err }, { status: res.status })
    }

    return Response.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error"
    return Response.json({ error: `백엔드에 연결할 수 없습니다. (${msg})` }, { status: 503 })
  }
}
