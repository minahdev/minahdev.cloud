"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import { CommunityCommentsDialog } from "@/components/community-comments-dialog"
import { CommunityComposeDialog } from "@/components/community-compose-dialog"
import { CommunityFeedCard } from "@/components/community-feed-card"
import { Button } from "@/components/ui/button"
import { getLoggedInUserId } from "@/lib/auth-session"
import { cn } from "@/lib/utils"
import {
  COMMUNITY_FILTER_CHIPS,
  loadCommunityPosts,
  toggleCommunityCheer,
  type CommunityPost,
} from "@/lib/pace-community-storage"

export default function CommunityPage() {
  const [posts, setPosts] = useState<CommunityPost[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState("all")
  const [composeOpen, setComposeOpen] = useState(false)
  const [commentPost, setCommentPost] = useState<CommunityPost | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [cheeringId, setCheeringId] = useState<string | null>(null)
  const loggedInId = getLoggedInUserId()

  const refreshPosts = useCallback(() => {
    loadCommunityPosts()
      .then((list) => {
        setPosts(list)
        setLoadError(null)
      })
      .catch(() => {
        setPosts([])
        setLoadError("게시물을 불러오지 못했습니다.")
      })
  }, [])

  useEffect(() => {
    refreshPosts()
  }, [refreshPosts])

  const filteredPosts = useMemo(() => {
    if (!posts) return null
    if (filter === "all") return posts
    return posts.filter((p) => p.workoutType === filter)
  }, [posts, filter])

  const handleCheer = async (post: CommunityPost) => {
    if (!loggedInId) return
    setCheeringId(post.id)
    try {
      const result = await toggleCommunityCheer(post.id)
      setPosts((prev) =>
        prev?.map((p) =>
          p.id === post.id
            ? {
                ...p,
                cheerCount: result.cheerCount,
                cheeredByMe: result.cheeredByMe,
              }
            : p,
        ) ?? null,
      )
    } catch {
      /* ignore */
    } finally {
      setCheeringId(null)
    }
  }

  const handleCommentAdded = () => {
    if (!commentPost) return
    setPosts((prev) =>
      prev?.map((p) =>
        p.id === commentPost.id ? { ...p, commentCount: p.commentCount + 1 } : p,
      ) ?? null,
    )
  }

  const feedCount = filteredPosts?.length ?? 0

  return (
    <div className="pb-24 pt-28 md:pt-32">
      <div className="container mx-auto max-w-3xl px-4 sm:px-6">
        <header className="mb-6">
          <p className="text-sm font-medium text-primary">Community</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            운동 커뮤니티
          </h1>
          <p className="mt-2 text-muted-foreground">
            오늘 한 운동을 공유하고, 다른 사람들의 기록에 응원해 보세요.
          </p>
        </header>

        <div
          className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none"
          role="tablist"
          aria-label="운동 종류 필터"
        >
          {COMMUNITY_FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={filter === chip.id}
              onClick={() => setFilter(chip.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === chip.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">피드</h2>
          {filteredPosts !== null ? (
            <span className="text-sm text-muted-foreground">{feedCount}개</span>
          ) : null}
        </div>

        {loadError ? (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}

        {filteredPosts === null ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-xl border border-border/60 bg-secondary/40"
                aria-hidden
              />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            {filter === "all"
              ? "아직 게시물이 없습니다. + 버튼으로 첫 운동 기록을 올려 보세요."
              : "이 종목의 게시물이 없습니다."}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {filteredPosts.map((post) => (
              <li key={post.id}>
                <CommunityFeedCard
                  post={post}
                  onCheer={handleCheer}
                  onOpenComments={(p) => {
                    setCommentPost(p)
                    setCommentsOpen(true)
                  }}
                  cheering={cheeringId === post.id}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        type="button"
        size="icon"
        className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg md:right-8"
        onClick={() => setComposeOpen(true)}
        aria-label="운동 기록 올리기"
      >
        <Plus className="h-6 w-6" aria-hidden />
      </Button>

      <CommunityComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        loggedInId={loggedInId}
        onPosted={refreshPosts}
      />

      <CommunityCommentsDialog
        post={commentPost}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        loggedInId={loggedInId}
        onCommentAdded={handleCommentAdded}
      />

      {!loggedInId ? (
        <p className="fixed bottom-[4.5rem] left-0 right-0 z-30 px-4 text-center text-xs text-muted-foreground pointer-events-none">
          응원·댓글은{" "}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline pointer-events-auto">
            로그인
          </Link>
          후 이용할 수 있습니다.
        </p>
      ) : null}
    </div>
  )
}
