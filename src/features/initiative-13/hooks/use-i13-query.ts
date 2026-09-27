"use client"

import { useCallback, useEffect, useState } from "react"

interface QueryState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Fetch-on-mount for the one Initiative 13 component that still needs it.
 *
 * Every OAR *page* is a server component now and fetches through
 * `data/live-loaders.ts` before it renders, so none of them uses this. What is
 * left is `DataSourcePanel`: a collapsed-by-default diagnostic aside whose
 * content nobody needs until they open it, and which would otherwise make every
 * page wait on an entity-set status read it may never show.
 *
 * Its sibling `use-i13-optional-query` is gone. The 404-means-unavailable rule
 * it existed for did not disappear — it moved to the server, into
 * `data/live-dashboard.ts`, where the dashboard's optional sections are settled
 * individually with `Promise.allSettled`.
 *
 * Do not reach for this when adding a screen. A page that fetches here renders
 * empty first, cannot be updated by `router.refresh()`, and puts a request
 * waterfall in front of the user — which is what the whole migration to server
 * components removed.
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
