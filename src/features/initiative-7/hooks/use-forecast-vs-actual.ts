// Portfolio Forecast vs Actual Demand -- same fetch-on-change pattern as
// use-live-adoption.ts.

"use client"

import { useEffect, useState } from "react"

import { fetchForecastVsActual, type ForecastVsActual } from "@/features/initiative-7/services/i7-api"

export interface ForecastVsActualState {
  data: ForecastVsActual | null
  loading: boolean
  error: Error | null
}

/** GET /forecast-vs-actual for one plant (or every plant when `plant` is
 * undefined), refetched when the plant changes. */
export function useForecastVsActual(plant: string | undefined, months = 12): ForecastVsActualState {
  const [data, setData] = useState<ForecastVsActual | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Reset to "loading" during render when the plant changes, not in the effect
  // (the pattern use-live-recommendations.ts uses).
  const requestKey = `${plant ?? ""}:${months}`
  const [shownKey, setShownKey] = useState(requestKey)
  if (shownKey !== requestKey) {
    setShownKey(requestKey)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false
    fetchForecastVsActual(plant, months)
      .then((result) => {
        if (cancelled) return
        setData(result)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setData(null)
        setLoading(false)
        setError(err instanceof Error ? err : new Error("Failed to load Forecast vs Actual."))
      })
    return () => {
      cancelled = true
    }
  }, [plant, months])

  return { data, loading, error }
}
