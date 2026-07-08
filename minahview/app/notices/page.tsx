"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { ko } from "date-fns/locale"
import { ChevronDown, Megaphone, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getLoggedInUserId } from "@/lib/auth-session"
import { canManageNotices } from "@/lib/pace-admin"
import { addNotice, deleteNotice, loadNotices, type Notice } from "@/lib/pace-notices-storage"

type NoticeUi = {
  submitting: boolean
  error: string | null
  notices: Notice[] | null
}

function formatNoticeDate(iso: string) {
  try {
    return format(parseISO(iso), "yyyy.MM.dd.", { locale: ko })
  } catch {
    return iso
  }
}

export default function NoticesPage() {
  const [ui, setUi] = useState<NoticeUi>({
    submitting: false,
    error: null,
    notices: null,
  })
  const [formKey, setFormKey] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const refresh = () => {
    loadNotices()
      .then((notices) => setUi((prev) => ({ ...prev, notices })))
      .catch(() => setUi((prev) => ({ ...prev, notices: [] })))
    setIsAdmin(canManageNotices())
  }

  useEffect(() => {
    refresh()
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const authorId = getLoggedInUserId()
    if (!authorId || !canManageNotices()) {
      setUi((prev) => ({
        ...prev,
        error: "공지 등록은 관리자 계정으로 로그인한 뒤 이용할 수 있습니다.",
      }))
      return
    }

    setUi((prev) => ({ ...prev, submitting: true, error: null }))
    const formData = new FormData(e.currentTarget)
    const title = String(formData.get("title") ?? "").trim()
    const body = String(formData.get("body") ?? "").trim()

    if (!title) {
      setUi((prev) => ({
        ...prev,
        submitting: false,
        error: "제목을 입력해 주세요.",
      }))
      return
    }
    if (!body) {
      setUi((prev) => ({
        ...prev,
        submitting: false,
        error: "내용을 입력해 주세요.",
      }))
      return
    }

    try {
      await addNotice(authorId, title, body)
      refresh()
      setFormKey((k) => k + 1)
      setUi((prev) => ({ ...prev, submitting: false, error: null }))
    } catch {
      setUi((prev) => ({
        ...prev,
        submitting: false,
        error: "공지 등록에 실패했습니다.",
      }))
    }
  }

  const handleDelete = async (id: string) => {
    if (!canManageNotices()) return
    if (!window.confirm("이 공지를 삭제할까요?")) return
    try {
      await deleteNotice(id)
      refresh()
    } catch {
      setUi((prev) => ({ ...prev, error: "공지 삭제에 실패했습니다." }))
    }
  }

  return (
    <div className="pb-16 pt-28 md:pt-32">
      <div className="container mx-auto max-w-3xl px-6">
        <header className="mb-8">
          <p className="text-sm font-medium text-primary">Notices</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            공지사항
          </h1>
          <p className="mt-2 text-muted-foreground">
            Pace 앱 업데이트, 점검, 이벤트 안내를 확인하세요.
          </p>
        </header>

        {isAdmin ? (
          <Card className="mb-8 border-primary/30 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-4 w-4 text-primary" aria-hidden />
                관리자 — 공지 등록
              </CardTitle>
              <CardDescription>
                로그인 아이디 <span className="font-medium text-foreground">{getLoggedInUserId()}</span>
                으로 등록됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="notice-title">제목</Label>
                  <Input
                    id="notice-title"
                    name="title"
                    placeholder="예: 5월 서버 점검 안내"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notice-body">내용</Label>
                  <Textarea
                    id="notice-body"
                    name="body"
                    placeholder="공지 내용을 입력하세요."
                    rows={5}
                    className="resize-y leading-relaxed"
                    required
                  />
                </div>
                {ui.error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {ui.error}
                  </p>
                ) : null}
                <Button type="submit" disabled={ui.submitting}>
                  {ui.submitting ? "등록 중…" : "공지 등록"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8 border-border/80 bg-secondary/20">
            <CardContent className="py-4 text-sm text-muted-foreground">
              공지 등록은 관리자 전용입니다. 회원가입에서{" "}
              <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
                관리자 가입
              </Link>
              후 로그인해 주세요.
            </CardContent>
          </Card>
        )}

        <h2 className="mb-4 text-lg font-semibold text-foreground">전체 공지</h2>

        {ui.notices === null ? (
          <div className="divide-y divide-border/60">
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-5">
                <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-secondary/60" aria-hidden />
                <div className="h-3 w-20 animate-pulse rounded bg-secondary/40" aria-hidden />
              </div>
            ))}
          </div>
        ) : ui.notices.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            등록된 공지가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {ui.notices.map((notice) => {
              const expanded = expandedId === notice.id
              return (
                <li key={notice.id}>
                  <button
                    type="button"
                    className="w-full py-5 text-left"
                    onClick={() => setExpandedId(expanded ? null : notice.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-base font-semibold leading-snug text-foreground">
                        {notice.title}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        {isAdmin ? (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="공지 삭제"
                            className="rounded p-1 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDelete(notice.id) }}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handleDelete(notice.id) } }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </span>
                        ) : null}
                        <ChevronDown
                          className={cn("h-4 w-4 text-muted-foreground/60 transition-transform", expanded && "rotate-180")}
                          aria-hidden
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-primary/80">{formatNoticeDate(notice.createdAt)}</p>
                  </button>
                  {expanded && (
                    <div className="pb-5">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {notice.body}
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
