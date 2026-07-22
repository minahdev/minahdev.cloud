import { NextResponse, type NextRequest } from "next/server"

import { SESSION_COOKIE, verifyIdentity } from "@/lib/session"

// 보호 라우트: 유효한 서명 세션 쿠키가 없으면 /login으로. /admin은 role=admin만.
// (백엔드가 매 요청 role을 재계산하므로 여기 role은 라우팅 1차 게이트일 뿐이다.)
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const claims = token ? await verifyIdentity(token) : null

  if (!claims?.sub) {
    const url = new URL("/login", req.url)
    url.searchParams.set("from", pathname)
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith("/admin") && claims.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/mypage/:path*", "/schedule/:path*", "/settings/:path*", "/admin/:path*"],
}
