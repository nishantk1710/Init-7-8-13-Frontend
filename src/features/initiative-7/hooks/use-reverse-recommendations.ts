// Min-Max -> OAR recommendations: the fetch hook for the Min-Max to OAR view.
//
// The same minimal pattern as use-live-recommendations.ts (fetch on mount and whenever the params change, no
// external state library), but it keeps the previous page's data on screen while the next one loads, so paging
// and filtering dim the table instead of blanking it.

"use client"

import { useCallback, useEffect, useState } from "react"

import { fetchReverseRecommendations, type ReverseListParams } from "@/features/initiative-7/services/reverse-conversion-api"
import type { ApiReverseRecommendationsResponse } from "@/features/initiative-7/types/reverse-conversion"

export interface ReverseRecommendationsState {
  /** The latest response that arrived; null until the first one does. */
  data: ApiReverseRecommendationsResponse | null
  /** A request is in flight (data, if any, is the previous request's). */
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useReverseRecommendations(params: ReverseListParams): ReverseRecommendationsState {
  const [data, setData] = useState<ApiReverseRecommendationsResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const paramsKey = JSON.stringify(params)

  // Switch to "loading" as soon as the request key changes, during render rather than in the effect -- the
  // same derived-state approach as the live hooks (see react-hooks/set-state-in-effect).
  const [requestKey, setRequestKey] = useState(`${paramsKey}:${tick}`)
  if (requestKey !== `${paramsKey}:${tick}`) {
    setRequestKey(`${paramsKey}:${tick}`)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false
    fetchReverseRecommendations(JSON.parse(paramsKey) as ReverseListParams)
      .then((response) => {
        if (cancelled) return
        setData(response)
        setError(null)
        setLoading(false)
      })
      .catch((failure: unknown) => {
        if (cancelled) return
        setError(failure instanceof Error ? failure : new Error("Failed to load Stock item to OAR recommendations."))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [paramsKey, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { data, loading, error, refetch }
}
