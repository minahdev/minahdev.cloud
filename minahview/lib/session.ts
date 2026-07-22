// BFF↔백엔드 공유 신원 토큰 — HMAC-SHA256 서명.
// 포맷은 백엔드 `minahai/apps/users/auth/tokens.py`와 완전 동일: `base64url(json).sig_hex`.
// Edge(middleware)에서도 쓰이므로 Node 전용 API 금지 — Web Crypto/btoa/atob만 사용.
// 비밀키는 `SESSION_SECRET` (FastAPI와 동일값이어야 검증됨).

export const SESSION_COOKIE = "pace_session"
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7일 (백엔드 SESSION_TTL_SECONDS와 동일)

export type SessionClaims = {
  sub: string
  email?: string
  ev?: boolean
  role?: string
  exp: number
}

function secretBytes(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET ?? "changeme")
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")
}

function b64urlDecode(text: string): Uint8Array {
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4))
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + pad
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes(),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

/** payload에 exp를 붙여 `body_b64.sig_hex`로 서명 (tokens.py sign_identity와 호환). */
export async function signIdentity(
  payload: Omit<SessionClaims, "exp">,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string> {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }
  const b64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(body)))
  const sig = await hmacHex(b64)
  return `${b64}.${sig}`
}

/** 서명·만료 검증 후 claims 반환. 실패 시 null (조용히 거부). */
export async function verifyIdentity(token: string): Promise<SessionClaims | null> {
  const dot = token.lastIndexOf(".")
  if (dot < 0) return null
  const b64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = await hmacHex(b64)
  if (!safeEqual(sig, expected)) return null
  let body: unknown
  try {
    body = JSON.parse(new TextDecoder().decode(b64urlDecode(b64)))
  } catch {
    return null
  }
  if (!body || typeof body !== "object") return null
  const claims = body as SessionClaims
  if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) return null
  return claims
}

/** httpOnly 세션 쿠키 옵션. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  }
}
