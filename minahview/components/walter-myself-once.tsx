"use client"

import { useEffect, useRef } from "react"

const STORAGE_KEY = "pace:walter-myself-called"

/** React Strict Mode remount 대비 (모듈 스코프) */
let walterMyselfInFlight = false

function walterMyselfUrl(): string {
  const base = (
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000"
  ).replace(/\/$/, "")
  return `${base}/walter/myself`
}

/** 승객 목록 등에서 월터 /myself API를 브라우저 세션당 1회만 호출 */
export function WalterMyselfOnce() {
  const started = useRef(false)

  useEffect(() => {
    if (started.current || walterMyselfInFlight) return
    if (typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1") {
      return
    }

    started.current = true
    walterMyselfInFlight = true

    fetch(walterMyselfUrl(), { method: "GET" })
      .then(() => {
        sessionStorage.setItem(STORAGE_KEY, "1")
      })
      .catch(() => {
        started.current = false
        walterMyselfInFlight = false
      })
  }, [])

  return null
}
