"use client"

import { useState } from "react"
import { Bot, Globe, Loader2, Play } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Mode = "crawler" | "scraper"

const COPY: Record<
  Mode,
  { title: string; desc: string; endpoint: string; keywordHint: string }
> = {
  crawler: {
    title: "크롤러",
    desc: "시드 URL에서 링크를 따라가며 키워드에 맞는 페이지 URL을 수집합니다.",
    endpoint: "/api/star-craft/crawl",
    keywordHint: "예) 테란,저그,프로토스",
  },
  scraper: {
    title: "스크래퍼",
    desc: "수집한 URL에 접속해 제목·본문 텍스트를 추출합니다. (크롤 결과를 대상으로 실행)",
    endpoint: "/api/star-craft/scrape",
    keywordHint: "예) 테란,저그,프로토스",
  },
}

function ModePanel({ mode }: { mode: Mode }) {
  const meta = COPY[mode]
  const [site, setSite] = useState("")
  const [keywords, setKeywords] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (loading) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch(meta.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: site.trim(), keywords: keywords.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "실행에 실패했습니다.")
      } else {
        setResult(JSON.stringify(data, null, 2))
      }
    } catch {
      setError("서버에 연결할 수 없습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{meta.desc}</p>

      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Globe className="h-3.5 w-3.5" aria-hidden />
          사이트 주소
        </label>
        <input
          type="url"
          value={site}
          onChange={(e) => setSite(e.target.value)}
          placeholder="https://example.com"
          className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background"
        />
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Bot className="h-3.5 w-3.5" aria-hidden />
          키워드 (콤마로 구분)
        </label>
        <textarea
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder={meta.keywordHint}
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background"
        />
      </div>

      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Play className="h-4 w-4" aria-hidden />
        )}
        {meta.title} 실행
      </button>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {result && (
        <pre className="overflow-x-auto rounded-lg border border-border bg-secondary/40 p-3 text-xs text-foreground">
          {result}
        </pre>
      )}
    </div>
  )
}

export function StarCraftConsole({ defaultTab }: { defaultTab: Mode }) {
  const [tab, setTab] = useState<Mode>(defaultTab)

  return (
    <div className="px-6 pt-24 pb-14 md:pt-28 md:pb-16">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Star Craft
          </p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">크롤러 / 스크래퍼</h1>
          <p className="mt-2 text-muted-foreground">
            탭을 눌러 크롤러와 스크래퍼를 전환합니다.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="crawler">크롤러</TabsTrigger>
            <TabsTrigger value="scraper">스크래퍼</TabsTrigger>
          </TabsList>

          <div className="mt-4 rounded-2xl border border-border bg-card p-6">
            <TabsContent value="crawler">
              <ModePanel mode="crawler" />
            </TabsContent>
            <TabsContent value="scraper">
              <ModePanel mode="scraper" />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
