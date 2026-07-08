import { backendBase, backendFetch } from "@/lib/backend"

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "file이 필요합니다." }, { status: 400 })
  }

  const upstream = new FormData()
  upstream.append("file", file, file.name)

  try {
    const res = await backendFetch(`${backendBase}/api/vision/recognize`, {
      method: "POST",
      body: upstream,
    })

    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err =
        data && typeof data === "object" && "detail" in data
          ? String((data as any).detail ?? "얼굴 인식에 실패했습니다.")
          : "얼굴 인식에 실패했습니다."
      return Response.json({ error: err }, { status: res.status })
    }

    return Response.json(data)
  } catch (e) {
    console.error("[vision recognize]", e)
    const msg = e instanceof Error ? e.message : "unknown error"
    return Response.json({ error: `백엔드에 연결할 수 없습니다. (${msg})` }, { status: 503 })
  }
}
