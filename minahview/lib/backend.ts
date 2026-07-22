import { cookies } from "next/headers"

import { SESSION_COOKIE } from "@/lib/session"

const _base = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "")
const _user = process.env.BACKEND_USERNAME ?? ""
const _pass = process.env.BACKEND_PASSWORD ?? ""

export const backendBase = _base

function _authHeaders(): Record<string, string> {
  if (!_user) return {}
  const encoded = Buffer.from(`${_user}:${_pass}`).toString("base64")
  return { Authorization: `Basic ${encoded}` }
}

export function backendFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { ..._authHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  })
}

/** 검증된 세션 쿠키를 `X-Pace-Identity` 헤더로 변환 (없으면 빈 객체). */
export async function identityHeaders(): Promise<Record<string, string>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return token ? { "X-Pace-Identity": token } : {}
}

/** backendFetch + 세션 쿠키를 신원 헤더로 백엔드에 전달 (신원 필요 엔드포인트용). */
export async function backendFetchAuthed(url: string, init?: RequestInit): Promise<Response> {
  return backendFetch(url, {
    ...init,
    headers: { ...(await identityHeaders()), ...(init?.headers as Record<string, string> | undefined) },
  })
}
