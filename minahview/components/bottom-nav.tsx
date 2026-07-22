"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarClock, Home, Sparkles, Users, Zap } from "lucide-react"

import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
}

// 좌 2 · (중앙 홈) · 우 2  — 분석은 헤더 '내 활동'에서 접근.
const leftItems: NavItem[] = [
  { href: "/train", label: "훈련", Icon: Zap },
  { href: "/schedule", label: "스케줄", Icon: CalendarClock },
]
const rightItems: NavItem[] = [
  { href: "/community", label: "커뮤니티", Icon: Users },
  { href: "/pace-ai", label: "Pace AI", Icon: Sparkles },
]

function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function TabLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavItemActive(pathname, item.href)
  const { href, label, Icon } = item
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-medium transition-colors sm:text-[10px]",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      <span className="max-w-[3.25rem] truncate">{label}</span>
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const homeActive = pathname === "/"

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/90 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="하단 탭 바"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-0.5">
        {leftItems.map((item) => (
          <TabLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* ── 중앙 돌출 홈 버튼 ── */}
        <div className="flex items-end justify-center">
          <Link
            href="/"
            aria-label="메인"
            aria-current={homeActive ? "page" : undefined}
            className={cn(
              "-mt-6 flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-background text-primary-foreground shadow-lg transition-colors",
              homeActive ? "bg-primary" : "bg-primary/90 hover:bg-primary",
            )}
          >
            <Home className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-[8px] font-semibold leading-none">홈</span>
          </Link>
        </div>

        {rightItems.map((item) => (
          <TabLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  )
}
