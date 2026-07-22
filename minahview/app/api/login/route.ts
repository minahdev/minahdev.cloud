import { NextResponse } from "next/server"

import { backendBase, backendFetch } from "@/lib/backend"
import { SESSION_COOKIE, sessionCookieOptions, signIdentity } from "@/lib/session"

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
  let body: { userId?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const userId = body.userId?.trim()
  const password = body.password ?? ""
  if (!userId || !password) {
    return Response.json({ error: "아이디와 비밀번호가 필요합니다." }, { status: 400 })
  }

  try {
    const res = await backendFetch(`${backendBase}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password }),
    })
    const data = (await res.json().catch(() => ({}))) as { userId?: string; role?: string }
    if (!res.ok) {
      return Response.json(
        { error: errorFromFastAPI(data, "로그인에 실패했습니다.") },
        { status: res.status },
      )
    }
    // 비밀번호 로그인 → 이메일 미검증(ev:false). role은 백엔드가 재계산하므로 여기 값은 힌트용.
    // 신원 토큰을 서명해 httpOnly 세션 쿠키로 발급.
    const token = await signIdentity({ sub: data.userId ?? userId, ev: false, role: data.role ?? "user" })
    const out = NextResponse.json(data)
    out.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
    return out
  } catch (e) {
    console.error("[login]", e)
    return Response.json({ error: "백엔드에 연결할 수 없습니다." }, { status: 503 })
  }
}
