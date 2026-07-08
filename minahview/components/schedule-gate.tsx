"use client"

import { FormEvent, useState } from "react"
import { LockKeyhole } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getLoggedInUserId } from "@/lib/auth-session"
import {
  redeemScheduleInviteCode,
  setScheduleUnlocked,
} from "@/lib/pace-schedule-access"

type ScheduleGateProps = {
  onUnlocked: () => void
}

export function ScheduleGate({ onUnlocked }: ScheduleGateProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const userId = getLoggedInUserId()
    if (!userId) {
      setError("로그인이 필요합니다.")
      setLoading(false)
      return
    }
    try {
      await redeemScheduleInviteCode(userId, code)
      setScheduleUnlocked()
      onUnlocked()
    } catch (err) {
      setError(err instanceof Error ? err.message : "입장 코드 확인에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <LockKeyhole className="h-5 w-5 text-primary" aria-hidden />
          스케줄 입장
        </CardTitle>
        <CardDescription>
          코치에게 받은 입장 코드를 입력하면 레슨 스케줄을 이용할 수 있습니다. 로그인한 회원만
          사용할 수 있으며, 코드는 일반적으로 1회만 사용됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-invite-code">입장 코드</Label>
            <Input
              id="schedule-invite-code"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="예: A1B2C3D4"
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "확인 중…" : "입장"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
