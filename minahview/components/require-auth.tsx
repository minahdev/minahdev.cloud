"use client"

import { useRouter } from "next/navigation"
import { type ReactNode, useEffect, useState } from "react"

import { getLoggedInUserId } from "@/lib/auth-session"

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
    const checkAuth = () => {
      const userId = getLoggedInUserId()
      if (!userId) {
        const params = new URLSearchParams({ from: loginRedirect })
        router.replace(`/login?${params.toString()}`)
        setAllowed(false)
        return
      }
      setAllowed(true)
    }

    checkAuth()
    window.addEventListener(AUTH_SESSION_EVENT, checkAuth)
    return () => window.removeEventListener(AUTH_SESSION_EVENT, checkAuth)
  }, [router, loginRedirect])

  if (!allowed) {
    return <div className="min-h-[20rem] animate-pulse rounded-2xl bg-secondary/30" aria-hidden />
  }

  return <>{children}</>
}
