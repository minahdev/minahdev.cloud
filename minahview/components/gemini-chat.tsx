"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { Loader2, SendHorizonal, Sparkles } from "lucide-react"

import { ChatMessageContent } from "@/components/chat-message-content"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Role = "user" | "model"

type Msg = { role: Role; text: string }

function formatChatError(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes("api_key_invalid") ||
    lower.includes("api key expired") ||
    lower.includes("gemini_api_key")
  ) {
    return (
      "Gemini API 키가 만료되었거나 잘못되었습니다. " +
      "https://aistudio.google.com/apikey 에서 새 키를 발급한 뒤 " +
      "frontend/.env.local 또는 Vercel GEMINI_API_KEY 를 갱신하고 재배포하세요."
    )
  }
  return message
}

type GeminiChatProps = {
  className?: string
  /** true면 부모 flex 영역을 채움 (Pace AI 탭 등) */
  fillHeight?: boolean
  /** 헤더 제목 (기본: Gemini) */
  title?: string
  /** 헤더 부제 */
  subtitle?: string
  placeholder?: string
  emptyMessage?: string
}

export function GeminiChat({
  className,
  fillHeight = false,
  title = "Gemini",
  subtitle = "· Pace 홈에서 바로 질문해 보세요",
  placeholder = "메시지를 입력하세요…",
  emptyMessage = "헬스케어·데이터·개발 관련해서 무엇이든 물어보세요.",
}: GeminiChatProps) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    setError(null)
    setInput("")
    const next: Msg[] = [...messages, { role: "user", text }]
    setMessages(next)
    setLoading(true)

    try {
      const res = await fetch("/api/chat/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      })
      const data = (await res.json()) as {
        text?: string
        error?: string
        detail?: string | { msg?: string }[]
      }
      if (!res.ok) {
        let message = data.error
        if (!message && typeof data.detail === "string") message = data.detail
        if (!message && Array.isArray(data.detail)) {
          message = data.detail.map((d) => d?.msg ?? "").filter(Boolean).join(", ")
        }
        setError(formatChatError(message ?? "요청에 실패했습니다."))
        return
      }
      if (!data.text) {
        setError("응답이 비어 있습니다.")
        return
      }
      const reply = data.text
      setMessages((m) => [...m, { role: "model", text: reply }])
    } catch {
      setError("네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send()
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card/60 shadow-sm backdrop-blur-sm",
        fillHeight
          ? "min-h-0 flex-1"
          : "h-[min(26rem,50vh)] max-h-[min(26rem,50vh)] min-h-[15rem] sm:min-h-[17rem] lg:h-[min(22rem,42vh)] lg:max-h-[min(22rem,42vh)]",
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-border/60 px-4 py-3 text-center">
        <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="text-sm font-medium text-foreground">{title}</span>
        {subtitle ? (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3 [scrollbar-color:oklch(0.35_0_0)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
      >
        {messages.length === 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {emptyMessage}
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "break-words rounded-xl px-3 py-2.5 text-xs sm:text-sm",
              m.role === "user"
                ? "ml-auto max-w-[92%] whitespace-pre-wrap bg-primary/15 text-foreground leading-relaxed"
                : "mr-auto max-w-full border border-border/60 bg-secondary/80 text-foreground",
            )}
          >
            {m.role === "model" ? (
              <ChatMessageContent text={m.text} />
            ) : (
              m.text
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            응답 작성 중…
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <form onSubmit={onSubmit} className="shrink-0 border-t border-border/60 p-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            rows={2}
            disabled={loading}
            className="min-h-[60px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />

          <Button type="submit" disabled={loading || !input.trim()} className="shrink-0 self-end" size="icon">
            <SendHorizonal className="size-4" />
            <span className="sr-only">보내기</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
