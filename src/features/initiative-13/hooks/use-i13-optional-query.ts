"use client"

import { useCallback, useEffect, useState } from "react"

import { ApiError } from "@/lib/api/client"

export type OptionalQueryState<T> =
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; data: T }

/**
 * Like `useI13Query`, for a dashboard section whose backend dependency is
 * declared "when available" (W6.5/W6.6 here) rather than W6.7's one official
 * dependency (W6.3). A 404 is reported as `unavailable` (the capability
 * genuinely isn't there in this environment) instead of `error` (a request
 * that should be retried) -- see §17 of the W6.7 task: one missing
 * downstream capability must not read as a broken dashboard.
 */
export function useI13OptionalQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[]
): OptionalQueryState<T> & { refetch: () => void } {
  const [state, setState] = useState<OptionalQueryState<T>>({ status: "loading" })
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false

    Promise.resolve().then(() => {
      if (!cancelled) setState({ status: "loading" })
    })

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setState({ status: "unavailable", message: "This capability is not available from the current backend." })
          return
        }
        const message = err instanceof Error ? err.message : "Unable to load data."
        setState({ status: "error", message })
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { ...state, refetch }
}
