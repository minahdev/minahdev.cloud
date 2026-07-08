"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CalendarClock } from "lucide-react"

import { RequireAuth } from "@/components/require-auth"
import { ScheduleGate } from "@/components/schedule-gate"
import { ScheduleMemberTabs } from "@/components/schedule-member-tabs"
import { SchedulePanel } from "@/components/schedule-panel"
import { getLoggedInUserId, getLoggedInUserRole } from "@/lib/auth-session"
import {
  clearScheduleUnlocked,
  fetchScheduleAccessStatus,
  fetchScheduleAdmitted,
  fetchScheduleMembers,
  setScheduleUnlocked,
  type ScheduleMember,
} from "@/lib/pace-schedule-access"

function isCoachOrAdmin(role: string | null): boolean {
  return role === "coach" || role === "admin"
}

export function SchedulePageContent() {
  const searchParams = useSearchParams()
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [members, setMembers] = useState<ScheduleMember[]>([])
  const [membersError, setMembersError] = useState<string | null>(null)
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null)
  const role = getLoggedInUserRole()
  const coachView = isCoachOrAdmin(role)
  const selfUserId = getLoggedInUserId()

  const loadMembers = useCallback(async () => {
    if (!coachView || !selfUserId) return
    try {
      const list = await fetchScheduleMembers(selfUserId)
      setMembers(list)
      setMembersError(null)
      const fromUrl = searchParams.get("member")?.trim()
      setActiveMemberId((prev) => {
        if (fromUrl && list.some((m) => m.userId === fromUrl)) return fromUrl
        if (prev && list.some((m) => m.userId === prev)) return prev
        return list[0]?.userId ?? null
      })
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : "회원 목록을 불러오지 못했습니다.")
    }
  }, [coachView, selfUserId, searchParams])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { configured: isOn } = await fetchScheduleAccessStatus()
        if (cancelled) return
        setConfigured(isOn)
        if (coachView) {
          setUnlocked(true)
          return
        }
        if (!selfUserId) {
          clearScheduleUnlocked()
          setUnlocked(false)
          return
        }
        const admitted = await fetchScheduleAdmitted(selfUserId)
        if (cancelled) return
        if (admitted) {
          setScheduleUnlocked()
          setUnlocked(true)
        } else {
          clearScheduleUnlocked()
          setUnlocked(false)
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "설정을 불러오지 못했습니다.")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [coachView, selfUserId])

  useEffect(() => {
    if (!coachView || !selfUserId) return
    loadMembers()
    const onFocus = () => loadMembers()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [coachView, selfUserId, loadMembers])

  const activeMember = useMemo(
    () => members.find((m) => m.userId === activeMemberId) ?? null,
    [members, activeMemberId],
  )

  const panelMemberId = coachView ? activeMemberId : selfUserId
  const showPanel = configured !== null && (coachView || unlocked) && Boolean(panelMemberId)

  return (
    <RequireAuth loginRedirect="/schedule">
      <div className="pb-16 pt-28 md:pt-32">
        <div className="container mx-auto max-w-5xl px-6">
          <header className="mb-8">
            <p className="text-sm font-medium text-primary">Schedule</p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              <CalendarClock className="h-8 w-8 text-primary" aria-hidden />
              레슨 스케줄
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {coachView
                ? "회원별 탭에서 일정을 관리하고, 수업 후 텍스트·사진·동영상 기록을 남길 수 있습니다."
                : "코치와 회원이 레슨 일정을 확인하고, 수업 후 텍스트·사진·동영상 기록을 남겨 복습할 수 있습니다."}
            </p>
          </header>

          {loadError ? (
            <p className="mb-6 text-sm text-destructive" role="alert">
              {loadError}
            </p>
          ) : null}

          {configured === null && !loadError ? (
            <div className="min-h-[12rem] animate-pulse rounded-2xl bg-secondary/30" aria-hidden />
          ) : null}

          {configured !== null && !coachView && !unlocked ? (
            <ScheduleGate onUnlocked={() => setUnlocked(true)} />
          ) : null}

          {coachView && configured !== null ? (
            <>
              {membersError ? (
                <p className="mb-4 text-sm text-destructive" role="alert">
                  {membersError}
                </p>
              ) : null}
              {members.length > 0 && activeMemberId ? (
                <ScheduleMemberTabs
                  members={members}
                  activeMemberId={activeMemberId}
                  onActiveMemberChange={setActiveMemberId}
                />
              ) : members.length === 0 && !membersError ? (
                <p className="mb-6 rounded-xl border border-dashed border-border bg-secondary/25 px-4 py-8 text-center text-sm text-muted-foreground">
                  입장 코드를 사용한 회원만 표시됩니다. 마이페이지에서 코드를 발급한 뒤 회원이
                  스케줄 화면에서 코드를 입력하면 여기에 나타납니다.
                </p>
              ) : null}
            </>
          ) : null}

          {showPanel ? (
            <SchedulePanel
              key={panelMemberId!}
              memberUserId={panelMemberId!}
              memberLabel={coachView ? activeMember?.nickname : undefined}
            />
          ) : null}
        </div>
      </div>
    </RequireAuth>
  )
}
