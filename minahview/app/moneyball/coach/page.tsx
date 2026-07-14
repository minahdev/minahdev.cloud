"use client"

import { useState, useRef, useEffect } from "react"
import { Send } from "lucide-react"

type Message = {
  role: "user" | "assistant"
  content: string
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "안녕하세요! 저는 머니볼 코치예요. 축구 전술·포메이션·선수와 구단 분석, 무엇이든 물어보세요. ⚽",
}

const SUGGESTIONS = [
  "4-3-3 포메이션의 장점이 뭐야?",
  "빌드업 축구란 무엇인가요?",
  "수비형 미드필더의 역할을 알려줘",
]

export default function SoccerCoachPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const send = async (text?: string) => {
    const value = (text ?? input).trim()
    if (!value || loading) return

    const userMsg: Message = { role: "user", content: value }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/moneyball/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "응답을 받지 못했습니다." },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "오류가 발생했습니다. 다시 시도해 주세요." },
      ])
    } finally {
      setLoading(false)
    }
  }

  const showSuggestions = messages.length === 1 && !loading

  return (
    <div className="flex justify-center px-4 pt-20 pb-4 md:pt-24" style={{ height: "78dvh" }}>
      <div className="flex w-full max-w-lg flex-col overflow-hidden">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-lg">
            ⚽
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Moneyball · exaone
            </p>
            <h1 className="text-lg font-bold leading-tight text-foreground">머니볼 코치</h1>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px]">
                  ⚽
                </div>
              )}
              <div
                className={`max-w-[75%] whitespace-pre-wrap rounded-xl px-3 py-1.5 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px]">
                ⚽
              </div>
              <div className="rounded-xl bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
                입력 중...
              </div>
            </div>
          )}
          {showSuggestions && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="mt-2 flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="축구에 대해 물어보세요..."
            className="flex-1 rounded-full border border-border bg-secondary/40 px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background"
            disabled={loading}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
