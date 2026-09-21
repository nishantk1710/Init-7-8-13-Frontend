"use client"

import { useCallback, useEffect, useState } from "react"

interface QueryState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Small fetch-on-mount/deps-change hook for the Initiative 13 API — this
 * repo has no SWR/React Query, and every /oar-utilization page needs the
 * same loading/error/refetch shape, so it lives here once instead of being
 * hand-rolled five times.
 */
export function useI13Query<T>(
  fetcher: () => Promise<T>,
  deps: unknown[]
): QueryState<T> & { refetch: () => void } {
  const [state, setState] = useState<QueryState<T>>({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false

    // Marking "loading" is itself a state update in response to the deps
    // changing, not a synchronous effect side-effect — deferred a tick so
    // it isn't the first statement in the effect body.
    Promise.resolve().then(() => {
      if (!cancelled) setState((prev) => ({ ...prev, loading: true, error: null }))
    })

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unable to load data."
          setState({ data: null, loading: false, error: message })
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { ...state, refetch }
}
