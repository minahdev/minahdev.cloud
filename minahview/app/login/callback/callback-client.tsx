"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { normalizeUserRole, setLoggedInUser } from "@/lib/auth-session"

export function CallbackClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const error = searchParams.get("error")
    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`)
      return
    }

    const userId = (searchParams.get("userId") ?? "").trim()
    if (!userId) {
      router.replace("/login?error=oauth_failed")
      return
    }

    setLoggedInUser(userId, normalizeUserRole(searchParams.get("role")))
    router.replace("/mypage")
  }, [router, searchParams])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">로그인 처리 중…</p>
    </div>
  )
}
