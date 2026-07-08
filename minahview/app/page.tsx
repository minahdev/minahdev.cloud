import { Suspense } from "react"

import { HomeMainTabs } from "@/components/home-main-tabs"

export default function HomePage() {
  return (
    <div className="pt-24 pb-14 md:pt-28 md:pb-16">
      <div className="container mx-auto px-6 max-w-5xl">
        <Suspense fallback={<div className="min-h-[16rem] animate-pulse rounded-2xl bg-secondary/30" aria-hidden />}>
          <HomeMainTabs />
        </Suspense>
      </div>
    </div>
  )
}
