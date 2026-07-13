"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, CalendarClock, Home, Sparkles, Users, Zap } from "lucide-react"

import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
}

const bottomNavItems: NavItem[] = [
  { href: "/train",      label: "훈련",     Icon: Zap },
  { href: "/analytics",  label: "분석",     Icon: BarChart3 },
  { href: "/",           label: "홈",       Icon: Home },
  { href: "/schedule",   label: "스케줄",   Icon: CalendarClock },
  { href: "/community",  label: "커뮤니티", Icon: Users },
  { href: "/pace-ai",    label: "Pace AI",  Icon: Sparkles },
]

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/"
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/90 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="하단 탭 바"
    >
      <div className="mx-auto grid max-w-lg grid-cols-6 items-end px-0.5">
        {bottomNavItems.map((item) => {
          const active = isNavItemActive(pathname, item)
          const { href, label, Icon } = item
          return (
            <Link
              key={href}
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
        })}
      </div>
    </nav>
  )
}
