const OWM_BASE = "https://api.openweathermap.org/data/2.5/weather"
const KEY = process.env.WEATHER_API_KEY

export async function GET(req: Request) {
  if (!KEY) {
    return Response.json({ error: "날씨 API 키가 설정되지 않았습니다." }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const lat  = searchParams.get("lat")
  const lon  = searchParams.get("lon")
  const city = searchParams.get("city")

  let url: string
  if (lat && lon) {
    url = `${OWM_BASE}?lat=${lat}&lon=${lon}&appid=${KEY}&units=metric&lang=kr`
  } else if (city?.trim()) {
    url = `${OWM_BASE}?q=${encodeURIComponent(city.trim())}&appid=${KEY}&units=metric&lang=kr`
  } else {
    return Response.json({ error: "lat/lon 또는 city 파라미터가 필요합니다." }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(12_000),
    })
    const data = await res.json().catch(() => ({})) as Record<string, unknown>

    if (!res.ok) {
      return Response.json(
        { error: (data.message as string) ?? "날씨를 불러오지 못했습니다." },
        { status: res.status },
      )
    }

    const main    = data.main    as Record<string, number> | undefined
    const weather = (data.weather as { description: string; icon: string }[] | undefined)?.[0]
    return Response.json({
      city:         data.name         ?? null,
      temp_c:       main?.temp        ?? null,
      feels_like_c: main?.feels_like  ?? null,
      humidity:     main?.humidity    ?? null,
      description:  weather?.description ?? "",
      icon:         weather?.icon        ?? null,
    })
  } catch (e: unknown) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
    return Response.json(
      { error: timedOut ? "날씨 응답이 지연되고 있습니다." : "날씨를 불러오지 못했습니다." },
      { status: timedOut ? 504 : 503 },
    )
  }
}
