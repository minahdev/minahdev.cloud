import { NextResponse } from "next/server"

import { SESSION_COOKIE } from "@/lib/session"

// 로그아웃 — httpOnly 세션 쿠키 삭제.
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 })
  return res
}
