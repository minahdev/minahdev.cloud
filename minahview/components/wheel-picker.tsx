"use client"

import { useEffect, useRef } from "react"

/** 항목 높이(px) — 스크롤 위치로 중앙값을 계산하므로 CSS와 반드시 같아야 한다. */
const ITEM_H = 44
/** 보이는 항목 수(홀수) — 가운데 한 줄이 선택값이다. */
const VISIBLE = 5
const PAD = ((VISIBLE - 1) / 2) * ITEM_H

const DEFAULT_BIRTH = "20000101"
const MIN_YEAR = 1920

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

function Column({
  values,
  value,
  onChange,
  suffix,
  label,
}: {
  values: number[]
  value: number
  onChange: (v: number) => void
  suffix: string
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)
  const index = values.indexOf(value)

  // 값이 바뀌면(외부 변경 포함) 해당 항목이 가운데 오도록 맞춘다.
  useEffect(() => {
    const el = ref.current
    if (!el || index < 0) return
    const target = index * ITEM_H
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target
  }, [index])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  // 스크롤이 멎은 뒤에만 값을 확정한다 (드래그 중 매 프레임 갱신 방지).
  const handleScroll = () => {
    const el = ref.current
    if (!el) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)))
      const next = values[i]
      if (next !== undefined && next !== value) onChange(next)
    }, 100)
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      aria-label={label}
      className="flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ height: VISIBLE * ITEM_H, scrollPaddingTop: PAD }}
    >
      <div style={{ paddingTop: PAD, paddingBottom: PAD }}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{ height: ITEM_H }}
            className={`flex w-full snap-center items-center justify-center text-base tabular-nums transition-colors ${
              v === value ? "font-semibold text-foreground" : "text-muted-foreground/60"
            }`}
          >
            {v}
            <span className="ml-1 text-xs">{suffix}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** 생년월일 휠 피커. value·onChange 는 YYYYMMDD 8자리 문자열. */
export function WheelPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const digits = value.replace(/\D/g, "")
  const current = digits.length === 8 ? digits : DEFAULT_BIRTH

  const year = Number(current.slice(0, 4))
  const month = Number(current.slice(4, 6))
  const day = Number(current.slice(6, 8))

  // 값이 비어 있으면 기본값을 즉시 확정한다 — 화면에 보이는 값과 저장될 값을 일치시킨다.
  useEffect(() => {
    if (digits.length !== 8) onChange(DEFAULT_BIRTH)
  }, [digits, onChange])

  const years = range(MIN_YEAR, new Date().getFullYear())
  const months = range(1, 12)
  const days = range(1, daysInMonth(year, month))

  // 월이 짧아지면 일이 넘칠 수 있다 (예: 3/31 → 2월).
  const emit = (y: number, m: number, d: number) => {
    onChange(`${y}${pad2(m)}${pad2(Math.min(d, daysInMonth(y, m)))}`)
  }

  return (
    <div className="relative rounded-xl border border-border bg-secondary/50">
      {/* 가운데 선택 영역 표시 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-lg border border-primary/40 bg-primary/10"
        style={{ height: ITEM_H }}
      />
      <div className="relative flex">
        <Column
          label="년"
          suffix="년"
          values={years}
          value={year}
          onChange={(y) => emit(y, month, day)}
        />
        <Column
          label="월"
          suffix="월"
          values={months}
          value={month}
          onChange={(m) => emit(year, m, day)}
        />
        <Column
          label="일"
          suffix="일"
          values={days}
          value={Math.min(day, days.length)}
          onChange={(d) => emit(year, month, d)}
        />
      </div>
    </div>
  )
}
