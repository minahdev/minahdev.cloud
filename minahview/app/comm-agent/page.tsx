"use client"

import { type FormEvent, useRef, useState } from "react"
import { Mail, Send, Sparkles } from "lucide-react"

type Contact = { id: number; nickname: string; email: string }

const inputClass =
  "w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"

type SendResult = {
  success: boolean
  to: string
  subject: string
  message: string
}

const EMAIL_TYPES = [
  { value: "general", label: "일반" },
  { value: "notice", label: "안내" },
  { value: "meeting", label: "회의 안내" },
  { value: "apology", label: "사과" },
  { value: "promotion", label: "홍보" },
] as const

export default function CommAgentPage() {
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [senderName, setSenderName] = useState("")
  const [topic, setTopic] = useState("")
  const [emailType, setEmailType] = useState("general")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)
  const [suggestions, setSuggestions] = useState<Contact[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onEmailChange(value: string) {
    setEmail(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = value.trim()
    // 이미 이메일을 입력 중(@ 포함)이면 검색 안 함
    if (!q || q.includes("@")) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        })
        const data: unknown = await res.json().catch(() => [])
        const list = Array.isArray(data) ? (data as Contact[]) : []
        setSuggestions(list)
        setShowSuggestions(list.length > 0)
      } catch {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }, 200)
  }

  function pickContact(c: Contact) {
    setEmail(c.email)
    setSuggestions([])
    setShowSuggestions(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)

    const trimmedEmail = email.trim()
    const trimmedTopic = topic.trim()
    const trimmedSubject = subject.trim()
    if (!trimmedEmail || !trimmedTopic) {
      setError("이메일과 주제를 모두 입력하세요.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/comm-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          subject: trimmedSubject,
          sender_name: senderName.trim(),
          topic: trimmedTopic,
          email_type: emailType,
        }),
      })
      const data: unknown = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: string }).error)
            : "메일 발송에 실패했습니다."
        setError(msg)
        return
      }

      setResult(data as SendResult)
      setTopic("")
      setSubject("")
    } catch {
      setError("요청 중 오류가 발생했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-16 pt-28 md:pt-32">
      <div className="container mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-6">
        <header className="mb-6 shrink-0 text-center md:text-left">
          <p className="text-sm font-medium text-primary">Comm Agent</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            AI 이메일 발송
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            받는 사람과 주제만 입력하면 AI가 본문을 작성해 메일을 보냅니다.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              받는 사람 이메일
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                id="email"
                type="text"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true)
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="이름·성을 입력하거나 이메일을 직접 입력"
                className={`${inputClass} pl-9`}
                autoComplete="off"
              />
              {showSuggestions ? (
                <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-popover py-1 shadow-lg">
                  {suggestions.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          pickContact(c)
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary/60"
                      >
                        <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {c.nickname || "(이름 없음)"}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {c.email}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="email_type" className="text-sm font-medium text-foreground">
              메일 유형
            </label>
            <select
              id="email_type"
              value={emailType}
              onChange={(e) => setEmailType(e.target.value)}
              className={inputClass}
            >
              {EMAIL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="subject" className="text-sm font-medium text-foreground">
              제목
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="메일 제목 (예: 팀 회식 안내드립니다)"
              className={inputClass}
              maxLength={200}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="sender_name" className="text-sm font-medium text-foreground">
              보내는 사람 이름 <span className="font-normal text-muted-foreground">(서명에 사용)</span>
            </label>
            <input
              id="sender_name"
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="예: 김민아"
              className={inputClass}
              maxLength={100}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="topic" className="text-sm font-medium text-foreground">
              주제 <span className="font-normal text-muted-foreground">(본문 생성용 · 발송되지 않음)</span>
            </label>
            <textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="AI가 본문을 쓰는 데 참고할 내용 (예: 다음 주 팀 회식 안내)"
              rows={4}
              className={`${inputClass} resize-none`}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          {result ? (
            <div className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm">
              <p className="font-medium text-foreground">{result.message}</p>
              <p className="mt-1 text-muted-foreground">
                받는 사람: {result.to}
              </p>
              <p className="text-muted-foreground">제목: {result.subject}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="size-4" aria-hidden />
            {submitting ? "발송 중…" : "AI로 작성해서 발송"}
          </button>
        </form>

        <p className="mt-4 shrink-0 text-center text-xs text-muted-foreground md:text-left">
          <Sparkles className="mr-1 inline size-3.5 text-primary" aria-hidden />
          본문은 AI가 자동 생성하며, 발송 전 검토할 수 없습니다.
        </p>
      </div>
    </div>
  )
}
