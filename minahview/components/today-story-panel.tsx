"use client"

import { FormEvent, useEffect, useState } from "react"
import { Heart, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  loadTodayStory,
  MOOD_OPTIONS,
  saveTodayStory,
  type MoodTag,
} from "@/lib/pace-today-story-storage"
import { cn } from "@/lib/utils"

export function TodayStoryPanel() {
  const [story, setStory] = useState("")
  const [mood, setMood] = useState<MoodTag | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadTodayStory()
      .then((saved) => {
        if (cancelled || !saved) return
        setStory(saved.story)
        setMood(saved.mood)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const text = story.trim()
    if (!text) return
    try {
      await saveTodayStory(text, mood, null)
      setSavedMessage("오늘의 기록을 남겼어요.")
      window.setTimeout(() => setSavedMessage(null), 3000)
    } catch {
      setSavedMessage("저장에 실패했습니다. 로그인 상태를 확인해 주세요.")
      window.setTimeout(() => setSavedMessage(null), 4000)
    }
  }

  return (
    <Card className="shrink-0 gap-0 border-border/80 bg-card/70 py-0 text-center shadow-sm backdrop-blur-sm">
      <CardHeader className="items-center gap-1 border-b border-border/60 px-4 py-3 sm:px-5">
        <CardTitle className="flex items-center justify-center gap-2 text-base">
          <Heart className="size-4 text-primary" aria-hidden />
          오늘은 어떠셨나요?
        </CardTitle>
        <p className="text-xs text-muted-foreground sm:text-sm">
          오늘의 기분과 하루를 편하게 적어주세요.
        </p>
      </CardHeader>

      <CardContent className="space-y-4 px-4 py-4 sm:px-5">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">지금 기분 (선택)</p>
          <div className="flex flex-wrap justify-center gap-2">
            {MOOD_OPTIONS.map((tag) => {
              const active = mood === tag
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setMood(active ? null : tag)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border/70 bg-secondary/40 text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>

        <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-md flex-col items-center space-y-3">
          <Textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="오늘 있었던 일, 기분, 몸 상태를 자유롭게 적어주세요."
            rows={4}
            className="min-h-[100px] w-full resize-none text-left text-sm leading-relaxed"
          />

          <Button type="submit" disabled={!story.trim()} className="w-full">
            <Save className="size-4" aria-hidden />
            기록 남기기
          </Button>
        </form>

        {savedMessage ? (
          <p className="text-sm text-primary" role="status">
            {savedMessage}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
