"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useRef, useState } from "react"
import { Dumbbell, Shield, User } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { normalizeUserRole, setLoggedInUser } from "@/lib/auth-session"
import { cn } from "@/lib/utils"

const inputClass =
  "w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"

type SignupRole = "user" | "admin" | "coach"

function signupRedirectPath(role: SignupRole): string {
  if (role === "admin") return "/notices"
  if (role === "coach") return "/schedule"
  return "/mypage"
}

function userIdPlaceholder(role: SignupRole): string {
  if (role === "admin") return "admin_id"
  if (role === "coach") return "pace_coach"
  return "pace_user"
}

function nicknamePlaceholder(role: SignupRole): string {
  if (role === "admin") return "관리자"
  if (role === "coach") return "코치"
  return "민아"
}

type IdCheckStatus = "idle" | "checking" | "available" | "taken"

type SignupUiState = {
  submitting: boolean
  error: string | null
  idCheckStatus: IdCheckStatus
  idCheckMessage: string | null
  verifiedUserId: string | null
}

const initialUiState: SignupUiState = {
  submitting: false,
  error: null,
  idCheckStatus: "idle",
  idCheckMessage: null,
  verifiedUserId: null,
}

function SignupFormPanel({
  role,
  title,
  description,
  submitLabel,
}: {
  role: SignupRole
  title: string
  description: string
  submitLabel: string
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, setState] = useState<SignupUiState>(initialUiState)

  const resetIdCheck = () => {
    setState((prev) => ({
      ...prev,
      idCheckStatus: "idle",
      idCheckMessage: null,
      verifiedUserId: null,
    }))
  }

  const handleCheckUserId = async () => {
    const form = formRef.current
    if (!form) return

    const userId = String(new FormData(form).get("userId") ?? "").trim()
    if (!userId) {
      setState((prev) => ({
        ...prev,
        idCheckStatus: "idle",
        idCheckMessage: "아이디를 입력한 뒤 중복 확인을 해 주세요.",
        verifiedUserId: null,
      }))
      return
    }

    setState((prev) => ({
      ...prev,
      error: null,
      idCheckStatus: "checking",
      idCheckMessage: null,
      verifiedUserId: null,
    }))

    try {
      const res = await fetch(`/api/signup/check-userid?userId=${encodeURIComponent(userId)}`)
      const json = (await res.json()) as {
        available?: boolean
        message?: string
        error?: string
      }

      if (!res.ok) {
        setState((prev) => ({
          ...prev,
          idCheckStatus: "idle",
          idCheckMessage: json.error ?? "아이디 확인에 실패했습니다.",
          verifiedUserId: null,
        }))
        return
      }

      if (json.available) {
        setState((prev) => ({
          ...prev,
          idCheckStatus: "available",
          idCheckMessage: json.message ?? "사용 가능한 아이디입니다.",
          verifiedUserId: userId,
        }))
      } else {
        setState((prev) => ({
          ...prev,
          idCheckStatus: "taken",
          idCheckMessage: json.message ?? "이미 사용 중인 아이디입니다.",
          verifiedUserId: null,
        }))
      }
    } catch {
      setState((prev) => ({
        ...prev,
        idCheckStatus: "idle",
        idCheckMessage: "서버에 연결할 수 없습니다.",
        verifiedUserId: null,
      }))
    }
  }

  const handleSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setState((prev) => ({ ...prev, error: null, submitting: true }))

    const formData = new FormData(e.currentTarget)
    const entries = Object.fromEntries(formData.entries())
    const formProps = {
      userId: String(entries.userId ?? "").trim(),
      password: String(entries.password ?? ""),
      passwordConfirm: String(entries.passwordConfirm ?? ""),
      email: String(entries.email ?? "").trim(),
      nickname: String(entries.nickname ?? "").trim(),
    }

    if (state.verifiedUserId !== formProps.userId) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: "아이디 중복 확인을 완료해 주세요.",
      }))
      return
    }

    if (formProps.password !== formProps.passwordConfirm) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: "비밀번호가 일치하지 않습니다.",
      }))
      return
    }

    if (formProps.password.length < 4) {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: "비밀번호를 4자 이상 입력해 주세요.",
      }))
      return
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: formProps.userId,
          password: formProps.password,
          email: formProps.email,
          nickname: formProps.nickname,
          role,
        }),
      })
      const json = (await res.json()) as {
        message?: string
        userId?: string
        role?: string
        error?: string
      }

      if (!res.ok) {
        setState((prev) => ({
          ...prev,
          submitting: false,
          error: json.error ?? "회원가입에 실패했습니다.",
        }))
        return
      }

      const userId = json.userId ?? formProps.userId
      setLoggedInUser(userId, normalizeUserRole(json.role ?? role))
      router.push(signupRedirectPath(role))
    } catch {
      setState((prev) => ({
        ...prev,
        submitting: false,
        error: "서버에 연결할 수 없습니다. 백엔드(uvicorn) 실행 여부를 확인하세요.",
      }))
    }
  }

  const { submitting, error, idCheckStatus, idCheckMessage } = state
  const idCheckBusy = idCheckStatus === "checking"

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <form ref={formRef} className="mt-5 space-y-4" onSubmit={handleSignup}>
        <input type="hidden" name="role" value={role} />

        <div>
          <label htmlFor={`signup-user-id-${role}`} className="mb-2 block text-sm font-medium text-foreground">
            아이디
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id={`signup-user-id-${role}`}
              name="userId"
              autoComplete="username"
              required
              disabled={submitting || idCheckBusy}
              className={inputClass}
              placeholder={userIdPlaceholder(role)}
              onInput={resetIdCheck}
            />
            <button
              type="button"
              onClick={handleCheckUserId}
              disabled={submitting || idCheckBusy}
              className="shrink-0 rounded-xl border border-primary/50 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
            >
              {idCheckBusy ? "확인 중…" : "중복 확인"}
            </button>
          </div>
          {idCheckMessage ? (
            <p
              className={cn(
                "mt-2 text-sm",
                idCheckStatus === "available" ? "text-primary" : "text-destructive",
              )}
              role="status"
            >
              {idCheckMessage}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`signup-password-${role}`} className="mb-2 block text-sm font-medium text-foreground">
            비밀번호
          </label>
          <input
            type="password"
            id={`signup-password-${role}`}
            name="password"
            autoComplete="new-password"
            required
            minLength={4}
            disabled={submitting}
            className={inputClass}
            placeholder="••••••••"
          />
        </div>

        <div>
          <label
            htmlFor={`signup-password-confirm-${role}`}
            className="mb-2 block text-sm font-medium text-foreground"
          >
            비밀번호 확인
          </label>
          <input
            type="password"
            id={`signup-password-confirm-${role}`}
            name="passwordConfirm"
            autoComplete="new-password"
            required
            minLength={4}
            disabled={submitting}
            className={inputClass}
            placeholder="비밀번호를 다시 입력"
          />
        </div>

        <div>
          <label htmlFor={`signup-email-${role}`} className="mb-2 block text-sm font-medium text-foreground">
            이메일
          </label>
          <input
            type="email"
            id={`signup-email-${role}`}
            name="email"
            autoComplete="email"
            required
            disabled={submitting}
            className={inputClass}
            placeholder="example@pace.dev"
          />
        </div>

        <div>
          <label htmlFor={`signup-nickname-${role}`} className="mb-2 block text-sm font-medium text-foreground">
            닉네임
          </label>
          <input
            type="text"
            id={`signup-nickname-${role}`}
            name="nickname"
            autoComplete="nickname"
            required
            disabled={submitting}
            className={inputClass}
            placeholder={nicknamePlaceholder(role)}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || idCheckBusy}
          className="w-full rounded-xl bg-primary py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting ? "처리 중…" : submitLabel}
        </button>
      </form>
    </div>
  )
}

export default function SignupPage() {
  return (
    <div className="pb-16 pt-28 md:pt-32">
      <div className="container mx-auto max-w-md px-6">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-foreground">회원가입</h1>
          <p className="text-muted-foreground">회원·코치·관리자 중 역할을 선택해 가입하세요</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <Tabs defaultValue="user" className="w-full">
            <TabsList className="mb-6 grid h-auto w-full grid-cols-3 gap-1 p-1">
              <TabsTrigger value="user" className="gap-1 py-2 text-xs sm:gap-1.5 sm:py-2.5 sm:text-sm">
                <User className="h-4 w-4 shrink-0" aria-hidden />
                회원
              </TabsTrigger>
              <TabsTrigger value="coach" className="gap-1 py-2 text-xs sm:gap-1.5 sm:py-2.5 sm:text-sm">
                <Dumbbell className="h-4 w-4 shrink-0" aria-hidden />
                코치
              </TabsTrigger>
              <TabsTrigger value="admin" className="gap-1 py-2 text-xs sm:gap-1.5 sm:py-2.5 sm:text-sm">
                <Shield className="h-4 w-4 shrink-0" aria-hidden />
                관리자
              </TabsTrigger>
            </TabsList>

            <TabsContent value="user">
              <SignupFormPanel
                role="user"
                title="회원 가입"
                description="훈련 기록·분석·커뮤니티 등 일반 기능을 이용합니다."
                submitLabel="회원으로 가입하기"
              />
            </TabsContent>

            <TabsContent value="coach">
              <SignupFormPanel
                role="coach"
                title="코치 가입"
                description="레슨 스케줄·회원 훈련 기록을 관리합니다. 가입 후 스케줄 탭에서 일정을 등록할 수 있어요."
                submitLabel="코치로 가입하기"
              />
            </TabsContent>

            <TabsContent value="admin">
              <SignupFormPanel
                role="admin"
                title="관리자 가입"
                description="공지사항 등록·관리 권한이 부여됩니다. 가입 후 공지사항에서 확인하세요."
                submitLabel="관리자로 가입하기"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
