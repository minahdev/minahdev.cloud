"use client"

import { MessageCircle, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { CommunityPostMedia } from "@/components/community-post-media"
import {
  WORKOUT_TYPE_EMOJI,
  type CommunityPost,
} from "@/lib/pace-community-storage"

type Props = {
  post: CommunityPost
  onCheer: (post: CommunityPost) => void
  onOpenComments: (post: CommunityPost) => void
  cheering?: boolean
}

function formatPostDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function hasStats(post: CommunityPost) {
  return (
    (post.distanceKm != null && post.distanceKm > 0) ||
    (post.durationMin != null && post.durationMin > 0) ||
    (post.calories != null && post.calories > 0)
  )
}

export function CommunityFeedCard({ post, onCheer, onOpenComments, cheering }: Props) {
  const emoji = WORKOUT_TYPE_EMOJI[post.workoutType] ?? "✨"

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
            aria-hidden
          >
            <User className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{post.authorId}</p>
                <p className="text-[11px] text-muted-foreground">{formatPostDate(post.createdAt)}</p>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground">
                {emoji} {post.workoutType}
              </span>
            </div>

            {hasStats(post) ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {post.distanceKm != null && post.distanceKm > 0 ? (
                  <span className="rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-foreground">
                    📏 {post.distanceKm} km
                  </span>
                ) : null}
                {post.durationMin != null && post.durationMin > 0 ? (
                  <span className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground">
                    ⏱ {post.durationMin}분
                  </span>
                ) : null}
                {post.calories != null && post.calories > 0 ? (
                  <span className="rounded-lg border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-foreground">
                    🔥 {post.calories} kcal
                  </span>
                ) : null}
              </div>
            ) : null}

            {post.content ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {post.content}
              </p>
            ) : null}

            {post.media?.length ? <CommunityPostMedia media={post.media} /> : null}

            <div className="mt-4 flex items-center gap-1 border-t border-border/60 pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground",
                  post.cheeredByMe && "text-orange-600 hover:text-orange-700",
                )}
                onClick={() => onCheer(post)}
                disabled={cheering}
                aria-pressed={post.cheeredByMe}
                aria-label={post.cheeredByMe ? "응원 취소" : "응원하기"}
              >
                <span className="text-base leading-none" aria-hidden>
                  {post.cheeredByMe ? "🔥" : "💪"}
                </span>
                <span className="text-xs tabular-nums">{post.cheerCount}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => onOpenComments(post)}
                aria-label="댓글 보기"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                <span className="text-xs tabular-nums">{post.commentCount}</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
