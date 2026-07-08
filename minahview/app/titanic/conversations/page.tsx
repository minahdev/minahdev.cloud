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
    "안녕하시오. 나는 타이타닉호의 선장 에드워드 존 스미스요. 타이타닉에 관해 궁금한 것이 있으면 무엇이든 물어보시오.",
}

export default function SmithConversationPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: "user", content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/titanic/smith/chat", {
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

  return (
    <div className="flex justify-center px-4 pt-20 pb-4 md:pt-24" style={{ height: "65dvh" }}>
      <div className="flex w-full max-w-lg flex-col overflow-hidden">
        <div className="mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Lesson</p>
          <h1 className="mt-1 text-lg font-bold text-foreground">스미스 선장과 대화</h1>
        </div>

        <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-3 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary">
                  선장
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-xl px-3 py-1.5 text-xs leading-relaxed ${
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
              <div className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary">
                선장
              </div>
              <div className="rounded-xl bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
                입력 중...
              </div>
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
            placeholder="메시지를 입력하세요..."
            className="flex-1 rounded-full border border-border bg-secondary/40 px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background"
            disabled={loading}
          />
          <button
            onClick={send}
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
