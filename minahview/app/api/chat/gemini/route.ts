import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

type ChatMessage = {
  role: "user" | "model"
  text: string
}

const SYSTEM_INSTRUCTION = `당신은 Pace 헬스케어 포트폴리오 사이트의 AI 어시스턴트입니다.
반드시 한국어로 답변하세요.`

function isChatMessage(row: unknown): row is ChatMessage {
  if (row === null || typeof row !== "object") return false
  const m = row as Record<string, unknown>
  return (m.role === "user" || m.role === "model") && typeof m.text === "string"
}

function geminiErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  const lower = msg.toLowerCase()
  if (
    lower.includes("api_key_invalid") ||
    lower.includes("api key expired") ||
    lower.includes("api key not valid") ||
    lower.includes("invalid api key")
  ) {
    return (
      "Gemini API 키가 만료되었거나 잘못되었습니다. " +
      "https://aistudio.google.com/apikey 에서 새 키를 발급한 뒤 " +
      "frontend/.env.local 또는 Vercel GEMINI_API_KEY 를 갱신하고 재배포하세요."
    )
  }
  if (lower.includes("429") || lower.includes("quota") || lower.includes("resource exhausted")) {
    return "Gemini API 할당량이 초과되었습니다. 잠시 후 다시 시도해 주세요."
  }
  return msg.trim() || "Gemini 요청에 실패했습니다."
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const raw = (body as { messages?: unknown }).messages

    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ error: "messages 배열이 필요합니다." }, { status: 400 })
    }

    const messages = raw.filter(isChatMessage)
    if (messages.length !== raw.length) {
      return NextResponse.json({ error: "messages 형식이 올바르지 않습니다." }, { status: 400 })
    }

    const last = messages[messages.length - 1]
    if (last.role !== "user" || !last.text.trim()) {
      return NextResponse.json(
        { error: "마지막 메시지는 role이 user이고 text가 있어야 합니다." },
        { status: 400 },
      )
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY가 설정되지 않았습니다. frontend/.env.local(로컬) 또는 Vercel 환경 변수를 확인하세요.",
        },
        { status: 503 },
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    })

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: m.text }],
    }))

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(last.text.trim())
    const text = result.response.text()?.trim()

    if (!text) {
      return NextResponse.json({ error: "Gemini 응답이 비어 있습니다." }, { status: 502 })
    }

    return NextResponse.json({ text })
  } catch (error) {
    console.error("Gemini API Error:", error)
    return NextResponse.json({ error: geminiErrorMessage(error) }, { status: 502 })
  }
}
