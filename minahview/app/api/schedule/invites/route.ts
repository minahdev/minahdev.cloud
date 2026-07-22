import { backendBase, backendFetchAuthed } from "@/lib/backend"

function errorFromFastAPI(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback
  const b = body as { error?: string; detail?: string | { msg?: string }[] }
  if (typeof b.error === "string" && b.error.trim()) return b.error
  if (typeof b.detail === "string") return b.detail
  if (Array.isArray(b.detail)) {
    return b.detail.map((d) => d?.msg ?? "").filter(Boolean).join(", ") || fallback
  }
  return fallback
}

export async function POST() {
  try {
    const res = await backendFetchAuthed(`${backendBase}/schedule/invites`, { method: "POST" })
    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      return Response.json(
        { error: errorFromFastAPI(data, "입장 코드 발급에 실패했습니다.") },
        { status: res.status },
      )
    }
    return Response.json(data)
  } catch (e) {
    console.error("[schedule invites create]", e)
    return Response.json({ error: "백엔드에 연결할 수 없습니다." }, { status: 503 })
  }
}
