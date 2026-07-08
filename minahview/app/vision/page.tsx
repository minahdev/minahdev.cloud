"use client"

import { useState } from "react"
import { ScanEye, ScanFace } from "lucide-react"

import { VisionImageUpload } from "@/components/vision-image-upload"
import { FaceRecognizePanel } from "@/components/face-recognize-panel"
import { cn } from "@/lib/utils"

type MenuKey = "upload" | "detect"

const MENU: { key: MenuKey; label: string; icon: typeof ScanEye }[] = [
  { key: "upload", label: "비전 처리", icon: ScanEye },
  { key: "detect", label: "객체탐지", icon: ScanFace },
]

export default function VisionPage() {
  const [active, setActive] = useState<MenuKey>("upload")

  return (
    <div className="px-6 pt-24 pb-14 md:pt-28 md:pb-16">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Vision
          </p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">비전 처리</h1>
          <p className="mt-2 text-muted-foreground">
            왼쪽 메뉴에서 기능을 선택하세요.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[200px_1fr]">
          {/* 좌측 메뉴 */}
          <nav className="flex gap-2 md:flex-col">
            {MENU.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActive(key)}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors md:flex-none",
                  active === key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card/40 text-muted-foreground hover:bg-card/60",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </button>
            ))}
          </nav>

          {/* 우측 패널 */}
          <div className="rounded-2xl border border-border bg-card p-6">
            {active === "upload" ? <VisionImageUpload /> : <FaceRecognizePanel />}
          </div>
        </div>
      </div>
    </div>
  )
}
