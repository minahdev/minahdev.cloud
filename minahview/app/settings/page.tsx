"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, ChevronRight, FileText, Lock, LogOut, Mail, Megaphone, MessageSquare, Moon, Shield, Sun, UserRound, UserX } from "lucide-react"
import { useTheme } from "next-themes"

import { clearLoggedInUserId, getLoggedInUserId } from "@/lib/auth-session"

const NOTIF_KEY = "pace-notif-consent"

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">
      {children}
    </p>
  )
}

function SettingRow({
  icon: Icon,
  label,
  value,
  danger,
  onClick,
  children,
}: {
  icon: React.ElementType
  label: string
  value?: string
  danger?: boolean
  onClick?: () => void
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick && !children}
      className={[
        "flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm transition-colors",
        onClick
          ? danger
            ? "hover:bg-destructive/10 active:bg-destructive/15"
            : "hover:bg-secondary/60 active:bg-secondary/80"
          : "cursor-default",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          danger ? "bg-destructive/10" : "bg-secondary",
        ].join(" ")}
      >
        <Icon className={["h-4 w-4", danger ? "text-destructive" : "text-muted-foreground"].join(" ")} aria-hidden />
      </div>

      <span className={["flex-1 text-left font-medium", danger ? "text-destructive" : "text-foreground"].join(" ")}>
        {label}
      </span>

      {value && <span className="text-xs text-muted-foreground">{value}</span>}
      {children}
      {onClick && !children && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
      )}
    </button>
  )
}

function SwitchPill({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={[
        "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-primary" : "bg-muted border border-border",
      ].join(" ")}
    >
      <span
        className={[
          "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  )
}

function ToggleRow({
  icon: Icon,
  label,
  checked,
  onToggle,
}: {
  icon: React.ElementType
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <SwitchPill checked={checked} onToggle={onToggle} />
    </div>
  )
}

function NotifToggle() {
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(localStorage.getItem(NOTIF_KEY) === "1")
  }, [])

  function toggle() {
    const next = !on
    setOn(next)
    localStorage.setItem(NOTIF_KEY, next ? "1" : "0")
  }

  return <ToggleRow icon={Bell} label="알림 수신 동의" checked={on} onToggle={toggle} />
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const isDark = theme === "dark"

  return (
    <ToggleRow
      icon={isDark ? Moon : Sun}
      label={isDark ? "다크 모드" : "라이트 모드"}
      checked={isDark}
      onToggle={() => setTheme(isDark ? "light" : "dark")}
    />
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [showWithdraw, setShowWithdraw] = useState(false)

  useEffect(() => {
    setUserId(getLoggedInUserId())
  }, [])

  function handleLogout() {
    clearLoggedInUserId()
    router.replace("/login")
  }

  function handleWithdraw() {
    setShowWithdraw(true)
  }

  return (
    <div className="pt-24 pb-24 md:pt-28">
      <div className="container mx-auto max-w-lg px-4">

        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">설정</h1>
          <p className="mt-1 text-sm text-muted-foreground">계정 및 앱 환경 설정</p>
        </div>

        <div className="flex flex-col gap-6">

          {/* MY 계정 정보 */}
          <section>
            <SectionTitle>MY 계정 정보</SectionTitle>
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card divide-y divide-border/40">
              <SettingRow
                icon={UserRound}
                label="아이디"
                value={userId ?? "로그인 필요"}
              />
              <SettingRow
                icon={Mail}
                label="이메일"
                value="미등록"
              />
              <SettingRow
                icon={FileText}
                label="내 게시물"
                onClick={() => router.push("/settings/my-posts")}
              />
              <SettingRow
                icon={UserX}
                label="회원탈퇴"
                danger
                onClick={handleWithdraw}
              />
              <SettingRow
                icon={LogOut}
                label="로그아웃"
                danger
                onClick={handleLogout}
              />
            </div>
          </section>

          {/* 화면 */}
          <section>
            <SectionTitle>화면</SectionTitle>
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <ThemeToggle />
            </div>
          </section>

          {/* 알림 */}
          <section>
            <SectionTitle>알림</SectionTitle>
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <NotifToggle />
            </div>
          </section>

          {/* 고객 지원 */}
          <section>
            <SectionTitle>고객 지원</SectionTitle>
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card divide-y divide-border/40">
              <SettingRow
                icon={Megaphone}
                label="공지사항"
                onClick={() => router.push("/notices")}
              />
              <SettingRow
                icon={MessageSquare}
                label="문의하기"
                onClick={() => router.push("/settings/inquiry")}
              />
            </div>
          </section>

          {/* 이용약관 */}
          <section>
            <SectionTitle>이용약관</SectionTitle>
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card divide-y divide-border/40">
              <SettingRow
                icon={Shield}
                label="서비스 이용약관"
                onClick={() => router.push("/settings/terms")}
              />
              <SettingRow
                icon={Lock}
                label="개인정보 처리방침"
                onClick={() => router.push("/settings/privacy")}
              />
            </div>
          </section>

        </div>
      </div>

      {/* 회원탈퇴 확인 모달 */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border/60 p-6">
            <h2 className="mb-2 text-lg font-bold text-foreground">회원탈퇴</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다. 정말 탈퇴하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowWithdraw(false)}
                className="flex-1 rounded-xl border border-border bg-secondary py-3 text-sm font-semibold text-foreground"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  clearLoggedInUserId()
                  router.replace("/login")
                }}
                className="flex-1 rounded-xl bg-destructive py-3 text-sm font-semibold text-destructive-foreground"
              >
                탈퇴
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
