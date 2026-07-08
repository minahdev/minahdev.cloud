"use client"

import Link from "next/link"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"

export type PassengerRow = {
  id: number
  passengerId: string
  survived: string
  pclass: string
  name: string
  gender: string
  age: string
  sibSp: string
  parch: string
  ticket: string
  fare: string
  cabin: string
  embarked: string
}

export type PassengerPageResponse = {
  rows: PassengerRow[]
  total: number
  page: number
  pageSize: number
}

export function PassengerList({ page, data }: { page: number; data: PassengerPageResponse }) {
  const pageSize = data.pageSize
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(data.total / pageSize)),
    [data.total, pageSize]
  )
  const pageGroup = useMemo(() => {
    const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

    const items: Array<number | "ellipsis"> = []

    if (totalPages <= 7) {
      items.push(...range(1, totalPages))
      return { items, totalPages }
    }

    if (page <= 5) {
      items.push(1, 2, 3, 4, 5, "ellipsis", totalPages)
      return { items, totalPages }
    }

    if (page >= totalPages - 4) {
      items.push(1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      return { items, totalPages }
    }

    items.push(1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages)
    return { items, totalPages }
  }, [page, totalPages])

  if (data.total === 0) {
    return <p className="text-sm text-muted-foreground">현재 등록된 승객 목록이 없습니다.</p>
  }

  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">ID</th>
              <th className="px-3 py-2 text-left font-medium">PassengerId</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Gender</th>
              <th className="px-3 py-2 text-left font-medium">Age</th>
              <th className="px-3 py-2 text-left font-medium">Pclass</th>
              <th className="px-3 py-2 text-left font-medium">Survived</th>
              <th className="px-3 py-2 text-left font-medium">Ticket</th>
              <th className="px-3 py-2 text-left font-medium">Fare</th>
              <th className="px-3 py-2 text-left font-medium">Embarked</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} className="border-t border-border/70">
                <td className="px-3 py-2">{r.id}</td>
                <td className="px-3 py-2">{r.passengerId}</td>
                <td className="px-3 py-2 truncate max-w-[18rem]" title={r.name}>
                  {r.name}
                </td>
                <td className="px-3 py-2">{r.gender}</td>
                <td className="px-3 py-2">{r.age}</td>
                <td className="px-3 py-2">{r.pclass}</td>
                <td className="px-3 py-2">{r.survived}</td>
                <td className="px-3 py-2 truncate max-w-[10rem]" title={r.ticket}>
                  {r.ticket}
                </td>
                <td className="px-3 py-2">{r.fare}</td>
                <td className="px-3 py-2">{r.embarked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          총 {data.total.toLocaleString()}명 · 페이지 {data.page.toLocaleString()} / {totalPages.toLocaleString()}
        </p>

        <nav className="flex w-full flex-wrap items-center justify-between gap-2" aria-label="승객 목록 페이지네이션">
          <Button asChild size="sm" variant="secondary" disabled={!canPrev}>
            <Link href={`/titanic/passengers?page=${page - 1}`}>이전</Link>
          </Button>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap">
            {pageGroup.items.map((it, idx) => {
              if (it === "ellipsis") {
                return (
                  <span key={`e-${idx}`} className="px-1.5 py-1 text-sm font-semibold text-muted-foreground">
                    · · ·
                  </span>
                )
              }
              const p = it
              const active = p === page
              return (
                <Link
                  key={p}
                  href={`/titanic/passengers?page=${p}`}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "min-w-6 px-1.5 py-1 text-sm font-semibold transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {p}
                </Link>
              )
            })}
          </div>

          <Button asChild size="sm" variant="secondary" disabled={!canNext}>
            <Link href={`/titanic/passengers?page=${page + 1}`}>다음</Link>
          </Button>
        </nav>
      </div>
    </div>
  )
}
