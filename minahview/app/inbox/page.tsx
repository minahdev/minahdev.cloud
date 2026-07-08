"use client"

import { useCallback, useEffect, useState } from "react"
import { Mail, RefreshCw } from "lucide-react"

import { PushNotificationsButton } from "@/components/push-notifications-button"

type ReceivedMail = {
  id: number
  sender: string
  subject: string
  body: string
  received_at: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function InboxPage() {
  const [mails, setMails] = useState<ReceivedMail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMails = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/inbox", { cache: "no-store" })
      const data: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: string }).error)
            : "수신함을 불러오지 못했습니다.",
        )
        return
      }
      setMails(Array.isArray(data) ? (data as ReceivedMail[]) : [])
    } catch {
      setError("수신함을 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMails()
  }, [loadMails])

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-16 pt-28 md:pt-32">
      <div className="container mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-6">
        <header className="mb-6 shrink-0 text-center md:text-left">
          <p className="text-sm font-medium text-primary">Comm Agent</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            메일 수신함
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Gmail로 새로 받은 메일이 여기에 표시됩니다.
          </p>
        </header>

        <PushNotificationsButton />

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">
              받은 메일 {mails.length > 0 ? `(${mails.length})` : ""}
            </h2>
            <button
              type="button"
              onClick={loadMails}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              새로고침
            </button>
          </div>

          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>
          ) : error ? (
            <p className="px-3 py-6 text-center text-sm text-destructive">{error}</p>
          ) : mails.length === 0 ? (
            <p className="rounded-xl border border-border bg-secondary/30 px-3 py-6 text-center text-sm text-muted-foreground">
              받은 메일이 없습니다.
            </p>
          ) : (
            <ul className="space-y-1 overflow-y-auto rounded-xl border border-border bg-secondary/20 p-1">
              {mails.map((m) => (
                <li key={m.id} className="flex gap-3 rounded-lg px-3 py-2.5">
                  <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {m.subject || "(제목 없음)"}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(m.received_at)}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{m.sender}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground/80">
                      {m.body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
