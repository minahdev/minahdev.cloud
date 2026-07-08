"use client"

import { FormEvent, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  addCommunityComment,
  loadCommunityComments,
  type CommunityComment,
  type CommunityPost,
} from "@/lib/pace-community-storage"

type Props = {
  post: CommunityPost | null
  open: boolean
  onOpenChange: (open: boolean) => void
  loggedInId: string | null
  onCommentAdded: () => void
}

function formatCommentDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function CommunityCommentsDialog({
  post,
  open,
  onOpenChange,
  loggedInId,
  onCommentAdded,
}: Props) {
  const [comments, setComments] = useState<CommunityComment[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !post) return
    setComments(null)
    setError(null)
    loadCommunityComments(post.id)
      .then(setComments)
      .catch(() => {
        setComments([])
        setError("댓글을 불러오지 못했습니다.")
      })
  }, [open, post?.id])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!post || !loggedInId || submitting) return

    const form = e.currentTarget
    const content = String(new FormData(form).get("content") ?? "").trim()
    if (!content) return

    setSubmitting(true)
    setError(null)
    try {
      await addCommunityComment(post.id, content)
      form.reset()
      const list = await loadCommunityComments(post.id)
      setComments(list)
      onCommentAdded()
    } catch {
      setError("댓글 등록에 실패했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>댓글</DialogTitle>
          <DialogDescription>
            {post ? `${post.authorId} 님의 운동 기록` : ""}
          </DialogDescription>
        </DialogHeader>

        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {comments === null ? (
            <li className="text-sm text-muted-foreground">불러오는 중…</li>
          ) : comments.length === 0 ? (
            <li className="text-center text-sm text-muted-foreground py-6">
              첫 댓글을 남겨 응원해 보세요.
            </li>
          ) : (
            comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-secondary/50 px-3 py-2">
                <p className="text-xs font-semibold text-foreground">{c.authorId}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{c.content}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatCommentDate(c.createdAt)}
                </p>
              </li>
            ))
          )}
        </ul>

        <form onSubmit={handleSubmit} className="mt-4 space-y-2 border-t pt-4">
          <Textarea
            name="content"
            placeholder={loggedInId ? "응원 한마디를 남겨 주세요." : "로그인 후 댓글을 쓸 수 있습니다."}
            rows={2}
            className="resize-none"
            disabled={!loggedInId || submitting}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={!loggedInId || submitting}>
            {submitting ? "등록 중…" : "댓글 달기"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
