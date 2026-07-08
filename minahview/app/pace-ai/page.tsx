"use client"

import { Sparkles } from "lucide-react"

import { GeminiChat } from "@/components/gemini-chat"
import { TodayWorkoutRecommendation } from "@/components/today-workout-recommendation"

export default function PaceAiPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col pb-16 pt-28 md:pt-32">
      <div className="container mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-6">
        <header className="mb-6 shrink-0 text-center md:text-left">
          <p className="text-sm font-medium text-primary">Pace AI</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            헬스케어 AI 코치
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            운동·식단·컨디션·부상 예방 등 궁금한 점을 아래에 입력해 보세요.
          </p>
        </header>

        <TodayWorkoutRecommendation />

        <GeminiChat
          fillHeight
          className="min-h-[min(24rem,calc(100dvh-16rem))]"
          title="Pace AI"
          subtitle=""
          placeholder="궁금한 점을 입력하세요… (Enter 전송, Shift+Enter 줄바꿈)"
          emptyMessage="예: 오늘 하체 운동 후 무릎이 뻐근해요. 스트레칭 추천해 줄 수 있어?"
        />

        <p className="mt-4 shrink-0 text-center text-xs text-muted-foreground md:text-left">
          <Sparkles className="mr-1 inline size-3.5 text-primary" aria-hidden />
          AI 답변은 참고용이며, 통증·부상이 심하면 전문의와 상담하세요.
        </p>
      </div>
    </div>
  )
}
