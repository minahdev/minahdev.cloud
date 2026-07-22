"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Activity, ArrowLeft, BarChart3, BookOpen,
  ChevronDown, Mail, Menu, ScanEye, Settings, Shield, UserRound, Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { AUTH_SESSION_EVENT, clearLoggedInUserId, getLoggedInUserId, getLoggedInUserRole } from "@/lib/auth-session"

import { CurrentWeather } from "@/components/current-weather"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

// 하단 탭(메인·Pace AI·스케줄·훈련·커뮤니티)과 중복되지 않는 항목만
const mypageItems = [
  { href: "/mypage",      label: "프로필 상세", icon: UserRound },
  { href: "/train",       label: "훈련 기록",   icon: Zap },
  { href: "/analytics",   label: "데이터 분석", icon: BarChart3 },
] as const

// "메일" 부모 아래 서브메뉴
const mailItems = [
  { href: "/comm-agent", label: "이메일 발송" },
  { href: "/contacts",   label: "주소록" },
  { href: "/telegram",   label: "텔레그램" },
  { href: "/inbox",      label: "메일 수신함" },
] as const

const serviceItems = [
  { href: "/settings", label: "설정", icon: Settings },
] as const

const lessonItems = [
  { href: "/titanic/data-collection", label: "데이터 수집" },
  { href: "/titanic/passengers",      label: "승객 목록" },
  { href: "/titanic/conversations",   label: "스미스 선장과의 대화" },
  { href: "/moneyball/coach",         label: "축구 채팅 (머니볼 코치)" },
  { href: "/star-craft/crawler",      label: "크롤러" },
  { href: "/star-craft/scraper",      label: "스크래퍼" },
] as const

// 상단 헤더 pill nav용 (숨김 처리지만 구조 유지)
const navItems = [
  { href: "/", label: "메인" },
  { href: "/pace-ai", label: "Pace AI" },
  { href: "/schedule", label: "스케줄" },
  { href: "/community", label: "커뮤니티" },
]

// 이 경로는 뒤로가기 없이 루트처럼 동작
const ROOT_PATHS = ["/", "/train", "/analytics", "/schedule", "/community", "/pace-ai", "/login", "/signup"]

function menuItemCls(active: boolean) {
  return cn(
    "mx-2 flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors",
    active
      ? "border-l-2 border-primary bg-primary/10 pl-[10px] pr-3 text-foreground"
      : "px-3 text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
  )
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mb-1 px-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50", className)}>
      {children}
    </p>
  )
}

function navPillClass(active: boolean) {
  return `px-4 py-2.5 lg:px-5 lg:py-3 rounded-full text-base font-medium transition-colors ${
    active ? "bg-secondary text-foreground border border-border" : "text-muted-foreground hover:text-foreground"
  }`
}

function isMypageItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

const LESSON_DRAG_THRESHOLD_PX = 28

type LessonDragState = { active: boolean; startY: number; dragged: boolean }

function LessonMenuSection({ pathname, isLessonActive }: { pathname: string; isLessonActive: boolean }) {
  const [expanded, setExpanded] = useState(isLessonActive)
  const dragRef = useRef<LessonDragState>({ active: false, startY: 0, dragged: false })

  useEffect(() => {
    if (isLessonActive) setExpanded(true)
  }, [isLessonActive])

  const showSubs = expanded || isLessonActive

  const endDrag = (target: HTMLElement, pointerId: number) => {
    dragRef.current.active = false
    try { target.releasePointerCapture(pointerId) } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={showSubs}
        aria-label="수업용 메뉴"
        className={cn(
          "mx-2 flex touch-none select-none items-center justify-between rounded-lg py-2.5 text-sm font-medium transition-colors cursor-grab active:cursor-grabbing",
          isLessonActive
            ? "border-l-2 border-primary bg-primary/10 pl-[10px] pr-3 text-foreground"
            : "px-3 text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
        )}
        onPointerDown={(e) => {
          dragRef.current = { active: true, startY: e.clientY, dragged: false }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return
          const dy = e.clientY - dragRef.current.startY
          if (dy >= LESSON_DRAG_THRESHOLD_PX && !dragRef.current.dragged) {
            dragRef.current.dragged = true
            setExpanded(true)
          }
        }}
        onPointerUp={(e) => {
          const dy = e.clientY - dragRef.current.startY
          endDrag(e.currentTarget, e.pointerId)
          if (!dragRef.current.dragged && Math.abs(dy) < 8) setExpanded((o) => !o)
        }}
        onPointerCancel={(e) => endDrag(e.currentTarget, e.pointerId)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((o) => !o) }
        }}
      >
        <span className="flex items-center gap-3">
          <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
          수업용
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", showSubs && "rotate-180")} aria-hidden />
      </div>

      {showSubs && (
        <div className="ml-7 mt-0.5 border-l border-border/50 pl-2">
          {lessonItems.map((sub) => {
            const active = pathname === sub.href
            return (
              <SheetClose asChild key={sub.href}>
                <Link
                  href={sub.href}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                  )}
                >
                  {sub.label}
                </Link>
              </SheetClose>
            )
          })}
        </div>
      )}
    </div>
  )
}

function isMailActive(pathname: string) {
  return mailItems.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
}

function MailMenuSection({ pathname }: { pathname: string }) {
  const active = isMailActive(pathname)
  const [expanded, setExpanded] = useState(active)

  useEffect(() => {
    if (active) setExpanded(true)
  }, [active])

  const showSubs = expanded || active

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={showSubs}
        aria-label="메일 메뉴"
        className={cn(
          "mx-2 flex items-center justify-between rounded-lg py-2.5 text-sm font-medium transition-colors",
          active
            ? "border-l-2 border-primary bg-primary/10 pl-[10px] pr-3 text-foreground"
            : "px-3 text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
        )}
        onClick={() => setExpanded((o) => !o)}
      >
        <span className="flex items-center gap-3">
          <Mail className="h-4 w-4 shrink-0" aria-hidden />
          메일
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", showSubs && "rotate-180")} aria-hidden />
      </button>

      {showSubs && (
        <div className="ml-7 mt-0.5 border-l border-border/50 pl-2">
          {mailItems.map((sub) => {
            const subActive = pathname === sub.href || pathname.startsWith(`${sub.href}/`)
            return (
              <SheetClose asChild key={sub.href}>
                <Link
                  href={sub.href}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    subActive
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                  )}
                >
                  {sub.label}
                </Link>
              </SheetClose>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const showBack = !ROOT_PATHS.includes(pathname)

  useEffect(() => {
    const sync = () => {
      setUserId(getLoggedInUserId())
      setRole(getLoggedInUserRole())
    }
    sync()
    window.addEventListener(AUTH_SESSION_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(AUTH_SESSION_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center gap-2 px-4 sm:px-6 md:h-20 md:gap-3 lg:h-24">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {showBack ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex shrink-0 items-center justify-center h-9 w-9 rounded-xl border border-border/60 bg-secondary/40 text-foreground transition-colors hover:bg-secondary/60 sm:h-10 sm:w-10"
              aria-label="뒤로 가기"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <Link href="/" className="flex shrink-0 items-center" aria-label="메인으로 이동" title="메인">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 sm:h-10 sm:w-10 md:h-11 md:w-11">
                <Activity className="h-6 w-6 text-primary md:h-7 md:w-7" />
              </div>
            </Link>
          )}
          <CurrentWeather variant="header" fallbackCity="Seoul" />
        </div>

        <nav className="hidden" aria-hidden>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={navPillClass(pathname === item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {userId ? (
            <button
              type="button"
              onClick={() => {
                clearLoggedInUserId()
                router.push("/")
              }}
              className="inline-flex h-9 items-center rounded-full border border-border/60 bg-secondary/40 px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60 sm:h-10 sm:px-4"
            >
              로그아웃
            </button>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:h-10"
            >
              로그인
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-secondary/40 text-foreground transition-colors hover:bg-secondary/60 sm:h-10 sm:w-10"
            aria-label="메뉴 열기"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="flex w-72 flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                <Activity className="h-5 w-5 text-primary" aria-hidden />
              </div>
              메뉴
            </SheetTitle>
            <SheetDescription className="sr-only">
              마이페이지와 주요 페이지로 이동하는 메뉴입니다.
            </SheetDescription>
          </SheetHeader>

          {/* flex-1로 남은 공간 채우고 mt-auto로 수업용 하단 고정 */}
          <nav className="mt-6 flex flex-1 flex-col gap-0.5 overflow-y-auto">
            <div className="flex flex-col gap-0.5">

              {/* ── 내 활동 ── */}
              <SectionLabel>내 활동</SectionLabel>
              {mypageItems.map((item) => {
                const isActive = isMypageItemActive(pathname, item.href)
                const Icon = item.icon
                return (
                  <SheetClose asChild key={item.href}>
                    <Link href={item.href} className={menuItemCls(isActive)}>
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </SheetClose>
                )
              })}

              {/* ── 서비스 관리 ── */}
              <SectionLabel className="mt-5">서비스 관리</SectionLabel>
              <MailMenuSection pathname={pathname} />
              {serviceItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <SheetClose asChild key={item.href}>
                    <Link href={item.href} className={menuItemCls(isActive)}>
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </SheetClose>
                )
              })}
              {role === "admin" ? (
                <SheetClose asChild>
                  <Link
                    href="/admin"
                    className={menuItemCls(pathname === "/admin" || pathname.startsWith("/admin/"))}
                  >
                    <Shield className="h-4 w-4 shrink-0" aria-hidden />
                    관리자
                  </Link>
                </SheetClose>
              ) : null}

              {/* ── 비전 ── */}
              <SectionLabel className="mt-5">비전</SectionLabel>
              <SheetClose asChild>
                <Link
                  href="/vision"
                  className={menuItemCls(pathname === "/vision" || pathname.startsWith("/vision/"))}
                >
                  <ScanEye className="h-4 w-4 shrink-0" aria-hidden />
                  비전 처리
                </Link>
              </SheetClose>

            </div>

            {/* ── 수업용 (하단 고정) ── */}
            <div className="mt-auto pt-4">
              <div className="mb-3 border-t border-border/50" />
              <LessonMenuSection
                pathname={pathname}
                isLessonActive={
                  pathname === "/titanic" ||
                  pathname.startsWith("/titanic/") ||
                  pathname.startsWith("/moneyball") ||
                  pathname.startsWith("/star-craft")
                }
              />
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  )
}
