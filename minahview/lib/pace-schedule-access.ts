const SCHEDULE_UNLOCK_KEY = "pace-schedule-unlocked"

export function isScheduleUnlocked(): boolean {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem(SCHEDULE_UNLOCK_KEY) === "1"
}

export function setScheduleUnlocked(): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SCHEDULE_UNLOCK_KEY, "1")
  }
}

export function clearScheduleUnlocked(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SCHEDULE_UNLOCK_KEY)
  }
}

export async function fetchScheduleAccessStatus(): Promise<{ configured: boolean }> {
  const res = await fetch("/api/schedule/access/status", { cache: "no-store" })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data && typeof (data as { error: string }).error === "string"
        ? (data as { error: string }).error
        : "접근 설정을 불러오지 못했습니다.",
    )
  }
  return data as { configured: boolean }
}

export async function fetchScheduleAdmitted(userId: string): Promise<boolean> {
  const params = new URLSearchParams({ userId })
  const res = await fetch(`/api/schedule/access/admitted?${params}`, { cache: "no-store" })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) return false
  return Boolean((data as { admitted?: boolean }).admitted)
}

export async function verifyScheduleAccessPassword(
  userId: string,
  password: string,
): Promise<void> {
  const res = await fetch("/api/schedule/access/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password }),
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data && typeof (data as { error: string }).error === "string"
        ? (data as { error: string }).error
        : "접근 암호가 올바르지 않습니다.",
    )
  }
}

export type ScheduleInviteCreated = {
  code: string
  expiresAt: string
}

export async function createScheduleInviteCode(userId: string): Promise<ScheduleInviteCreated> {
  const res = await fetch("/api/schedule/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data && typeof (data as { error: string }).error === "string"
        ? (data as { error: string }).error
        : "입장 코드 발급에 실패했습니다.",
    )
  }
  const body = data as ScheduleInviteCreated
  if (!body.code) {
    throw new Error("입장 코드 발급 응답이 올바르지 않습니다.")
  }
  return body
}

export async function redeemScheduleInviteCode(userId: string, code: string): Promise<void> {
  const res = await fetch("/api/schedule/invites/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, code }),
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data && typeof (data as { error: string }).error === "string"
        ? (data as { error: string }).error
        : "입장 코드가 올바르지 않습니다.",
    )
  }
}

export type ScheduleMember = {
  userId: string
  nickname: string
}

export async function fetchScheduleMembers(coachUserId: string): Promise<ScheduleMember[]> {
  const params = new URLSearchParams({ userId: coachUserId })
  const res = await fetch(`/api/schedule/members?${params}`, { cache: "no-store" })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data && typeof (data as { error: string }).error === "string"
        ? (data as { error: string }).error
        : "회원 목록을 불러오지 못했습니다.",
    )
  }
  const body = data as { members?: ScheduleMember[] }
  return Array.isArray(body.members) ? body.members : []
}

export async function setScheduleAccessPassword(userId: string, password: string): Promise<void> {
  const res = await fetch("/api/schedule/access/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password }),
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data && typeof (data as { error: string }).error === "string"
        ? (data as { error: string }).error
        : "접근 암호 설정에 실패했습니다.",
    )
  }
}
