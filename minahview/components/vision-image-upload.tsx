"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImageUp, FolderOpen } from "lucide-react"

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

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

type UploadResult = { filename: string; content_type: string; size: number; message: string }

export function VisionImageUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)

  // 미리보기 objectURL 정리
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
      setError("jpg, jpeg, png 이미지만 업로드할 수 있습니다.")
      return
    }
    setFile(next)
  }, [])

  const uploadFile = async () => {
    if (!file || uploading) return
    setError(null)
    setUploading(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append("file", file, file.name)
      // 브라우저 CORS 회피 위해 same-origin 프록시 사용.
      const res = await fetch("/api/vision/upload", { method: "POST", body: form })

      const raw = await res.text()
      const json = ((): Partial<UploadResult> & { error?: string; detail?: string } => {
        try {
          return raw ? JSON.parse(raw) : {}
        } catch {
          return { detail: raw || undefined }
        }
      })()
      if (!res.ok) {
        setError(json.error ?? json.detail ?? "업로드에 실패했습니다.")
        return
      }
      setResult(json as UploadResult)
    } catch {
      setError("업로드 중 오류가 발생했습니다.")
    } finally {
      setUploading(false)
    }
  }

  const openPicker = () => {
    inputRef.current?.click()
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    applyFile(list?.length ? list[0] : null)
    e.target.value = ""
  }

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes("Files")) e.dataTransfer.dropEffect = "copy"
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setIsDragging(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    applyFile(dropped ?? null)
  }

  return (
    <div className="w-full space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        className="sr-only"
        aria-label="이미지 파일 선택"
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
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "mx-auto max-w-2xl rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring sm:px-6 sm:py-10",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border bg-card/40 hover:border-primary/50 hover:bg-card/60",
        )}
      >
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-secondary border border-border">
          <ImageUp className="size-6 text-primary" aria-hidden />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">이미지를 여기에 놓으세요</p>
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
          <p className="font-medium text-foreground truncate" title={file.name}>
            {file.name}
          </p>
          <p className="text-muted-foreground text-xs mt-1">{formatBytes(file.size)}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Button type="button" size="sm" onClick={uploadFile} disabled={uploading}>
              {uploading ? "업로드 중…" : "업로드"}
            </Button>
            {result ? (
              <p className="text-xs text-muted-foreground">
                {result.message} ({formatBytes(result.size)})
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-8 px-2 text-xs text-muted-foreground"
            onClick={() => applyFile(null)}
          >
            선택 해제
          </Button>
        </div>
      ) : null}
    </div>
  )
}
