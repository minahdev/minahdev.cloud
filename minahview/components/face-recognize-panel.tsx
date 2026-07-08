"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImageUp, FolderOpen, ScanFace } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ALLOWED_EXTS = [".jpg", ".jpeg", ".png"]
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"])

function isImageFile(file: File) {
  const type = file.type.toLowerCase()
  if (ALLOWED_TYPES.has(type)) return true
  const name = file.name.toLowerCase()
  return ALLOWED_EXTS.some((ext) => name.endsWith(ext))
}

type Candidate = { name: string; prob: number }
type RecognizeResult = { name: string; confidence: number; top5: Candidate[] }

export function FaceRecognizePanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RecognizeResult | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const applyFile = useCallback((next: File | null) => {
    setError(null)
    setResult(null)
    if (!next) {
      setFile(null)
      return
    }
    if (!isImageFile(next)) {
      setFile(null)
      setError("jpg, jpeg, png 이미지만 올릴 수 있습니다.")
      return
    }
    setFile(next)
  }, [])

  const recognize = async () => {
    if (!file || loading) return
    setError(null)
    setLoading(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append("file", file, file.name)
      const res = await fetch("/api/vision/recognize", { method: "POST", body: form })

      const raw = await res.text()
      const json = ((): Partial<RecognizeResult> & { error?: string; detail?: string } => {
        try {
          return raw ? JSON.parse(raw) : {}
        } catch {
          return { detail: raw || undefined }
        }
      })()
      if (!res.ok) {
        setError(json.error ?? json.detail ?? "얼굴 인식에 실패했습니다.")
        return
      }
      setResult(json as RecognizeResult)
    } catch {
      setError("인식 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const openPicker = () => inputRef.current?.click()

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    applyFile(list?.length ? list[0] : null)
    e.target.value = ""
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    applyFile(e.dataTransfer.files?.[0] ?? null)
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2">
        <ScanFace className="size-5 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold text-foreground">객체 탐지 — 얼굴 인식</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        사람 얼굴 사진을 올리면 학습된 모델이 누구인지 이름을 맞춥니다.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        className="sr-only"
        aria-label="얼굴 이미지 선택"
        onChange={onInputChange}
      />

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            openPicker()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          if (e.dataTransfer.types.includes("Files")) setIsDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (e.dataTransfer.types.includes("Files")) e.dataTransfer.dropEffect = "copy"
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          const nextEl = e.relatedTarget as Node | null
          if (nextEl && e.currentTarget.contains(nextEl)) return
          setIsDragging(false)
        }}
        onDrop={onDrop}
        className={cn(
          "rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border bg-card/40 hover:border-primary/50 hover:bg-card/60",
        )}
      >
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary border border-border">
          <ImageUp className="size-6 text-primary" aria-hidden />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">얼굴 사진을 여기에 놓으세요</p>
        <p className="text-xs text-muted-foreground mb-6">jpg · jpeg · png · 드래그 앤 드롭</p>
        <Button type="button" variant="secondary" className="gap-2" onClick={openPicker}>
          <FolderOpen className="size-4" aria-hidden />
          파일 찾아서 선택
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive text-center" role="alert">
          {error}
        </p>
      ) : null}

      {file ? (
        <div className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={file.name}
              className="mb-3 max-h-64 w-full rounded-md object-contain bg-background"
            />
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" size="sm" onClick={recognize} disabled={loading}>
              {loading ? "인식 중…" : "이름 맞추기"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() => applyFile(null)}
            >
              선택 해제
            </Button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            예측 결과
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {result.name}
            <span className="ml-2 text-base font-medium text-primary">
              {(result.confidence * 100).toFixed(1)}%
            </span>
          </p>
          {result.top5?.length ? (
            <ul className="mt-3 space-y-1.5">
              {result.top5.map((c) => (
                <li key={c.name} className="flex items-center gap-2 text-sm">
                  <span className="w-32 shrink-0 truncate text-muted-foreground">{c.name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(2, c.prob * 100)}%` }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                    {(c.prob * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
