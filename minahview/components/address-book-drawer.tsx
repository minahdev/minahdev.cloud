"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ContactsCsvUpload } from "@/components/contacts-csv-upload"

type Contact = { id: number; nickname: string; email: string }

export function AddressBookDrawer({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick?: (email: string) => void
}) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const loadContacts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/contacts", { cache: "no-store" })
      const data: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: string }).error)
            : "주소록을 불러오지 못했습니다.",
        )
        return
      }
      setContacts(Array.isArray(data) ? (data as Contact[]) : [])
    } catch {
      setError("주소록을 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadContacts()
  }, [open, loadContacts])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-80 flex-col sm:w-96">
        <SheetHeader>
          <div className="flex items-center justify-between gap-2">
            <SheetTitle>주소록</SheetTitle>
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
              <Plus className="size-4" aria-hidden />
              등록
            </Button>
          </div>
          <SheetDescription className="sr-only">
            주소록 목록과 CSV 등록 기능입니다.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto px-1">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>
          ) : error ? (
            <p className="px-3 py-6 text-center text-sm text-destructive">{error}</p>
          ) : contacts.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              등록된 주소록이 없습니다. 상단 &quot;등록&quot;으로 CSV를 올려보세요.
            </p>
          ) : (
            <ul className="space-y-1">
              {contacts.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick?.(c.email)
                      onOpenChange(false)
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary/50"
                  >
                    <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {c.nickname || "(이름 없음)"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>주소록 등록</DialogTitle>
            <DialogDescription>
              CSV 파일을 업로드하면 주소록에 추가됩니다. (헤더: 닉네임, 이메일)
            </DialogDescription>
          </DialogHeader>
          <ContactsCsvUpload
            onUploaded={() => {
              loadContacts()
            }}
          />
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
