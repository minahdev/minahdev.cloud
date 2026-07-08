import { backendBase, backendFetch } from "@/lib/backend"

type SendEmailBody = {
  email?: string
  topic?: string
  subject?: string
  sender_name?: string
  email_type?: string
}

function errorFromFastAPI(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback
  const b = body as { error?: string; detail?: string | { msg?: string }[] }
  if (typeof b.error === "string" && b.error.trim()) return b.error
  if (typeof b.detail === "string") return b.detail
  if (Array.isArray(b.detail)) {
    return b.detail.map((d) => d?.msg ?? "").filter(Boolean).join(", ") || fallback
  }
  return fallback
}

export async function POST(req: Request) {
  let body: SendEmailBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = body.email?.trim()
  const topic = body.topic?.trim()
  const subject = body.subject?.trim() || ""
  const senderName = body.sender_name?.trim() || ""
  const emailType = body.email_type?.trim() || "general"

  if (!email || !topic) {
    return Response.json({ error: "이메일과 주제를 모두 입력하세요." }, { status: 400 })
  }

  try {
    // star_craft(Hub) 경유 → 온톨로지가 규격을 정해 comm_agent에 위임한다.
    const res = await backendFetch(`${backendBase}/api/star_craft/compose-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, subject, sender_name: senderName, topic, email_type: emailType }),
    })

    const data: unknown = await res.json().catch(() => ({}))

    if (!res.ok) {
      return Response.json(
        { error: errorFromFastAPI(data, "메일 발송에 실패했습니다.") },
        { status: res.status },
      )
    }

    return Response.json(data)
  } catch (e) {
    console.error("[comm-agent proxy]", e)
    return Response.json(
      {
        error: "백엔드에 연결할 수 없습니다. FastAPI(uvicorn)가 실행 중인지 확인하세요.",
      },
      { status: 503 },
    )
  }
}
