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

export async function PUT(req: Request) {
  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const password = body.password ?? ""
  if (!password.trim()) {
    return Response.json({ error: "접근 암호를 입력하세요." }, { status: 400 })
  }

  try {
    const res = await backendFetchAuthed(`${backendBase}/schedule/access/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      return Response.json(
        { error: errorFromFastAPI(data, "접근 암호 설정에 실패했습니다.") },
        { status: res.status },
      )
    }
    return Response.json(data)
  } catch (e) {
    console.error("[schedule access password]", e)
    return Response.json({ error: "백엔드에 연결할 수 없습니다." }, { status: 503 })
  }
}
