"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Cloud, Loader2, MapPin, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type WeatherData = {
  city: string
  temp_c: number | null
  feels_like_c: number | null
  humidity: number | null
  description: string
  icon: string | null
}

type CurrentWeatherProps = {
  className?: string
  variant?: "default" | "compact" | "header"
  /** 위치 권한 실패 시 표시할 기본 도시 */
  fallbackCity?: string
  /** 메인 등에서 카드 내용 가운데 정렬 */
  centered?: boolean
}

export function CurrentWeather({
  className,
  variant = "default",
  fallbackCity = "Seoul",
  centered = false,
}: CurrentWeatherProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)
  const fetchPriorityRef = useRef(0)
  // cleanup: useEffect가 재실행될 때(StrictMode 포함) 인-플라이트 fetch를 중단한다
  const abortFnsRef = useRef<Array<() => void>>([])

  const compact = variant === "compact"
  const header = variant === "header"

  const fetchWeather = useCallback(
    (url: string, opts?: { keepPrevious?: boolean; priority?: number }) => {
      const priority = opts?.priority ?? 0
      if (!opts?.keepPrevious) {
        setLoading(true)
      }
      setError(null)

      const controller = new AbortController()
      let isCleanupAbort = false
      const abort = () => { isCleanupAbort = true; controller.abort() }
      abortFnsRef.current.push(abort)

      const timer = window.setTimeout(() => controller.abort(), 12_000)

      return fetch(url, { signal: controller.signal })
        .then(async (res) => {
          const data = (await res.json()) as WeatherData & { error?: string; detail?: string }
          if (!res.ok) {
            throw new Error(data.error ?? data.detail ?? "날씨를 불러오지 못했습니다.")
          }
          if (priority >= fetchPriorityRef.current) {
            fetchPriorityRef.current = priority
            setWeather(data)
            setError(null)
          }
        })
        .catch((e: unknown) => {
          if (isCleanupAbort) return
          if (priority < fetchPriorityRef.current) return
          if (!opts?.keepPrevious) {
            setWeather(null)
          }
          if (e instanceof Error && e.name === "AbortError") {
            setError("날씨 응답이 지연되고 있습니다. 잠시 후 새로고침해 주세요.")
          } else {
            setError(e instanceof Error ? e.message : "날씨를 불러오지 못했습니다.")
          }
        })
        .finally(() => {
          window.clearTimeout(timer)
          abortFnsRef.current = abortFnsRef.current.filter((fn) => fn !== abort)
          setLoading(false)
        })
    },
    [],
  )

  const loadWeather = useCallback(
    (lat: number, lon: number) => {
      setUsingFallback(false)
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
      })
      return fetchWeather(`/api/weather?${params}`, { keepPrevious: true, priority: 1 })
    },
    [fetchWeather],
  )

  const loadWeatherByCity = useCallback(
    (city: string, asFallback = false) => {
      setUsingFallback(asFallback)
      const params = new URLSearchParams({ city })
      return fetchWeather(`/api/weather?${params}`, { priority: 0 })
    },
    [fetchWeather],
  )

  const requestLocation = useCallback(() => {
    fetchPriorityRef.current = 0
    setError(null)
    setLoading(true)

    if (fallbackCity) {
      void loadWeatherByCity(fallbackCity, true)
    }

    if (!navigator.geolocation) {
      if (!fallbackCity) {
        setError("이 브라우저는 위치 정보를 지원하지 않습니다.")
        setLoading(false)
      }
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUsingFallback(false)
        void loadWeather(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        if (!fallbackCity) {
          setLoading(false)
          setError("위치 권한이 필요합니다. 브라우저에서 위치 허용 후 다시 시도해 주세요.")
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }, [fallbackCity, loadWeather, loadWeatherByCity])

  useEffect(() => {
    requestLocation()
    return () => {
      abortFnsRef.current.forEach((fn) => fn())
      abortFnsRef.current = []
    }
  }, [requestLocation])

  const temp =
    weather?.temp_c != null ? `${Math.round(weather.temp_c)}°C` : "—"
  const iconUrl =
    weather?.icon != null
      ? `https://openweathermap.org/img/wn/${weather.icon}@2x.png`
      : null

  if (header) {
    return (
      <section
        className={cn(
          "inline-flex h-9 w-fit max-w-[18rem] min-w-0 items-center gap-1.5 rounded-xl border border-border/50 bg-card/50 px-2 sm:h-10 sm:gap-2 sm:px-2.5 md:h-11",
          className,
        )}
        aria-label="현재 위치 날씨"
      >
        {loading && !weather ? (
          <>
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            <span className="truncate text-[10px] text-muted-foreground sm:text-xs">날씨 불러오는 중…</span>
          </>
        ) : null}

        {error && !weather && !loading ? (
          <>
            <span className="min-w-0 flex-1 truncate text-[10px] text-destructive sm:text-xs">{error}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              onClick={requestLocation}
              aria-label="날씨 새로고침"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          </>
        ) : null}

        {weather && !error ? (
          <>
            {iconUrl ? (
              <img src={iconUrl} alt="" width={32} height={32} className="size-7 shrink-0 sm:size-8" />
            ) : (
              <Cloud className="size-7 shrink-0 text-primary/70 sm:size-8" aria-hidden />
            )}
            <div className="min-w-0 flex-1 text-left leading-tight">
              <p className="flex items-baseline gap-1 truncate">
                <span className="text-sm font-semibold tabular-nums text-foreground sm:text-base">{temp}</span>
                <span className="truncate text-[10px] capitalize text-muted-foreground sm:text-xs">
                  {weather.description}
                </span>
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {weather.city}
                {weather.humidity != null ? ` · ${weather.humidity}%` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              onClick={requestLocation}
              disabled={loading}
              aria-label="날씨 새로고침"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </>
        ) : null}
      </section>
    )
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/60 bg-card/60 shadow-sm backdrop-blur-md",
        compact ? "h-fit px-3 py-2 sm:min-w-[11.5rem]" : "mt-4 px-4 py-3",
        centered && "text-center",
        className,
      )}
      aria-label="현재 위치 날씨"
    >
      {centered ? (
        <div className="flex items-center justify-center gap-2">
          <MapPin className={cn("shrink-0 text-primary", compact ? "size-3.5" : "size-4")} aria-hidden />
          <h2 className={cn("font-medium leading-none text-foreground", compact ? "text-xs" : "text-sm")}>
            {compact ? "오늘의 날씨" : "현재 위치 날씨"}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            onClick={requestLocation}
            disabled={loading}
            aria-label="날씨 새로고침"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "flex w-full items-center justify-between gap-2",
            compact && "gap-1.5",
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <MapPin className={cn("shrink-0 text-primary", compact ? "size-3.5" : "size-4")} aria-hidden />
            <h2 className={cn("font-medium leading-none text-foreground", compact ? "text-xs" : "text-sm")}>
              {compact ? "오늘의 날씨" : "현재 위치 날씨"}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("shrink-0 text-muted-foreground", compact ? "size-7" : "size-8")}
            onClick={requestLocation}
            disabled={loading}
            aria-label="날씨 새로고침"
          >
            <RefreshCw className={cn(compact ? "size-3.5" : "size-4", loading && "animate-spin")} />
          </Button>
        </div>
      )}

      {loading && !weather && (
        <div
          className={cn(
            "flex items-center gap-2 text-muted-foreground",
            compact ? "mt-1.5 text-xs" : "mt-3 text-sm",
          )}
        >
          <Loader2 className={cn("animate-spin", compact ? "size-3.5" : "size-4")} aria-hidden />
          불러오는 중…
        </div>
      )}

      {error && !loading && (
        <div className={cn("space-y-2", compact ? "mt-1.5" : "mt-3")}>
          <p className={cn("text-destructive", compact ? "text-xs leading-snug" : "text-sm")}>{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={compact ? "h-7 text-xs" : undefined}
            onClick={requestLocation}
          >
            다시 시도
          </Button>
        </div>
      )}

      {weather && !error && (
        <div
          className={cn(
            "flex items-center",
            centered && "justify-center",
            compact ? "mt-1.5 gap-1.5" : "mt-3 gap-4",
          )}
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              width={compact ? 36 : 56}
              height={compact ? 36 : 56}
              className={cn("shrink-0", compact ? "size-9" : "size-14")}
            />
          ) : (
            <Cloud
              className={cn("shrink-0 text-primary/70", compact ? "size-9" : "size-14")}
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <p
              className={cn(
                "font-semibold tabular-nums text-foreground",
                compact ? "text-xl leading-none" : "text-2xl",
              )}
            >
              {temp}
            </p>
            <p className={cn("capitalize text-muted-foreground", compact ? "text-xs" : "text-sm")}>
              {weather.description}
            </p>
            <p className={cn("text-muted-foreground", compact ? "mt-0.5 text-[10px] leading-tight" : "mt-1 text-xs")}>
              <span className="font-medium text-foreground/90">{weather.city}</span>
              {usingFallback && (
                <span className="text-muted-foreground/80"> · 위치 미허용</span>
              )}
              {!compact && weather.humidity != null && (
                <>
                  {" · "}
                  습도 {weather.humidity}%
                </>
              )}
              {!compact && weather.feels_like_c != null && (
                <>
                  {" · "}
                  체감 {Math.round(weather.feels_like_c)}°C
                </>
              )}
              {compact && weather.humidity != null && (
                <>
                  {" · "}
                  {weather.humidity}%
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
