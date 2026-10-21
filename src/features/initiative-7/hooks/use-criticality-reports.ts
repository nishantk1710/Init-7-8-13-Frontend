// The Criticality Reports page's data: the plants a report can be uploaded
// for, and every upload. Same { data, loading, error, refetch } shape and
// render-time reset as useQuarterlyReports (see use-quarterly-reports.ts).

"use client"

import { useCallback, useEffect, useState } from "react"

import { ApiError } from "@/lib/api/client"
import {
  fetchCriticalityPlants,
  fetchCriticalityUploads,
} from "@/features/initiative-7/services/criticality-reports-api"
import type { AsyncState } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { CriticalityPlant, CriticalityUpload } from "@/features/initiative-7/types/criticality-reports"

export type CriticalityReportsData = {
  plants: CriticalityPlant[]
  /** Every upload, newest month first. The page narrows by plant itself, so
   * switching plant never waits on the network. */
  uploads: CriticalityUpload[]
}

export function useCriticalityReports(): AsyncState<CriticalityReportsData> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<CriticalityReportsData>>({
    data: null,
    loading: true,
    error: null,
  })
  const [tick, setTick] = useState(0)

  // Reset to "loading" during render when a refetch is asked for, not in the
  // effect -- avoids react-hooks/set-state-in-effect. Keeps the previous data
  // so the history does not blank out while it reloads after an upload.
  const [requestKey, setRequestKey] = useState(tick)
  if (requestKey !== tick) {
    setRequestKey(tick)
    setState((prev) => ({ ...prev, loading: true, error: null }))
  }

  useEffect(() => {
    let cancelled = false

    Promise.all([fetchCriticalityPlants(), fetchCriticalityUploads()])
      .then(([plants, uploads]) => {
        if (cancelled) return
        setState({ data: { plants, uploads }, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          data: null,
          loading: false,
          error:
            error instanceof ApiError || error instanceof Error
              ? error
              : new Error("Failed to load the criticality reports."),
        })
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { ...state, refetch }
}
