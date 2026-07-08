"use client"

import { Sparkles } from "lucide-react"

import { GeminiChat } from "@/components/gemini-chat"
import { PeriodLines } from "@/components/period-lines"
import { TodayStoryPanel } from "@/components/today-story-panel"

const contentWidth = "w-full max-w-2xl"

const INTRO_LINES = [
  "의욕 넘치는 아침도, 무기력한 퇴근길도 괜찮습니다.",
  "오늘의 감정과 컨디션을 분석해 오직 당신만을 위해 유연하게",
  "변화하는 AI 운동 비서 ",
] as const

export function HomeMainTabs() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className={`${contentWidth} mb-5 flex flex-col items-center md:mb-7`}>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-secondary/80 px-3 py-1.5 text-xs shadow-sm shadow-primary/5 backdrop-blur-sm sm:px-3.5 sm:py-2 sm:text-sm">
          <Sparkles className="size-3.5 shrink-0 text-primary sm:size-4" aria-hidden />
          <span className="font-medium tracking-wide text-foreground/90">Healthy</span>
        </div>

        <h1 className="mt-4 text-balance text-3xl font-bold leading-[1.15] tracking-tight text-foreground drop-shadow-[0_2px_20px_oklch(0.05_0_0/0.65)] sm:text-4xl md:mt-5 md:text-[2.125rem] lg:text-5xl">
          <span className="block">Sync Your Mind,</span>
          <span className="mt-0.5 block md:mt-1">
            Find Your <span className="text-primary">Pace.</span>
          </span>
        </h1>
      </div>

      <PeriodLines
        className={`${contentWidth} text-sm leading-relaxed text-muted-foreground md:text-base`}
        lines={[
          INTRO_LINES[0],
          INTRO_LINES[1],
          <>
            {INTRO_LINES[2]}
            <strong className="font-semibold tracking-wide text-foreground">PACE</strong>.
          </>,
        ]}
      />

      <div className={`${contentWidth} mt-6 flex flex-col gap-4`}>
        <TodayStoryPanel />
        <GeminiChat className="min-h-[14rem] text-left" />
      </div>
    </div>
  )
}
