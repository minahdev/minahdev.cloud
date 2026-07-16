import { backendBase, backendFetch } from "@/lib/backend"

export async function POST(req: Request) {
  let body: { site?: string; command?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  try {
    // NOTE: 현재 백엔드 /star_craft/scrape 는 crawled.jsonl 을 읽어 스크래핑하며
    // 요청 바디를 사용하지 않는다. site·command 전달은 백엔드 반영(다음 작업)
    // 이후 유효해진다.
    const res = await backendFetch(`${backendBase}/api/star_craft/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const d = data as { detail?: string }
      return Response.json({ error: d.detail ?? "백엔드 오류" }, { status: res.status })
    }
    return Response.json(data)
  } catch (e) {
    console.error("[star-craft/scrape]", e)
    return Response.json({ error: "백엔드에 연결할 수 없습니다." }, { status: 503 })
  }
}
