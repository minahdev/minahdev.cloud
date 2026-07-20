"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { type FormEvent, useState } from "react"

import { normalizeUserRole, setLoggedInUser } from "@/lib/auth-session"

type LoginResponse = {
  message?: string
  userId?: string
  role?: string
  error?: string
}

const inputClass =
  "w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"

// 브라우저에서 백엔드 OAuth로 직접 이동 → 빌드타임 공개 변수 필요.
const PUBLIC_BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "")

const socialProviders = [
  { id: "naver", label: "네이버로 로그인", className: "bg-[#03C75A] text-white hover:bg-[#03C75A]/90" },
  { id: "kakao", label: "카카오로 로그인", className: "bg-[#FEE500] text-black/85 hover:bg-[#FEE500]/90" },
  {
    id: "google",
    label: "Google로 로그인",
    className: "bg-white text-neutral-800 border border-neutral-300 hover:bg-neutral-50",
  },
] as const

const OAUTH_ERRORS: Record<string, string> = {
  provider_not_configured: "해당 소셜 로그인이 아직 설정되지 않았습니다.",
  unknown_provider: "지원하지 않는 로그인 방식입니다.",
  invalid_state: "인증 세션이 만료되었습니다. 다시 시도해주세요.",
  provider_denied: "소셜 로그인이 취소되었습니다.",
  oauth_failed: "소셜 로그인에 실패했습니다. 다시 시도해주세요.",
}

export function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = (searchParams.get("from") ?? "/mypage").trim() || "/mypage"
  const oauthError = searchParams.get("error")
  const oauthErrorMsg = oauthError ? (OAUTH_ERRORS[oauthError] ?? "로그인 중 오류가 발생했습니다.") : null

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(oauthErrorMsg)

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const userId = String(formData.get("userId") ?? "").trim()
    const password = String(formData.get("password") ?? "")

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password }),
      })
      const json = (await res.json()) as LoginResponse
      if (!res.ok) {
        setError(json.error ?? "로그인에 실패했습니다.")
        return
      }
      const loggedInId = (json.userId ?? userId).trim()
      const role = normalizeUserRole(json.role)
      setLoggedInUser(loggedInId, role)
      router.replace(from)
    } catch {
      setError("서버에 연결할 수 없습니다. 백엔드(uvicorn) 실행 여부를 확인하세요.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pb-16 pt-28 md:pt-32">
      <div className="container mx-auto max-w-md px-6">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-foreground">로그인</h1>
          <p className="text-muted-foreground">아이디와 비밀번호로 로그인하세요</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label htmlFor="login-user-id" className="mb-2 block text-sm font-medium text-foreground">
                아이디
              </label>
              <input
                id="login-user-id"
                name="userId"
                type="text"
                autoComplete="username"
                required
                disabled={submitting}
                className={inputClass}
                placeholder="pace_user"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-foreground">
                비밀번호
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={submitting}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-primary py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "로그인 중…" : "로그인"}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative mb-4 text-center">
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border" aria-hidden />
              <span className="relative z-10 bg-card px-3 text-xs text-muted-foreground">또는 소셜 계정으로</span>
            </div>
            <div className="space-y-2">
              {socialProviders.map((provider) => (
                <a
                  key={provider.id}
                  href={`${PUBLIC_BACKEND}/auth/${provider.id}/login`}
                  className={`flex w-full items-center justify-center rounded-xl py-3 text-sm font-medium transition-colors ${provider.className}`}
                >
                  {provider.label}
                </a>
              ))}
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            계정이 없나요?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              회원가입
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

