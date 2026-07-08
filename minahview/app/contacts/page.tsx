"use client"

import { useCallback, useEffect, useState } from "react"
import { Mail, RefreshCw } from "lucide-react"

import { ContactsCsvUpload } from "@/components/contacts-csv-upload"

type Contact = { id: number; nickname: string; email: string }

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadContacts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/contacts", { cache: "no-store" })
      const data: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: string }).error)
            : "주소록을 불러오지 못했습니다.",
        )
        return
      }
      setContacts(Array.isArray(data) ? (data as Contact[]) : [])
    } catch {
      setError("주소록을 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadContacts()
  }, [loadContacts])

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-16 pt-28 md:pt-32">
      <div className="container mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-6">
        <header className="mb-6 shrink-0 text-center md:text-left">
          <p className="text-sm font-medium text-primary">Comm Agent</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            주소록
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            CSV(구글 주소록 내보내기 포함)를 업로드하면, 이메일 발송 화면에서 이름·성으로 검색해 받는 사람을 고를 수 있어요.
          </p>
        </header>

        {/* 업로드 */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-foreground">주소록 업로드</h2>
          <ContactsCsvUpload onUploaded={() => loadContacts()} />
        </section>

        {/* 목록 */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">
              등록된 주소록 {contacts.length > 0 ? `(${contacts.length})` : ""}
            </h2>
            <button
              type="button"
              onClick={loadContacts}
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
          ) : contacts.length === 0 ? (
            <p className="rounded-xl border border-border bg-secondary/30 px-3 py-6 text-center text-sm text-muted-foreground">
              등록된 주소록이 없습니다. 위에서 CSV를 업로드하세요.
            </p>
          ) : (
            <ul className="space-y-1 overflow-y-auto rounded-xl border border-border bg-secondary/20 p-1">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                >
                  <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {c.nickname || "(이름 없음)"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
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
