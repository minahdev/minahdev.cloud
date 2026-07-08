"use client"

import { useEffect, useState } from "react"
import { Bell, BellRing } from "lucide-react"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function PushNotificationsButton() {
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    setSupported(ok)
    if (!ok) return
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {})
  }, [])

  async function enable() {
    setBusy(true)
    setMsg(null)
    try {
      const reg = await navigator.serviceWorker.register("/sw.js")

      const perm = await Notification.requestPermission()
      if (perm !== "granted") {
        setMsg("알림 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요.")
        return
      }

      const keyRes = await fetch("/api/push/vapid", { cache: "no-store" })
      const keyData: unknown = await keyRes.json().catch(() => ({}))
      const publicKey =
        keyData && typeof keyData === "object" && "public_key" in keyData
          ? String((keyData as { public_key?: string }).public_key ?? "")
          : ""
      if (!publicKey) {
        setMsg("서버에 VAPID 공개키가 없습니다.")
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      })
      if (!res.ok) {
        setMsg("구독 저장에 실패했어요.")
        return
      }

      setSubscribed(true)
      setMsg("알림이 켜졌어요! 새 메일이 오면 알려드릴게요.")
    } catch {
      setMsg("알림 설정 중 오류가 발생했어요.")
    } finally {
      setBusy(false)
    }
  }

  if (!supported) return null

  return (
    <div className="mb-4 flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={enable}
        disabled={busy || subscribed}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60 disabled:opacity-60"
      >
        {subscribed ? (
          <>
            <BellRing className="size-4 text-primary" aria-hidden />
            알림 켜짐
          </>
        ) : (
          <>
            <Bell className="size-4" aria-hidden />
            {busy ? "설정 중…" : "알림 켜기"}
          </>
        )}
      </button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  )
}
