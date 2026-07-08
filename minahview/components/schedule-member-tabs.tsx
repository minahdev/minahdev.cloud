"use client"

import { useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Users } from "lucide-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ScheduleMember } from "@/lib/pace-schedule-access"

type ScheduleMemberTabsProps = {
  members: ScheduleMember[]
  activeMemberId: string
  onActiveMemberChange: (userId: string) => void
}

export function ScheduleMemberTabs({
  members,
  activeMemberId,
  onActiveMemberChange,
}: ScheduleMemberTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setMember = useCallback(
    (userId: string) => {
      onActiveMemberChange(userId)
      const params = new URLSearchParams(searchParams.toString())
      params.set("member", userId)
      router.replace(`/schedule?${params.toString()}`, { scroll: false })
    },
    [onActiveMemberChange, router, searchParams],
  )

  useEffect(() => {
    const fromUrl = searchParams.get("member")?.trim()
    if (fromUrl && members.some((m) => m.userId === fromUrl) && fromUrl !== activeMemberId) {
      onActiveMemberChange(fromUrl)
    }
  }, [searchParams, members, activeMemberId, onActiveMemberChange])

  if (members.length === 0) return null

  return (
    <div className="mb-6">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Users className="h-4 w-4" aria-hidden />
        회원 선택
      </p>
      <Tabs value={activeMemberId} onValueChange={setMember}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-secondary/50 p-1">
          {members.map((m) => (
            <TabsTrigger
              key={m.userId}
              value={m.userId}
              className="shrink-0 data-[state=active]:bg-background"
            >
              {m.nickname}
              <span className="ml-1.5 text-xs text-muted-foreground">({m.userId})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
