import { cookies } from "next/headers"

import { backendBase, backendFetch } from "@/lib/backend"
import { SESSION_COOKIE } from "@/lib/session"

// UI role의 SSOT. 세션 쿠키 → 백엔드 /auth/me 프록시 (백엔드가 role 재계산).
export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) {
    return Response.json({ error: "unauthenticated" }, { status: 401 })
  }
  try {
    const res = await backendFetch(`${backendBase}/auth/me`, {
      headers: { "X-Pace-Identity": token },
      cache: "no-store",
    })
    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      return Response.json({ error: "unauthenticated" }, { status: res.status })
    }
    return Response.json(data)
  } catch {
    return Response.json({ error: "백엔드에 연결할 수 없습니다." }, { status: 503 })
  }
}
