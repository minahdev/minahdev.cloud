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

export function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = (searchParams.get("from") ?? "/mypage").trim() || "/mypage"

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

