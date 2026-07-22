export const PACE_USER_ID_KEY = "pace-user-id"
export const PACE_USER_ROLE_KEY = "pace-user-role"
export const AUTH_SESSION_EVENT = "pace-auth-change"

export function getLoggedInUserId(): string | null {
  if (typeof window === "undefined") return null
  const id = localStorage.getItem(PACE_USER_ID_KEY)?.trim()
  return id || null
}

export function getLoggedInUserRole(): string | null {
  if (typeof window === "undefined") return null
  const role = localStorage.getItem(PACE_USER_ROLE_KEY)?.trim()
  return role || null
}

function notifyAuthChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_SESSION_EVENT))
  }
}

/** API·localStorage에 저장할 역할 정규화 */
export function normalizeUserRole(role?: string | null): string {
  if (role === "admin") return "admin"
  if (role === "coach") return "coach"
  return "user"
}

export function setLoggedInUser(userId: string, role: string = "user"): void {
  localStorage.setItem(PACE_USER_ID_KEY, userId.trim())
  localStorage.setItem(PACE_USER_ROLE_KEY, normalizeUserRole(role))
  notifyAuthChange()
}

/** @deprecated setLoggedInUser 사용 */
export function setLoggedInUserId(userId: string): void {
  setLoggedInUser(userId, getLoggedInUserRole() ?? "user")
}

export function clearLoggedInUserId(): void {
  localStorage.removeItem(PACE_USER_ID_KEY)
  localStorage.removeItem(PACE_USER_ROLE_KEY)
  notifyAuthChange()
  // 서버 세션(httpOnly 쿠키)도 함께 폐기.
  if (typeof window !== "undefined") {
    void fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
  }
}

/** 마이페이지 역할 전환(회원↔코치). 성공 시 서버 세션을 다시 읽어 캐시를 갱신하고 새 role 반환. */
export async function changeMyRole(role: "user" | "coach"): Promise<string> {
  const res = await fetch("/api/mypage/role", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  })
  const data = (await res.json().catch(() => ({}))) as { role?: string; error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? "역할 변경에 실패했습니다.")
  }
  await hydrateSessionFromServer()
  return data.role ?? role
}

let _hydratePromise: Promise<void> | null = null

/**
 * 로그인 진실원은 httpOnly 세션 쿠키 → `/api/auth/me`.
 * 그 결과를 localStorage 캐시(userId·role)에 반영해 동기 UI가 계속 동작하게 한다.
 * 동시 호출은 하나의 요청으로 합친다.
 */
export function hydrateSessionFromServer(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (_hydratePromise) return _hydratePromise
  _hydratePromise = (async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" })
      if (!res.ok) {
        // 쿠키 없음/만료 → 로컬 캐시 비움
        if (localStorage.getItem(PACE_USER_ID_KEY)) {
          localStorage.removeItem(PACE_USER_ID_KEY)
          localStorage.removeItem(PACE_USER_ROLE_KEY)
          notifyAuthChange()
        }
        return
      }
      const data = (await res.json()) as { userId?: string; role?: string }
      if (data.userId) {
        localStorage.setItem(PACE_USER_ID_KEY, data.userId)
        localStorage.setItem(PACE_USER_ROLE_KEY, normalizeUserRole(data.role))
        notifyAuthChange()
      }
    } catch {
      // 네트워크 오류는 캐시 유지(무시)
    }
  })().finally(() => {
    _hydratePromise = null
  })
  return _hydratePromise
}
