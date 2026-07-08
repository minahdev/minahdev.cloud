import { Suspense } from "react"

import { SchedulePageContent } from "@/components/schedule-page-content"

function ScheduleFallback() {
  return (
    <div className="pb-16 pt-28 md:pt-32">
      <div className="container mx-auto max-w-5xl px-6">
        <div className="min-h-[20rem] animate-pulse rounded-2xl bg-secondary/30" aria-hidden />
      </div>
    </div>
  )
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<ScheduleFallback />}>
      <SchedulePageContent />
    </Suspense>
  )
}
