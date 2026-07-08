import { backendBase, backendFetch } from "@/lib/backend"

type SignupBody = {
  userId?: string
  password?: string
  email?: string
  nickname?: string
  role?: "user" | "admin" | "coach"
}

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

export async function POST(req: Request) {
  let body: SignupBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const userId = body.userId?.trim()
  const password = body.password ?? ""
  const email = body.email?.trim()
  const nickname = body.nickname?.trim()

  if (!userId || !password || !email || !nickname) {
    return Response.json({ error: "아이디, 비밀번호, 이메일, 닉네임을 모두 입력하세요." }, { status: 400 })
  }

  try {
    const res = await backendFetch(`${backendBase}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        password,
        email,
        nickname,
        role:
          body.role === "admin" ? "admin" : body.role === "coach" ? "coach" : "user",
      }),
    })

    const data: unknown = await res.json().catch(() => ({}))

    if (!res.ok) {
      return Response.json(
        { error: errorFromFastAPI(data, "회원가입에 실패했습니다.") },
        { status: res.status },
      )
    }

    return Response.json(data)
  } catch (e) {
    console.error("[signup proxy]", e)
    return Response.json(
      {
        error: "백엔드에 연결할 수 없습니다. FastAPI(uvicorn)가 실행 중인지 확인하세요.",
      },
      { status: 503 },
    )
  }
}
