"use client"

import { useCallback, useRef, useState } from "react"
import { FileUp, FolderOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function isCsvFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".csv")) return false
  const type = file.type.toLowerCase()
  if (!type) return true
  const allowed = new Set([
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "application/octet-stream",
  ])
  return allowed.has(type)
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function TitanicCsvUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedCount, setUploadedCount] = useState<number | null>(null)

  const applyFile = useCallback((next: File | null) => {
    setError(null)
    setUploadedCount(null)
    if (!next) {
      setFile(null)
      return
    }
    if (!isCsvFile(next)) {
      setFile(null)
      setError("CSV 파일(.csv)만 업로드할 수 있습니다.")
      return
    }
    setFile(next)
  }, [])

  const uploadFile = async () => {
    if (!file || uploading) return
    setError(null)
    setUploading(true)
    setUploadedCount(null)
    try {
      const form = new FormData()
      form.append("file", file, file.name)
      // Use same-origin proxy to avoid CORS/network issues in the browser.
      const res = await fetch("/api/titanic/james/upload", { method: "POST", body: form })

      const raw = await res.text()
      const json = ((): {
        saved?: number
        received?: number
        error?: string
        detail?: string
      } => {
        try {
          return raw ? (JSON.parse(raw) as any) : {}
        } catch {
          return { detail: raw || undefined }
        }
      })()
      if (!res.ok) {
        setError(json.error ?? json.detail ?? "업로드에 실패했습니다.")
        return
      }
      const count =
        typeof json.saved === "number"
          ? json.saved
          : typeof json.received === "number"
            ? json.received
            : null
      setUploadedCount(count)
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
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="CSV 파일 선택"
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
          <FileUp className="size-6 text-primary" aria-hidden />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">CSV를 여기에 놓으세요</p>
        <p className="text-xs text-muted-foreground mb-6">드래그 앤 드롭으로 업로드</p>
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
          <p className="font-medium text-foreground truncate" title={file.name}>
            {file.name}
          </p>
          <p className="text-muted-foreground text-xs mt-1">{formatBytes(file.size)}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Button type="button" size="sm" onClick={uploadFile} disabled={uploading}>
              {uploading ? "업로드 중…" : "업로드"}
            </Button>
            {uploadedCount != null ? (
              <p className="text-xs text-muted-foreground">총 {uploadedCount.toLocaleString()}건 업로드됨</p>
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
