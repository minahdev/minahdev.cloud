"use client"

import { type FormEvent, useState } from "react"
import { CheckCircle2 } from "lucide-react"

import { getLoggedInUserId } from "@/lib/auth-session"

type State = "idle" | "submitting" | "done"

export default function InquiryPage() {
  const [state, setState] = useState<State>("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim()
    const body = (form.elements.namedItem("body") as HTMLTextAreaElement).value.trim()

    if (!title) { setError("제목을 입력해 주세요."); return }
    if (!body)  { setError("내용을 입력해 주세요."); return }

    setState("submitting")
    setError(null)

    // localStorage에 저장 (추후 백엔드 연동 가능)
    const inquiries = JSON.parse(localStorage.getItem("pace-inquiries") ?? "[]")
    inquiries.push({
      id: Date.now().toString(),
      userId: getLoggedInUserId() ?? "anonymous",
      title,
      body,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem("pace-inquiries", JSON.stringify(inquiries))

    await new Promise((r) => setTimeout(r, 600))
    setState("done")
  }

  if (state === "done") {
    return (
      <div className="pt-24 pb-16 md:pt-28">
        <div className="container mx-auto max-w-lg px-4">
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <CheckCircle2 className="h-14 w-14 text-primary" aria-hidden />
            <h2 className="text-xl font-bold text-foreground">문의가 접수되었습니다</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              빠른 시일 내에 답변 드리겠습니다.<br />
              불편을 드려 죄송합니다.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-24 pb-16 md:pt-28">
      <div className="container mx-auto max-w-lg px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">문의하기</h1>
          <p className="mt-1 text-sm text-muted-foreground">궁금한 점이나 불편한 사항을 남겨 주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inq-title" className="text-sm font-medium text-foreground">
              제목
            </label>
            <input
              id="inq-title"
              name="title"
              type="text"
              placeholder="문의 제목을 입력하세요"
              className="w-full rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="inq-body" className="text-sm font-medium text-foreground">
              내용
            </label>
            <textarea
              id="inq-body"
              name="body"
              rows={7}
              placeholder="문의 내용을 자세히 입력해 주세요."
              className="w-full resize-none rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none leading-relaxed"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={state === "submitting"}
            className="mt-2 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {state === "submitting" ? "제출 중…" : "문의 제출"}
          </button>
        </form>
      </div>
    </div>
  )
}
