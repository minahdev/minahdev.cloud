"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Dumbbell, Loader2, RefreshCw, Sparkles } from "lucide-react"

import { ChatMessageContent } from "@/components/chat-message-content"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getLoggedInUserId } from "@/lib/auth-session"
import {
  fetchMyPageProfileFromApi,
  getFavoriteExercisesLabel,
  type MyPageProfile,
} from "@/lib/mypage-profile"
import {
  buildTodayWorkoutPrompt,
  fallbackTodayWorkout,
} from "@/lib/pace-today-workout-prompt"
import { loadTodayStory } from "@/lib/pace-today-story-storage"

type Status = "idle" | "loading" | "ready" | "error"

function formatChatError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes("api_key") || lower.includes("gemini")) {
    return "AI 키 설정을 확인한 뒤 백엔드를 재시작해 주세요."
  }
  return message
}

export function TodayWorkoutRecommendation() {
  const [status, setStatus] = useState<Status>("idle")
  const [profile, setProfile] = useState<MyPageProfile | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [usedFallback, setUsedFallback] = useState(false)

  const userId = typeof window !== "undefined" ? getLoggedInUserId() : null

  const generate = useCallback(async (p: MyPageProfile) => {
    setStatus("loading")
    setError(null)
    setUsedFallback(false)

    let todayStory = null
    try {
      todayStory = await loadTodayStory()
    } catch {
      /* 오늘의 이야기 없어도 추천 가능 */
    }

    const prompt = buildTodayWorkoutPrompt(p, todayStory)

    try {
      const res = await fetch("/api/chat/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", text: prompt }] }),
      })
      const data = (await res.json()) as { text?: string; error?: string; detail?: string }
      if (!res.ok) {
        throw new Error(formatChatError(data.error ?? data.detail ?? "추천 생성 실패"))
      }
      if (!data.text?.trim()) {
        throw new Error("응답이 비어 있습니다.")
      }
      setText(data.text.trim())
      setStatus("ready")
    } catch (e) {
      setText(fallbackTodayWorkout(p))
      setUsedFallback(true)
      setStatus("ready")
      setError(e instanceof Error ? formatChatError(e.message) : "AI 연결 실패 — 기본 추천을 표시합니다.")
    }
  }, [])

  useEffect(() => {
    const id = getLoggedInUserId()
    if (!id) {
      setStatus("idle")
      setProfile(null)
      return
    }

    let cancelled = false
    setStatus("loading")
    setError(null)

    fetchMyPageProfileFromApi(id)
      .then((p) => {
        if (cancelled) return
        if (!p) {
          setProfile(null)
          setText(null)
          setStatus("idle")
          return
        }
        setProfile(p)
        return generate(p)
      })
      .catch((err) => {
        if (cancelled) return
        setProfile(null)
        setStatus("error")
        setError(err instanceof Error ? err.message : "프로필을 불러오지 못했습니다.")
      })

    return () => {
      cancelled = true
    }
  }, [generate])

  if (!userId) {
    return (
      <Card className="mb-4 border-border/80 bg-card/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Dumbbell className="size-4 text-primary" aria-hidden />
            오늘의 운동 추천
          </CardTitle>
          <CardDescription>로그인 후 마이페이지 프로필을 바탕으로 맞춤 추천을 받을 수 있어요.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href="/login?from=/pace-ai">로그인하기</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (status === "idle" && !profile) {
    return (
      <Card className="mb-4 border-primary/25 bg-primary/5 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Dumbbell className="size-4 text-primary" aria-hidden />
            오늘의 운동 추천
          </CardTitle>
          <CardDescription>
            마이페이지에서 키·몸무게·선호 운동 등 기초 정보를 입력하면 AI가 오늘의 운동을
            추천해 드립니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm">
            <Link href="/mypage">마이페이지에서 프로필 입력</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-4 border-primary/20 bg-gradient-to-b from-primary/8 to-card/90 shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" aria-hidden />
            오늘의 운동 추천
          </CardTitle>
          <CardDescription>
            {profile ? (
              <>
                <span className="font-medium text-foreground">{profile.name}</span>님 ·{" "}
                {getFavoriteExercisesLabel(
                  profile.favoriteExercises,
                  profile.favoriteExerciseOther,
                )}{" "}
                기준
              </>
            ) : (
              "마이페이지 프로필 기반"
            )}
          </CardDescription>
        </div>
        {profile ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={status === "loading"}
            onClick={() => void generate(profile)}
          >
            {status === "loading" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            <span className="ml-1.5">다시 추천</span>
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-2">
        {status === "loading" && !text ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            프로필을 읽고 오늘의 운동을 구성하는 중…
          </div>
        ) : null}

        {status === "error" && !text ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        {text ? (
          <div className="rounded-xl border border-border/60 bg-background/60 px-4 py-3 text-sm leading-relaxed text-foreground">
            <ChatMessageContent text={text} />
          </div>
        ) : null}

        {usedFallback && error ? (
          <p className="text-xs text-muted-foreground">{error}</p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          마이페이지·오늘의 이야기(기분) 정보를 반영합니다.{" "}
          <Link href="/mypage" className="text-primary underline-offset-2 hover:underline">
            프로필 수정
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
