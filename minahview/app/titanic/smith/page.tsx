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

export default function SmithChatPage() {
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
    <div className="flex flex-col px-6 pt-24 pb-6 md:pt-28" style={{ height: "100dvh" }}>
      <div className="container mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Lesson</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">스미스 선장과 대화</h1>
          <p className="mt-1 text-sm text-muted-foreground">타이타닉 선장 Edward John Smith와 채팅하세요.</p>
        </div>

        <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                  선장
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
              <div className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                선장
              </div>
              <div className="rounded-2xl bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
                입력 중...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="메시지를 입력하세요..."
            className="flex-1 rounded-full border border-border bg-secondary/40 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background"
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
