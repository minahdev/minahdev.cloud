import { backendBase, backendFetch } from "@/lib/backend"

function errorFromFastAPI(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback
  const b = body as { error?: string; detail?: string }
  if (typeof b.error === "string" && b.error.trim()) return b.error
  if (typeof b.detail === "string") return b.detail
  return fallback
}

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId")?.trim()
  if (!userId) {
    return Response.json({ error: "아이디를 입력하세요." }, { status: 400 })
  }

  try {
    const res = await backendFetch(
      `${backendBase}/signup/check-userid?userId=${encodeURIComponent(userId)}`,
      { cache: "no-store" },
    )
    const data = await res.json()
    if (!res.ok) {
      return Response.json(
        { error: errorFromFastAPI(data, "아이디 확인에 실패했습니다.") },
        { status: res.status },
      )
    }
    return Response.json(data)
  } catch {
    return Response.json({ error: "백엔드에 연결할 수 없습니다." }, { status: 502 })
  }
}
