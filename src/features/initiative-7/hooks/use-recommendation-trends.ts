// The recorded KPI history for one plant scope -- same fetch-on-change pattern as
// use-forecast-vs-actual.ts.

"use client"

import { useEffect, useState } from "react"

import {
  fetchRecommendationTrends,
  type RecommendationTrends,
  type TrendPlant,
} from "@/features/initiative-7/services/i7-api"

export interface RecommendationTrendsState {
  data: RecommendationTrends | null
  loading: boolean
  error: Error | null
}

/** GET /recommendations/trends for one plant scope, refetched when the scope changes. */
export function useRecommendationTrends(plant: TrendPlant): RecommendationTrendsState {
  const [data, setData] = useState<RecommendationTrends | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Back to "loading" during render when the scope changes, not in the effect.
  const [shownPlant, setShownPlant] = useState(plant)
  if (shownPlant !== plant) {
    setShownPlant(plant)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false
    fetchRecommendationTrends(plant)
      .then((result) => {
        if (cancelled) return
        setData(result)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setData(null)
        setLoading(false)
        setError(err instanceof Error ? err : new Error("Failed to load the trend history."))
      })
    return () => {
      cancelled = true
    }
  }, [plant])

  return { data, loading, error }
}
