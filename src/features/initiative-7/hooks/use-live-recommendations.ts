// Part 21 — I07 frontend/backend integration.
//
// Thin data-fetching hooks over services/i7-api.ts. This app has no existing
// fetch/loading/error precedent (I07/I08/I13 are all mock-only today -- see
// the Part 21 audit) so these introduce the minimal pattern needed rather
// than adopting a library: one useState-driven fetch-on-mount per resource,
// matching the existing "no external state library" style everywhere else in
// this codebase.

"use client"

import { useCallback, useEffect, useState } from "react"

import { ApiError } from "@/lib/api/client"
import {
  fetchRecommendationDetail,
  fetchRecommendations,
  type RecommendationListParams,
} from "@/features/initiative-7/services/i7-api"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: ApiError | Error | null
}

/** GET /recommendations, refetched whenever `params` changes (by value, via
 * JSON.stringify -- the params object is small and rebuilt by callers, so a
 * deep-equality-by-serialization check is simpler than requiring callers to
 * memoize it themselves). */
export function useLiveRecommendations(params: RecommendationListParams = {}): AsyncState<Recommendation[]> & {
  total: number
  refetch: () => void
} {
  const [state, setState] = useState<AsyncState<Recommendation[]>>({
    data: null,
    loading: true,
    error: null,
  })
  const [total, setTotal] = useState(0)
  const [tick, setTick] = useState(0)
  const paramsKey = JSON.stringify(params)

  // Reset to "loading" as soon as the request key changes, during render
  // rather than in the effect below -- the React-endorsed way to derive
  // state from a changed prop/key without the "setState synchronously in an
  // effect" cascading-render smell (see react-hooks/set-state-in-effect).
  const [requestKey, setRequestKey] = useState(`${paramsKey}:${tick}`)
  if (requestKey !== `${paramsKey}:${tick}`) {
    setRequestKey(`${paramsKey}:${tick}`)
    setState((prev) => ({ ...prev, loading: true, error: null }))
  }

  useEffect(() => {
    let cancelled = false

    fetchRecommendations(JSON.parse(paramsKey) as RecommendationListParams)
      .then((result) => {
        if (cancelled) return
        setState({ data: result.recommendations, loading: false, error: null })
        setTotal(result.total)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error : new Error("Failed to load recommendations."),
        })
      })

    return () => {
      cancelled = true
    }
  }, [paramsKey, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { ...state, total, refetch }
}

/** GET /recommendations/{id}. `data` is `null` both while loading and when
 * the backend genuinely has no such recommendation (404) -- callers
 * distinguish the two via `loading`, exactly like the existing
 * getRecommendationById()'s `| undefined` not-found case. */
export function useLiveRecommendation(id: string): AsyncState<Recommendation> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<Recommendation>>({
    data: null,
    loading: true,
    error: null,
  })
  const [tick, setTick] = useState(0)

  const [requestKey, setRequestKey] = useState(`${id}:${tick}`)
  if (requestKey !== `${id}:${tick}`) {
    setRequestKey(`${id}:${tick}`)
    setState((prev) => ({ ...prev, loading: true, error: null }))
  }

  useEffect(() => {
    let cancelled = false

    fetchRecommendationDetail(id)
      .then((recommendation) => {
        if (cancelled) return
        setState({ data: recommendation, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          data: null,
          loading: false,
          error:
            error instanceof ApiError
              ? error
              : error instanceof Error
                ? error
                : new Error("Failed to load recommendation."),
        })
      })

    return () => {
      cancelled = true
    }
  }, [id, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { ...state, refetch }
}
