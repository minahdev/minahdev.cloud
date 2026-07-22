import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE, sessionCookieOptions, verifyIdentity } from "@/lib/session"

// 소셜 로그인 콜백 핸드오프: 백엔드가 서명 신원 토큰을 ?token=로 전달 →
// httpOnly `pace_session` 쿠키로 굳히고 /mypage로 이동. 토큰은 URL에 남지 않게 즉시 소비.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? ""
  const claims = token ? await verifyIdentity(token) : null
  if (!claims?.sub) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url))
  }
  const res = NextResponse.redirect(new URL("/mypage", req.url))
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
  res.headers.set("Referrer-Policy", "no-referrer")
  return res
}
