import { backendBase, backendFetch } from "@/lib/backend"

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId")?.trim()
  if (!userId) {
    return Response.json({ error: "userId가 필요합니다." }, { status: 400 })
  }

  try {
    const res = await backendFetch(
      `${backendBase}/schedule/access/admitted?${new URLSearchParams({ userId })}`,
      { cache: "no-store" },
    )
    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err =
        typeof data === "object" && data && "detail" in data && typeof (data as { detail: string }).detail === "string"
          ? (data as { detail: string }).detail
          : "입장 여부를 확인하지 못했습니다."
      return Response.json({ error: err }, { status: res.status })
    }
    return Response.json(data)
  } catch (e) {
    console.error("[schedule access admitted]", e)
    return Response.json({ error: "백엔드에 연결할 수 없습니다." }, { status: 503 })
  }
}
