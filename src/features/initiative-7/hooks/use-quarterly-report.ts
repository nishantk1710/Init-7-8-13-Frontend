// Step 9 -- I07 Quarterly Deep-Dive Report frontend.
//
// Detail hook: fetch-on-mount for GET /reports/quarterly/{quarter}, plus a
// `generate()` action (POST .../generate, ~40-50s synchronous per the
// backend's own module docstring) and a `poll()` helper over GET .../status.
// Follows useLiveRecommendations' { data, loading, error, refetch } shape,
// widened with the two report-specific actions.

"use client"

import { useCallback, useEffect, useState } from "react"

import { ApiError } from "@/lib/api/client"
import {
  fetchGenerationStatus,
  fetchQuarterlyReport,
  generateQuarterlyReport,
} from "@/features/initiative-7/services/i7-api"
import type { ApiGenerationStatusResponse, ApiQuarterlyReport } from "@/features/initiative-7/types/api"
import type { AsyncState } from "@/features/initiative-7/hooks/use-live-recommendations"

export function useQuarterlyReport(quarter: string | null): AsyncState<ApiQuarterlyReport> & {
  /** True only while the synchronous POST .../generate call is in flight --
   * distinct from `loading` (the initial GET fetch), so the UI can show a
   * "generating, this can take up to a minute" state without also flashing
   * the ordinary skeleton loader. */
  generating: boolean
  generationError: ApiError | Error | null
  status: ApiGenerationStatusResponse | null
  refetch: () => void
  generate: () => Promise<void>
} {
  const [state, setState] = useState<AsyncState<ApiQuarterlyReport>>({
    data: null,
    loading: true,
    error: null,
  })
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<ApiError | Error | null>(null)
  const [status, setStatus] = useState<ApiGenerationStatusResponse | null>(null)
  const [tick, setTick] = useState(0)

  // Derive the "loading"/"idle-with-no-quarter" transition during render
  // rather than in the effect below -- the React-endorsed way to avoid the
  // set-state-in-effect cascading-render smell (see use-live-recommendations.ts's
  // identical pattern).
  const requestKeyValue = `${quarter ?? ""}:${tick}`
  const [requestKey, setRequestKey] = useState(requestKeyValue)
  if (requestKey !== requestKeyValue) {
    setRequestKey(requestKeyValue)
    setState(quarter ? (prev) => ({ ...prev, loading: true, error: null }) : { data: null, loading: false, error: null })
  }

  useEffect(() => {
    if (!quarter) return
    let cancelled = false

    fetchQuarterlyReport(quarter)
      .then((report) => {
        if (cancelled) return
        setState({ data: report, loading: false, error: null })
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
                : new Error("Failed to load the quarterly report."),
        })
      })

    fetchGenerationStatus(quarter)
      .then((s) => {
        if (!cancelled) setStatus(s)
      })
      .catch(() => {
        // Status is supplementary display -- a failed poll must not block
        // the report body itself from rendering.
      })

    return () => {
      cancelled = true
    }
  }, [quarter, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  const generate = useCallback(async () => {
    if (!quarter) return
    setGenerating(true)
    setGenerationError(null)
    try {
      const report = await generateQuarterlyReport(quarter)
      setState({ data: report, loading: false, error: null })
      const s = await fetchGenerationStatus(quarter).catch(() => null)
      if (s) setStatus(s)
    } catch (error) {
      setGenerationError(
        error instanceof ApiError ? error : error instanceof Error ? error : new Error("Report generation failed."),
      )
    } finally {
      setGenerating(false)
    }
  }, [quarter])

  return { ...state, generating, generationError, status, refetch, generate }
}
