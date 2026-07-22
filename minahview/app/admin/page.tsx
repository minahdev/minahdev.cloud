"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import {
  Shield,
  Users,
  Bell,
  CalendarClock,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Plus,
  TrendingUp,
  TrendingDown,
  Activity,
  KeyRound,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Chart palette ────────────────────────────────────────────────────────────
const C = {
  primary:  "#3fd8b3",
  amber:    "#e5c97a",
  indigo:   "#818cf8",
  red:      "#f87171",
  border:   "#2a2a2a",
  mutedFg:  "#737373",
}

// ─── Mock weekly series ───────────────────────────────────────────────────────
const weeklyData = [
  { day: "월", 게시글: 3, 공지: 1, 회원: 2 },
  { day: "화", 게시글: 5, 공지: 0, 회원: 1 },
  { day: "수", 게시글: 4, 공지: 2, 회원: 3 },
  { day: "목", 게시글: 2, 공지: 1, 회원: 0 },
  { day: "금", 게시글: 6, 공지: 0, 회원: 2 },
  { day: "토", 게시글: 8, 공지: 1, 회원: 4 },
  { day: "일", 게시글: 3, 공지: 0, 회원: 1 },
]

const contentBarData = [
  { name: "공지", value: 0, fill: C.amber },
  { name: "게시글", value: 0, fill: C.primary },
  { name: "회원", value: 0, fill: C.indigo },
  { name: "스케줄", value: 1, fill: C.red },
]

function spark(seed: number) {
  return Array.from({ length: 7 }, (_, i) => ({
    v: Math.max(1, Math.round(seed * (0.6 + Math.abs(Math.sin(i + seed)) * 0.6))),
  }))
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Stats = { notices: number; members: number; posts: number; scheduleOpen: boolean }
type Notice = { id: number; title: string; created_at?: string }
type Post   = { id: number; title?: string; content?: string; created_at?: string; author_id?: string }
type Member = { user_id?: string; name?: string }

// ─── Stat card with inline sparkline ─────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, trend, trendUp, color, sparkData,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  trend?: string
  trendUp?: boolean
  color: string
  sparkData: { v: number }[]
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: `${color}22` }}
        >
          <Icon className="h-5 w-5" style={{ color }} aria-hidden />
        </div>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold",
              trendUp
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400",
            )}
          >
            {trendUp ? (
              <TrendingUp className="h-2.5 w-2.5" aria-hidden />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" aria-hidden />
            )}
            {trend}
          </span>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>

      <div className="h-9">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sparkData} barSize={5} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────
function ChartCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <p className="mb-4 text-sm font-semibold">{title}</p>
      {children}
    </div>
  )
}

// ─── Donut center label ───────────────────────────────────────────────────────
function DonutLabel({ cx, cy, total }: { cx?: number; cy?: number; total: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="#fff">
      <tspan x={cx} dy="-0.4em" fontSize="20" fontWeight="700">
        {total}
      </tspan>
      <tspan x={cx} dy="1.4em" fontSize="10" fill={C.mutedFg}>
        전체
      </tspan>
    </text>
  )
}

// ─── Quick action button ──────────────────────────────────────────────────────
function QuickAction({
  icon: Icon, label, href, color,
}: {
  icon: React.ElementType
  label: string
  href: string
  color: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-white/10 hover:bg-secondary"
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
        style={{ background: `${color}22` }}
      >
        <Icon className="h-5 w-5" style={{ color }} aria-hidden />
      </div>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
        {label}
      </span>
    </Link>
  )
}

// ─── Recent row ───────────────────────────────────────────────────────────────
function RecentRow({
  icon: Icon, label, sub, color,
}: {
  icon: React.ElementType
  label: string
  sub?: string
  color: string
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}1a` }}
      >
        <Icon className="h-4 w-4" style={{ color }} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({ notices: 0, members: 0, posts: 0, scheduleOpen: false })
  const [notices, setNotices] = useState<Notice[]>([])
  const [posts, setPosts]     = useState<Post[]>([])

  // 접근 인가는 middleware.ts(쿠키 role=admin) + 백엔드 API가 담당 → 여기선 데이터만 로드.
  useEffect(() => {
    async function load() {
      try {
        const [nRes, pRes, mRes, sRes] = await Promise.allSettled([
          fetch("/api/inbody/notices"),
          fetch("/api/inbody/community/posts"),
          fetch("/api/schedule/members"),
          fetch("/api/schedule/access/status"),
        ])
        const ns: Notice[] = nRes.status === "fulfilled" && nRes.value.ok
          ? await nRes.value.json().then((d: unknown) => {
              const data = d as Notice[] | { items?: Notice[] }
              return Array.isArray(data) ? data : (data as { items?: Notice[] }).items ?? []
            })
          : []
        const ps: Post[] = pRes.status === "fulfilled" && pRes.value.ok
          ? await pRes.value.json().then((d: unknown) => {
              const data = d as Post[] | { items?: Post[] }
              return Array.isArray(data) ? data : (data as { items?: Post[] }).items ?? []
            })
          : []
        const ms: Member[] = mRes.status === "fulfilled" && mRes.value.ok
          ? await mRes.value.json().then((d: unknown) => {
              const data = d as Member[] | { members?: Member[] }
              return Array.isArray(data) ? data : (data as { members?: Member[] }).members ?? []
            })
          : []
        const open: boolean = sRes.status === "fulfilled" && sRes.value.ok
          ? await sRes.value.json().then((d: unknown) => {
              const data = d as { is_open?: boolean; status?: string }
              return data.is_open ?? data.status === "open"
            })
          : false

        setNotices(ns)
        setPosts(ps)
        setStats({ notices: ns.length, members: ms.length, posts: ps.length, scheduleOpen: open })

        contentBarData[0].value = ns.length
        contentBarData[1].value = ps.length
        contentBarData[2].value = ms.length
      } catch { /* silently fail */ }
    }
    load()
  }, [])

  const pieData = [
    { name: "공지", value: Math.max(stats.notices, 1), color: C.amber },
    { name: "게시글", value: Math.max(stats.posts, 1), color: C.primary },
    { name: "회원", value: Math.max(stats.members, 1), color: C.indigo },
  ]
  const pieTotal = stats.notices + stats.posts + stats.members

  const barData = [
    { name: "공지",   value: stats.notices, fill: C.amber   },
    { name: "게시글", value: stats.posts,   fill: C.primary },
    { name: "회원",   value: stats.members, fill: C.indigo  },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-20 pb-28 md:pt-24 md:pb-12">

      {/* ── Banner ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/8 px-5 py-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <Shield className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="font-bold leading-tight">관리자 대시보드</p>
          <p className="text-xs text-muted-foreground">PACE Admin Panel</p>
        </div>
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
          ADMIN
        </span>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Bell}
          label="총 공지사항"
          value={stats.notices}
          trend="+12%"
          trendUp
          color={C.amber}
          sparkData={spark(stats.notices || 3)}
        />
        <StatCard
          icon={Users}
          label="스케줄 회원"
          value={stats.members}
          trend="+5%"
          trendUp
          color={C.indigo}
          sparkData={spark(stats.members || 4)}
        />
        <StatCard
          icon={MessageSquare}
          label="커뮤니티 글"
          value={stats.posts}
          trend="+28%"
          trendUp
          color={C.primary}
          sparkData={spark(stats.posts || 6)}
        />
        <StatCard
          icon={CalendarClock}
          label="스케줄 상태"
          value={stats.scheduleOpen ? "오픈" : "클로즈"}
          trend={stats.scheduleOpen ? "운영중" : "중지"}
          trendUp={stats.scheduleOpen}
          color={stats.scheduleOpen ? C.primary : C.red}
          sparkData={[{ v: 1 }, { v: 2 }, { v: 1 }, { v: 3 }, { v: 2 }, { v: 4 }, { v: 2 }]}
        />
      </div>

      {/* ── Area chart + Bar chart ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ChartCard title="활동 현황 (7일)" className="md:col-span-2">
          <div className="h-52 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.primary} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gNotice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.amber} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={C.amber} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gMember" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.indigo} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={C.indigo} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: C.mutedFg, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.mutedFg, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="게시글" stroke={C.primary} strokeWidth={2} fill="url(#gPost)" dot={false} />
                <Area type="monotone" dataKey="회원"   stroke={C.indigo}  strokeWidth={2} fill="url(#gMember)" dot={false} />
                <Area type="monotone" dataKey="공지"   stroke={C.amber}   strokeWidth={2} fill="url(#gNotice)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="mt-3 flex items-center gap-4">
            {[
              { label: "게시글", color: C.primary },
              { label: "회원",   color: C.indigo  },
              { label: "공지",   color: C.amber   },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-full" style={{ background: color }} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="콘텐츠 현황">
          <div className="h-52 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal vertical={false} />
                <XAxis dataKey="name" tick={{ fill: C.mutedFg, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.mutedFg, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* ── Donut + Recent activity ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

        {/* Donut */}
        <ChartCard title="현황 분포" className="flex flex-col">
          <div className="relative mx-auto h-44 w-full max-w-[11rem]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius="52%"
                  outerRadius="72%"
                  paddingAngle={3}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs shadow">
                        <span style={{ color: (payload[0].payload as { color: string }).color }}>
                          {payload[0].name}
                        </span>
                        : <strong>{payload[0].value}</strong>
                      </div>
                    ) : null
                  }
                />
                <text
                  x="50%" y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize="20"
                  fontWeight="700"
                >
                  {pieTotal}
                </text>
                <text
                  x="50%" y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={C.mutedFg}
                  fontSize="10"
                  dy="18"
                >
                  전체
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-2">
            {pieData.map(({ name, value, color }) => (
              <div key={name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                <span className="flex-1 text-xs text-muted-foreground">{name}</span>
                <span className="text-xs font-bold">{value}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Recent activity */}
        <ChartCard title="최근 활동" className="md:col-span-2">
          <div className="divide-y divide-border">
            {notices.slice(0, 2).map((n) => (
              <RecentRow
                key={`n-${n.id}`}
                icon={Bell}
                label={n.title}
                sub={`공지 · ${n.created_at?.slice(0, 10) ?? "-"}`}
                color={C.amber}
              />
            ))}
            {posts.slice(0, 3).map((p) => (
              <RecentRow
                key={`p-${p.id}`}
                icon={MessageSquare}
                label={p.title ?? p.content?.slice(0, 40) ?? "게시글"}
                sub={`커뮤니티 · ${p.author_id ?? "-"}`}
                color={C.primary}
              />
            ))}
            {notices.length === 0 && posts.length === 0 && (
              <>
                <RecentRow icon={Bell}           label="공지사항을 등록해보세요"        sub="공지 · 데이터 없음"   color={C.amber}  />
                <RecentRow icon={MessageSquare}   label="커뮤니티 게시글이 없습니다"     sub="커뮤니티 · 데이터 없음" color={C.primary} />
                <RecentRow icon={Users}           label="스케줄 회원을 확인해보세요"     sub="스케줄 · 데이터 없음"  color={C.indigo}  />
              </>
            )}
          </div>

          {/* Schedule status pill */}
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2.5">
            {stats.scheduleOpen ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
            )}
            <p className="flex-1 text-sm font-medium">
              스케줄 입장&nbsp;
              <span className={stats.scheduleOpen ? "text-emerald-400" : "text-red-400"}>
                {stats.scheduleOpen ? "오픈" : "클로즈"}
              </span>
            </p>
            <Link
              href="/schedule"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              관리 <ChevronRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </ChartCard>
      </div>

      {/* ── Quick actions ── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          빠른 실행
        </p>
        <div className="grid grid-cols-4 gap-3">
          <QuickAction icon={Plus}          label="공지 작성"  href="/notices"   color={C.amber}   />
          <QuickAction icon={CalendarClock} label="스케줄"     href="/schedule"  color={C.primary} />
          <QuickAction icon={MessageSquare} label="커뮤니티"   href="/community" color={C.indigo}  />
          <QuickAction icon={KeyRound}      label="초대코드"   href="/schedule"  color={C.red}     />
        </div>
      </div>
    </div>
  )
}
