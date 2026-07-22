import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { backendBase, backendFetchAuthed } from "@/lib/backend"
import { SESSION_COOKIE, sessionCookieOptions, signIdentity, verifyIdentity } from "@/lib/session"

// 마이페이지 역할 전환(회원↔코치). 백엔드가 신원에서 userId 도출·검증.
// 성공 시 세션 쿠키의 baked role을 갱신(sub·email·ev는 유지).
export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { role?: string }
  const role = body.role
  if (role !== "user" && role !== "coach") {
    return Response.json({ error: "역할이 올바르지 않습니다." }, { status: 400 })
  }

  const res = await backendFetchAuthed(`${backendBase}/mypage/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    role?: string
    detail?: string
    error?: string
  }
  if (!res.ok) {
    return Response.json({ error: data.detail || data.error || "역할 변경에 실패했습니다." }, { status: res.status })
  }

  const out = NextResponse.json(data)
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (token) {
    const claims = await verifyIdentity(token)
    if (claims?.sub) {
      const fresh = await signIdentity({
        sub: claims.sub,
        email: claims.email,
        ev: claims.ev,
        role: data.role ?? role,
      })
      out.cookies.set(SESSION_COOKIE, fresh, sessionCookieOptions())
    }
  }
  return out
}
