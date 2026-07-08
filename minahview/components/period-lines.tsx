import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** 온점(.) 기준으로 문장을 나눠 각 줄에 표시 */
export function splitByPeriod(text: string): string[] {
  return text
    .split(".")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0)
    .map((part) => `${part}.`)
}

type PeriodLinesProps = {
  className?: string
  lines: ReactNode[]
}

export function PeriodLines({ className, lines }: PeriodLinesProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {lines.map((line, index) => (
        <span key={index} className="block">
          {line}
        </span>
      ))}
    </div>
  )
}
