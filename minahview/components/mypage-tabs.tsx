"use client"

import { useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BarChart3, UserRound, Zap } from "lucide-react"

import { AnalyticsPanel } from "@/app/analytics/page"
import { TrainPanel } from "@/app/train/page"
import { MyPageForm } from "@/components/mypage-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type MyPageTab = "profile" | "train" | "analytics"

const TAB_VALUES: MyPageTab[] = ["profile", "train", "analytics"]

function parseTab(raw: string | null): MyPageTab {
  if (raw === "train" || raw === "analytics") return raw
  return "profile"
}

export function MyPageTabs() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = parseTab(searchParams.get("tab"))

  const setTab = useCallback(
    (next: MyPageTab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === "profile") {
        params.delete("tab")
      } else {
        params.set("tab", next)
      }
      const q = params.toString()
      router.replace(q ? `/mypage?${q}` : "/mypage", { scroll: false })
    },
    [router, searchParams],
  )

  useEffect(() => {
    const raw = searchParams.get("tab")
    if (raw && !TAB_VALUES.includes(raw as MyPageTab)) {
      setTab("profile")
    }
  }, [searchParams, setTab])

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-8 text-center md:text-left">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-secondary/80 px-3 py-1.5 text-xs font-medium text-foreground/90">
          <UserRound className="size-3.5 text-primary" aria-hidden />
          MY
        </div>
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">마이페이지</h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          프로필·훈련 기록·분석을 한곳에서 관리하세요.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(parseTab(v))} className="gap-6">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1">
          <TabsTrigger value="profile" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <UserRound className="size-4 shrink-0" aria-hidden />
            프로필
          </TabsTrigger>
          <TabsTrigger value="train" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <Zap className="size-4 shrink-0" aria-hidden />
            훈련
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <BarChart3 className="size-4 shrink-0" aria-hidden />
            분석
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0 outline-none">
          <MyPageForm embedded />
        </TabsContent>

        <TabsContent value="train" className="mt-0 outline-none">
          <TrainPanel embedded />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0 outline-none">
          <AnalyticsPanel embedded />
        </TabsContent>
      </Tabs>
    </div>
  )
}
