"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import {
  CalendarDays,
  Camera,
  ClipboardList,
  Film,
  Plus,
  Trash2,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  datesWithLessons,
  deleteLesson,
  lessonsForDate,
  loadLessons,
  scheduleDateKey,
  upsertLesson,
  type LessonEntry,
  type LessonMedia,
} from "@/lib/pace-schedule-storage"

const MAX_IMAGE_BYTES = 800_000
const MAX_VIDEO_BYTES = 5_000_000
const MAX_IMAGES = 4
const MAX_VIDEOS = 2

/** 다크 UI에서 type=time 기본 시계 아이콘이 검게 보이는 문제 */
const TIME_INPUT_CLASS =
  "dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer dark:[&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:opacity-90"

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."))
    reader.readAsDataURL(file)
  })
}

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `lesson-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

type SchedulePanelProps = {
  memberUserId: string
  memberLabel?: string
}

export function SchedulePanel({ memberUserId, memberLabel }: SchedulePanelProps) {
  const [lessons, setLessons] = useState<LessonEntry[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = () => {
    loadLessons(memberUserId)
      .then(setLessons)
      .catch(() => {
        setLessons([])
        setError("일정을 불러오지 못했습니다.")
      })
  }

  useEffect(() => {
    setEditingId(null)
    setError(null)
    setSaved(null)
    refresh()
    const onFocus = () => refresh()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [memberUserId])

  const selectedKey = scheduleDateKey(selectedDate)
  const dayLessons = useMemo(
    () => lessonsForDate(lessons, selectedKey),
    [lessons, selectedKey],
  )
  const loggedDates = useMemo(() => datesWithLessons(lessons), [lessons])
  const selectedLabel = format(selectedDate, "yyyy년 M월 d일 (EEE)", { locale: ko })

  const handleAddLesson = async () => {
    const entry: LessonEntry = {
      id: newId(),
      date: selectedKey,
      title: "",
      time: "10:00",
      scheduleNote: "",
      record: null,
      createdAt: new Date().toISOString(),
      memberUserId,
    }
    setEditingId(entry.id)
    try {
      await upsertLesson(entry, memberUserId)
      refresh()
    } catch {
      setError("레슨 추가에 실패했습니다.")
    }
  }

  const confirmDelete = async () => {
    if (!deleteTargetId) return
    setDeleting(true)
    setError(null)
    try {
      await deleteLesson(deleteTargetId, memberUserId)
      if (editingId === deleteTargetId) setEditingId(null)
      setDeleteTargetId(null)
      refresh()
    } catch {
      setError("삭제에 실패했습니다.")
    } finally {
      setDeleting(false)
    }
  }

  const handleScheduleSubmit = async (e: FormEvent<HTMLFormElement>, lesson: LessonEntry) => {
    e.preventDefault()
    setError(null)
    setSaved(null)
    const fd = new FormData(e.currentTarget)
    const title = String(fd.get("title") ?? "").trim()
    const time = String(fd.get("time") ?? "").trim()
    const scheduleNote = String(fd.get("scheduleNote") ?? "").trim()
    if (!title) {
      setError("레슨 제목을 입력해 주세요.")
      return
    }
    try {
      await upsertLesson({ ...lesson, title, time, scheduleNote, memberUserId }, memberUserId)
      refresh()
      setSaved("일정을 저장했습니다.")
    } catch {
      setError("일정 저장에 실패했습니다.")
    }
  }

  const handleRecordSubmit = async (e: FormEvent<HTMLFormElement>, lesson: LessonEntry) => {
    e.preventDefault()
    setError(null)
    setSaved(null)
    const fd = new FormData(e.currentTarget)
    const text = String(fd.get("recordText") ?? "").trim()
    const existing = lesson.record?.media ?? []
    const fileList = fd.getAll("mediaFiles") as File[]
    const newMedia: LessonMedia[] = [...existing]

    try {
      for (const file of fileList) {
        if (!file.size) continue
        const isVideo = file.type.startsWith("video/")
        const isImage = file.type.startsWith("image/")
        if (!isVideo && !isImage) continue
        if (isImage && file.size > MAX_IMAGE_BYTES) {
          setError(`이미지는 ${MAX_IMAGE_BYTES / 1000}KB 이하로 올려 주세요. (${file.name})`)
          return
        }
        if (isVideo && file.size > MAX_VIDEO_BYTES) {
          setError(`동영상은 ${MAX_VIDEO_BYTES / 1_000_000}MB 이하로 올려 주세요. (${file.name})`)
          return
        }
        const imageCount = newMedia.filter((m) => m.type === "image").length
        const videoCount = newMedia.filter((m) => m.type === "video").length
        if (isImage && imageCount >= MAX_IMAGES) {
          setError(`이미지는 최대 ${MAX_IMAGES}개까지입니다.`)
          return
        }
        if (isVideo && videoCount >= MAX_VIDEOS) {
          setError(`동영상은 최대 ${MAX_VIDEOS}개까지입니다.`)
          return
        }
        const dataUrl = await fileToDataUrl(file)
        newMedia.push({
          id: newId(),
          type: isVideo ? "video" : "image",
          name: file.name,
          mimeType: file.type,
          dataUrl,
        })
      }
    } catch {
      setError("미디어 파일 처리에 실패했습니다.")
      return
    }

    try {
      await upsertLesson(
        {
          ...lesson,
          memberUserId,
          record: {
            text,
            media: newMedia,
            updatedAt: new Date().toISOString(),
          },
        },
        memberUserId,
      )
      refresh()
      setSaved("레슨 기록을 저장했습니다. 나중에 복습할 수 있어요.")
    } catch {
      setError("레슨 기록 저장에 실패했습니다.")
    }
  }

  const removeMedia = async (lesson: LessonEntry, mediaId: string) => {
    if (!lesson.record) return
    try {
      await upsertLesson(
        {
          ...lesson,
          memberUserId,
          record: {
            ...lesson.record,
            media: lesson.record.media.filter((m) => m.id !== mediaId),
            updatedAt: new Date().toISOString(),
          },
        },
        memberUserId,
      )
      refresh()
    } catch {
      setError("미디어 삭제에 실패했습니다.")
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
            레슨 캘린더
          </CardTitle>
          <CardDescription>
            {memberLabel
              ? `${memberLabel} 회원의 레슨 일정입니다. 점이 있는 날에 레슨이 있습니다.`
              : "코치·회원이 같은 일정을 확인합니다. 점이 있는 날에 레슨이 있습니다."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            modifiers={{ lesson: loggedDates }}
            modifiersClassNames={{
              lesson:
                "relative font-semibold after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
            }}
            className="rounded-lg [--cell-size:--spacing(9)]"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
            onClick={() => {
              const today = new Date()
              setSelectedDate(today)
              setCalendarMonth(today)
            }}
          >
            오늘로 이동
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{selectedLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {dayLessons.length}건의 레슨 · 기록은 레슨 후 복습용으로 저장됩니다
            </p>
          </div>
          <Button type="button" size="sm" onClick={handleAddLesson} className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden />
            레슨 추가
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="text-sm text-primary">{saved}</p> : null}

        {dayLessons.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-secondary/25 px-4 py-10 text-center text-sm text-muted-foreground">
            이 날짜에 등록된 레슨이 없습니다.
            <br />
            레슨 추가로 일정과 기록을 관리해 보세요.
          </p>
        ) : null}

        {dayLessons.map((lesson) => {
          const isOpen = editingId === lesson.id
          const hasRecord = Boolean(lesson.record?.text.trim() || lesson.record?.media.length)
          return (
            <Card key={lesson.id} className="border-border/80 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{lesson.title || "(제목 없음)"}</CardTitle>
                    <CardDescription>
                      {lesson.time || "시간 미정"}
                      {hasRecord ? (
                        <Badge variant="secondary" className="ml-2">
                          기록 있음
                        </Badge>
                      ) : null}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(isOpen ? null : lesson.id)}
                    >
                      {isOpen ? "접기" : "편집"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTargetId(lesson.id)}
                      aria-label="레슨 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isOpen ? (
                <CardContent className="space-y-6 border-t border-border/60 pt-4">
                  <form
                    onSubmit={(e) => handleScheduleSubmit(e, lesson)}
                    className="space-y-4 rounded-xl border border-border/70 bg-secondary/20 p-4"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
                      일정
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`title-${lesson.id}`}>레슨 제목</Label>
                        <Input
                          id={`title-${lesson.id}`}
                          name="title"
                          defaultValue={lesson.title}
                          placeholder="예: PT 1:1 — 하체"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`time-${lesson.id}`}>시간</Label>
                        <Input
                          id={`time-${lesson.id}`}
                          name="time"
                          type="time"
                          defaultValue={lesson.time}
                          className={TIME_INPUT_CLASS}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`note-${lesson.id}`}>일정 메모 (코치·회원 공유)</Label>
                      <Textarea
                        id={`note-${lesson.id}`}
                        name="scheduleNote"
                        rows={2}
                        defaultValue={lesson.scheduleNote}
                        placeholder="준비물, 목표 부위 등"
                      />
                    </div>
                    <Button type="submit" size="sm">
                      일정 저장
                    </Button>
                  </form>

                  <form
                    onSubmit={(e) => handleRecordSubmit(e, lesson)}
                    className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Camera className="h-4 w-4 text-primary" aria-hidden />
                      레슨 기록 (복습용)
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor={`record-${lesson.id}`}>수업 내용·피드백</Label>
                      <Textarea
                        id={`record-${lesson.id}`}
                        name="recordText"
                        rows={5}
                        defaultValue={lesson.record?.text ?? ""}
                        placeholder="오늘 한 운동, 자세 교정, 다음 목표…"
                      />
                    </div>

                    {lesson.record?.media.length ? (
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {lesson.record.media.map((m) => (
                          <li
                            key={m.id}
                            className="relative overflow-hidden rounded-lg border border-border/70 bg-background"
                          >
                            {m.type === "image" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.dataUrl}
                                alt={m.name}
                                className="aspect-video w-full object-cover"
                              />
                            ) : (
                              <video
                                src={m.dataUrl}
                                controls
                                className="aspect-video w-full bg-black"
                                preload="metadata"
                              />
                            )}
                            <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                              <span className="truncate text-muted-foreground">{m.name}</span>
                              <button
                                type="button"
                                className="text-destructive hover:underline"
                                onClick={() => removeMedia(lesson, m.id)}
                              >
                                삭제
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label htmlFor={`media-${lesson.id}`}>사진·동영상 추가</Label>
                      <Input
                        id={`media-${lesson.id}`}
                        name="mediaFiles"
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        이미지 {MAX_IMAGES}장(각 800KB 이하), 동영상 {MAX_VIDEOS}개(5MB 이하). 브라우저에
                        저장되며 추후 서버 연동 예정입니다.
                      </p>
                    </div>
                    <Button type="submit" size="sm" className="gap-1.5">
                      <Film className="h-4 w-4" aria-hidden />
                      기록 저장
                    </Button>
                  </form>
                </CardContent>
              ) : hasRecord && lesson.record ? (
                <CardContent className="border-t border-border/60 pt-4 text-sm">
                  <p className="whitespace-pre-wrap text-foreground">{lesson.record.text}</p>
                  {lesson.record.media.length > 0 ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {lesson.record.media.map((m) =>
                        m.type === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={m.id}
                            src={m.dataUrl}
                            alt={m.name}
                            className="rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <video
                            key={m.id}
                            src={m.dataUrl}
                            controls
                            className="rounded-lg border border-border bg-black"
                          />
                        ),
                      )}
                    </div>
                  ) : null}
                </CardContent>
              ) : null}
            </Card>
          )
        })}
      </div>

      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTargetId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>레슨 삭제</AlertDialogTitle>
            <AlertDialogDescription>레슨을 삭제하시겠습니까? 삭제 후 복구가 불가능합니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
            >
              {deleting ? "삭제 중…" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
