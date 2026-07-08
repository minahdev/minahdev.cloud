"use client"

import { useCallback, useEffect, useState } from "react"
import { FileText } from "lucide-react"

import { CommunityCommentsDialog } from "@/components/community-comments-dialog"
import { CommunityFeedCard } from "@/components/community-feed-card"
import { getLoggedInUserId } from "@/lib/auth-session"
import {
  loadCommunityPosts,
  toggleCommunityCheer,
  type CommunityPost,
} from "@/lib/pace-community-storage"

export default function MyPostsPage() {
  const [posts, setPosts] = useState<CommunityPost[] | null>(null)
  const [commentPost, setCommentPost] = useState<CommunityPost | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [cheeringId, setCheeringId] = useState<string | null>(null)
  const userId = getLoggedInUserId()

  const refresh = useCallback(() => {
    loadCommunityPosts()
      .then((list) => setPosts(list.filter((p) => p.authorId === userId)))
      .catch(() => setPosts([]))
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleCheer(post: CommunityPost) {
    if (cheeringId) return
    setCheeringId(post.id)
    try {
      await toggleCommunityCheer(post.id, post.authorId)
      refresh()
    } finally {
      setCheeringId(null)
    }
  }

  return (
    <div className="pt-24 pb-16 md:pt-28">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">내 게시물</h1>
          <p className="mt-1 text-sm text-muted-foreground">커뮤니티에 내가 작성한 글 목록</p>
        </div>

        {posts === null ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-secondary/40" aria-hidden />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" aria-hidden />
            <p className="text-sm text-muted-foreground">작성한 게시물이 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
              <CommunityFeedCard
                key={post.id}
                post={post}
                cheering={cheeringId === post.id}
                onCheer={handleCheer}
                onOpenComments={(p) => { setCommentPost(p); setCommentsOpen(true) }}
              />
            ))}
          </div>
        )}
      </div>

      {commentPost && (
        <CommunityCommentsDialog
          post={commentPost}
          open={commentsOpen}
          onOpenChange={setCommentsOpen}
        />
      )}
    </div>
  )
}
