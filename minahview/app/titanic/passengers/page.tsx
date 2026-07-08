import Link from "next/link"
import { cache } from "react"

import { PassengerList, type PassengerPageResponse } from "@/components/passenger-list"

const PAGE_SIZE = 50

function backendBase() {
  return (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "")
}

/** 같은 페이지 요청 안에서는 1번만 호출 (React cache) */
const triggerWalterMyself = cache(async () => {
  try {
    await fetch(`${backendBase()}/titanic/walter/myself`, {
      method: "GET",
      cache: "no-store",
    })
  } catch {
    // 월터 소개 실패해도 승객 목록 화면은 유지
  }
})

async function loadPassengers(offset: number, limit: number): Promise<PassengerPageResponse> {
  const page = Math.floor(offset / limit) + 1
  return { rows: [], total: 0, page, pageSize: limit }
}

export default async function TitanicPassengersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page
  const page = Math.max(1, Number(pageRaw ?? "1") || 1)
  const offset = (page - 1) * PAGE_SIZE

  let data: PassengerPageResponse | null = null
  let error: string | null = null

  await triggerWalterMyself()

  try {
    data = await loadPassengers(offset, PAGE_SIZE)
  } catch (e) {
    error = e instanceof Error ? e.message : "목록을 불러오지 못했습니다."
  }

  return (
    <div className="px-6 pt-24 pb-14 md:pt-28 md:pb-16">
      <div className="container mx-auto max-w-5xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Lesson</p>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="text-3xl font-bold text-foreground">승객 목록</h1>
            <Link
              href="/titanic/data-collection"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              데이터 수집으로 이동
            </Link>
          </div>
          <p className="mt-2 text-muted-foreground">DB에 저장된 타이타닉 승객 데이터를 조회합니다.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : data ? (
            <PassengerList page={page} data={data} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
