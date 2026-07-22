"use client"

import { useEffect } from "react"

import { hydrateSessionFromServer } from "@/lib/auth-session"

/** 앱 로드 시 httpOnly 세션 쿠키(`/api/auth/me`)를 localStorage 캐시로 1회 동기화. */
export function SessionHydrator() {
  useEffect(() => {
    void hydrateSessionFromServer()
  }, [])
  return null
}
