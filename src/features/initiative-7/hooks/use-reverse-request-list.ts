// Min-Max -> OAR conversion requests: the fetch hook for the Pipeline's "Convert to OAR requests" table.
//
// The same minimal pattern as use-reverse-recommendations.ts: fetch on mount and whenever the params change, keep the
// previous page's data on screen (dimmed by the caller) while the next one loads. No external state library.

"use client"

import { useCallback, useEffect, useState } from "react"

import {
  fetchReverseRequestList,
  type ReverseRequestListParams,
} from "@/features/initiative-7/services/reverse-conversion-requests-api"
import type { ApiReverseRequestList } from "@/features/initiative-7/types/reverse-conversion"

export interface ReverseRequestListState {
  /** The latest response that arrived; null until the first one does. */
  data: ApiReverseRequestList | null
  /** A request is in flight (data, if any, is the previous request's). */
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useReverseRequestList(params: ReverseRequestListParams): ReverseRequestListState {
  const [data, setData] = useState<ApiReverseRequestList | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const paramsKey = JSON.stringify(params)

  // Switch to "loading" as soon as the request key changes, during render rather than in the effect (see
  // react-hooks/set-state-in-effect), as the other live hooks do.
  const [requestKey, setRequestKey] = useState(`${paramsKey}:${tick}`)
  if (requestKey !== `${paramsKey}:${tick}`) {
    setRequestKey(`${paramsKey}:${tick}`)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false
    fetchReverseRequestList(JSON.parse(paramsKey) as ReverseRequestListParams)
      .then((response) => {
        if (cancelled) return
        setData(response)
        setError(null)
        setLoading(false)
      })
      .catch((failure: unknown) => {
        if (cancelled) return
        setError(failure instanceof Error ? failure : new Error("Failed to load the Convert to OAR requests."))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [paramsKey, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { data, loading, error, refetch }
}
