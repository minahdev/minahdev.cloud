"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ImagePlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  MAX_COMMUNITY_MEDIA,
  WORKOUT_TYPE_OPTIONS,
  addCommunityPost,
  uploadCommunityMedia,
  type CommunityMediaItem,
} from "@/lib/pace-community-storage"

type PendingFile = {
  file: File
  preview: string
  kind: "image" | "video"
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  loggedInId: string | null
  onPosted: () => void
}

const ACCEPT_MEDIA = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"

function kindFromFile(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  return null
}

export function CommunityComposeDialog({
  open,
  onOpenChange,
  loggedInId,
  onPosted,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setPendingFiles((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.preview))
        return []
      })
      setError(null)
    }
  }, [open])

  useEffect(() => {
    return () => {
      pendingFiles.forEach((p) => URL.revokeObjectURL(p.preview))
    }
  }, [pendingFiles])

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    const next: PendingFile[] = []
    for (const file of Array.from(files)) {
      if (pendingFiles.length + next.length >= MAX_COMMUNITY_MEDIA) break
      const kind = kindFromFile(file)
      if (!kind) continue
      next.push({ file, preview: URL.createObjectURL(file), kind })
    }
    if (next.length) setPendingFiles((prev) => [...prev, ...next])
  }

  const removeFile = (index: number) => {
    setPendingFiles((prev) => {
      const copy = [...prev]
      URL.revokeObjectURL(copy[index].preview)
      copy.splice(index, 1)
      return copy
    })
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!loggedInId) {
      setError("게시물을 올리려면 먼저 로그인해 주세요.")
      return
    }

    const form = e.currentTarget
    const formData = new FormData(form)
    const workoutType = String(formData.get("workoutType") ?? "").trim()
    const content = String(formData.get("content") ?? "").trim()
    const distanceRaw = String(formData.get("distanceKm") ?? "").trim()
    const durationRaw = String(formData.get("durationMin") ?? "").trim()
    const caloriesRaw = String(formData.get("calories") ?? "").trim()

    if (!content && pendingFiles.length === 0) {
      setError("내용 또는 사진·동영상 중 하나는 입력해 주세요.")
      return
    }
    if (content.length > 2000) {
      setError("내용은 2000자 이하로 작성해 주세요.")
      return
    }

    const distanceKm = distanceRaw ? Number(distanceRaw) : null
    const durationMin = durationRaw ? Number(durationRaw) : null
    const calories = caloriesRaw ? Number(caloriesRaw) : null

    setSubmitting(true)
    try {
      const media: CommunityMediaItem[] = []
      for (const pending of pendingFiles) {
        media.push(await uploadCommunityMedia(pending.file))
      }
      await addCommunityPost(loggedInId, {
        workoutType,
        content,
        distanceKm: distanceKm != null && !Number.isNaN(distanceKm) ? distanceKm : null,
        durationMin: durationMin != null && !Number.isNaN(durationMin) ? durationMin : null,
        calories: calories != null && !Number.isNaN(calories) ? calories : null,
        media,
      })
      setPendingFiles((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.preview))
        return []
      })
      setFormKey((k) => k + 1)
      onPosted()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "게시물 등록에 실패했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>운동 기록 올리기</DialogTitle>
          <DialogDescription>
            {loggedInId ? (
              <>
                <span className="font-medium text-foreground">{loggedInId}</span> 님의
                오늘 운동을 공유해 보세요.
              </>
            ) : (
              <>
                로그인한 뒤 게시할 수 있습니다.{" "}
                <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                  로그인
                </Link>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="compose-workoutType">운동 종류</Label>
            <select
              id="compose-workoutType"
              name="workoutType"
              defaultValue="러닝"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {WORKOUT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="compose-distanceKm">거리(km)</Label>
              <Input
                id="compose-distanceKm"
                name="distanceKm"
                type="number"
                min={0}
                step={0.1}
                placeholder="5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-durationMin">시간(분)</Label>
              <Input
                id="compose-durationMin"
                name="durationMin"
                type="number"
                min={0}
                placeholder="30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-calories">칼로리</Label>
              <Input
                id="compose-calories"
                name="calories"
                type="number"
                min={0}
                placeholder="320"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="compose-content">내용</Label>
            <Textarea
              id="compose-content"
              name="content"
              placeholder="오늘의 운동, 느낀 점 등을 적어 주세요. (사진만 올려도 됩니다)"
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>사진 · 동영상</Label>
              <span className="text-xs text-muted-foreground">
                {pendingFiles.length}/{MAX_COMMUNITY_MEDIA}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_MEDIA}
              multiple
              className="sr-only"
              onChange={(ev) => {
                addFiles(ev.target.files)
                ev.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={!loggedInId || pendingFiles.length >= MAX_COMMUNITY_MEDIA}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              사진 또는 동영상 추가
            </Button>
            <p className="text-[11px] text-muted-foreground">
              JPG·PNG·WebP·GIF, MP4·WebM·MOV · 사진 10MB, 동영상 50MB 이하
            </p>
            {pendingFiles.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {pendingFiles.map((p, i) => (
                  <div
                    key={p.preview}
                    className="relative overflow-hidden rounded-lg border border-border/60 bg-muted/30"
                  >
                    {p.kind === "video" ? (
                      <video
                        src={p.preview}
                        className="aspect-video w-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.preview} alt="" className="aspect-video w-full object-cover" />
                    )}
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 shadow"
                      onClick={() => removeFile(i)}
                      aria-label="첨부 삭제"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={submitting || !loggedInId}>
              {submitting ? "올리는 중…" : "게시하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
