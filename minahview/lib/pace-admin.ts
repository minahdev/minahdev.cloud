import { getLoggedInUserId, getLoggedInUserRole } from "@/lib/auth-session"

/** 레거시: 아이디 목록으로도 관리자 인정 (env) */
const DEFAULT_ADMIN_IDS = ["admin", "pace_admin"]

function adminIdList(): string[] {
  const fromEnv = process.env.NEXT_PUBLIC_PACE_ADMIN_USER_IDS?.trim()
  if (fromEnv) {
    return fromEnv
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  }
  return DEFAULT_ADMIN_IDS
}

export function isNoticeAdmin(userId: string | null, role: string | null): boolean {
  if (role === "admin") return true
  if (!userId) return false
  return adminIdList().includes(userId)
}

export function canManageNotices(): boolean {
  return isNoticeAdmin(getLoggedInUserId(), getLoggedInUserRole())
}
