import { backendBase, backendFetch } from "@/lib/backend"

export async function POST(req: Request) {
  let body: { messages?: { role: string; content: string }[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const messages = body.messages ?? []
  if (messages.length === 0) {
    return Response.json({ error: "사용자 메시지가 없습니다." }, { status: 400 })
  }

  try {
    const res = await backendFetch(`${backendBase}/api/moneyball/coach/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    })
    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      return Response.json({ error: "백엔드 오류" }, { status: res.status })
    }
    const d = data as { text?: string }
    return Response.json({ reply: d.text ?? "응답을 받지 못했습니다." })
  } catch (e) {
    console.error("[moneyball/coach/chat]", e)
    return Response.json({ error: "백엔드에 연결할 수 없습니다." }, { status: 503 })
  }
}
