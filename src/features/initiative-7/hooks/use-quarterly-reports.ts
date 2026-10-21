// Step 9 -- I07 Quarterly Deep-Dive Report frontend.
//
// List hook for GET /reports/quarterly, following useLiveRecommendations'
// exact { data, loading, error, refetch } shape (see use-live-recommendations.ts).

"use client"

import { useCallback, useEffect, useState } from "react"

import { ApiError } from "@/lib/api/client"
import { fetchQuarterlyReports, type QuarterlyReportListRow } from "@/features/initiative-7/services/i7-api"
import type { AsyncState } from "@/features/initiative-7/hooks/use-live-recommendations"

/** GET /reports/quarterly, refetched on `refetch()`. */
export function useQuarterlyReports(limit = 20): AsyncState<QuarterlyReportListRow[]> & {
  total: number
  refetch: () => void
} {
  const [state, setState] = useState<AsyncState<QuarterlyReportListRow[]>>({
    data: null,
    loading: true,
    error: null,
  })
  const [total, setTotal] = useState(0)
  const [tick, setTick] = useState(0)

  // Reset to "loading" as soon as `limit`/`tick` changes, during render
  // rather than in the effect below -- avoids the set-state-in-effect
  // cascading-render smell (see react-hooks/set-state-in-effect and
  // use-live-recommendations.ts's identical pattern).
  const requestKeyValue = `${limit}:${tick}`
  const [requestKey, setRequestKey] = useState(requestKeyValue)
  if (requestKey !== requestKeyValue) {
    setRequestKey(requestKeyValue)
    setState((prev) => ({ ...prev, loading: true, error: null }))
  }

  useEffect(() => {
    let cancelled = false

    fetchQuarterlyReports(limit)
      .then((result) => {
        if (cancelled) return
        setState({ data: result.items, loading: false, error: null })
        setTotal(result.total)
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
                : new Error("Failed to load quarterly reports."),
        })
      })

    return () => {
      cancelled = true
    }
  }, [limit, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { ...state, total, refetch }
}
