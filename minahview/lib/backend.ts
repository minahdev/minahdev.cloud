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
