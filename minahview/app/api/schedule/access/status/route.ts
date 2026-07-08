import { backendBase, backendFetch } from "@/lib/backend"

export async function GET() {
  try {
    const res = await backendFetch(`${backendBase}/schedule/access/status`, { cache: "no-store" })
    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err =
        typeof data === "object" && data && "detail" in data && typeof (data as { detail: string }).detail === "string"
          ? (data as { detail: string }).detail
          : "접근 설정을 불러오지 못했습니다."
      return Response.json({ error: err }, { status: res.status })
    }
    return Response.json(data)
  } catch (e) {
    console.error("[schedule access status]", e)
    return Response.json({ error: "백엔드에 연결할 수 없습니다." }, { status: 503 })
  }
}
