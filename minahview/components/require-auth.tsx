"use client"

import { useRouter } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"

import { getLoggedInUserId, hydrateSessionFromServer } from "@/lib/auth-session"

/** `auth-session.ts`의 AUTH_SESSION_EVENT와 동일한 값 */
const AUTH_SESSION_EVENT = "pace-auth-change"

type RequireAuthProps = {
  children: ReactNode
  loginRedirect?: string
}

export function RequireAuth({ children, loginRedirect = "/mypage" }: RequireAuthProps) {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const decide = async () => {
      if (getLoggedInUserId()) {
        if (!cancelled) setAllowed(true)
        return
      }
      // 로컬 캐시가 비어있어도 세션 쿠키가 있으면 로그인 상태 → 서버 확인 후 재판정.
      await hydrateSessionFromServer()
      if (cancelled) return
      if (getLoggedInUserId()) {
        setAllowed(true)
        return
      }
      setAllowed(false)
      router.replace(`/login?${new URLSearchParams({ from: loginRedirect })}`)
    }

    void decide()
    window.addEventListener(AUTH_SESSION_EVENT, decide)
    return () => {
      cancelled = true
      window.removeEventListener(AUTH_SESSION_EVENT, decide)
    }
  }, [router, loginRedirect])

  if (!allowed) {
    return <div className="min-h-[20rem] animate-pulse rounded-2xl bg-secondary/30" aria-hidden />
  }

  return <>{children}</>
}
