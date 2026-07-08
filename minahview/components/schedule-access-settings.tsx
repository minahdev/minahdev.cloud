"use client"

import { useState } from "react"
import { KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getLoggedInUserId } from "@/lib/auth-session"
import { createScheduleInviteCode } from "@/lib/pace-schedule-access"

type ScheduleAccessSettingsProps = {
  onCodeIssued?: () => void
  className?: string
}

export function ScheduleAccessSettings({ onCodeIssued, className }: ScheduleAccessSettingsProps) {
  const [issuedCode, setIssuedCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleIssue = async () => {
    setError(null)
    setIssuedCode(null)
    setExpiresAt(null)

    const userId = getLoggedInUserId()
    if (!userId) {
      setError("로그인이 필요합니다.")
      return
    }

    setLoading(true)
    try {
      const result = await createScheduleInviteCode(userId)
      setIssuedCode(result.code)
      setExpiresAt(result.expiresAt)
      onCodeIssued?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "발급에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      className={
        className ?? "mb-8 border-dashed border-primary/30 bg-secondary/20"
      }
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden />
          회원 입장 코드
        </CardTitle>
        <CardDescription>
          로그인한 회원에게 일회용 입장 코드를 발급하세요. 회원이 스케줄 화면에서 코드를 입력하면
          레슨 스케줄에 입장할 수 있고, 코치 회원 탭에 표시됩니다. 코드는 7일 후 만료되며 1회만
          사용할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" onClick={handleIssue} disabled={loading}>
          {loading ? "발급 중…" : "입장 코드 발급"}
        </Button>

        {issuedCode ? (
          <div
            className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm"
            role="status"
          >
            <p className="font-medium text-foreground">발급된 코드 (이 화면에서만 다시 확인 가능)</p>
            <p className="mt-2 font-mono text-2xl tracking-widest text-primary">{issuedCode}</p>
            {expiresAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                만료: {new Date(expiresAt).toLocaleString("ko-KR")}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
