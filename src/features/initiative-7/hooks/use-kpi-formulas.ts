// The KPI formulas page's data, and the formulas the Overview's information cards read.
// Same { data, loading, error, refetch } shape as useCriticalityReports.

"use client"

import { useCallback, useEffect, useState } from "react"

import { ApiError } from "@/lib/api/client"
import { fetchActiveFormulas, fetchFormulasPage } from "@/features/initiative-7/services/kpi-formulas-api"
import type { AsyncState } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { ActiveFormulas, FormulasPage } from "@/features/initiative-7/types/kpi-formulas"

function toError(error: unknown, fallback: string): ApiError | Error {
  return error instanceof ApiError || error instanceof Error ? error : new Error(fallback)
}

export function useKpiFormulasPage(): AsyncState<FormulasPage> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<FormulasPage>>({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)

  // Reset to "loading" during render, not in the effect (react-hooks/set-state-in-effect); the previous
  // data stays on screen while it reloads, so the page does not blank after Apply.
  const [requestKey, setRequestKey] = useState(tick)
  if (requestKey !== tick) {
    setRequestKey(tick)
    setState((prev) => ({ ...prev, loading: true, error: null }))
  }

  useEffect(() => {
    let cancelled = false
    fetchFormulasPage()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: toError(error, "Failed to load the calculation.") })
      })
    return () => {
      cancelled = true
    }
  }, [tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, refetch }
}

/** The formulas in force, for the Overview's information cards. A failure is `null` -- the cards fall back
 * to the built-in text rather than hiding the (i) icon. */
export function useActiveKpiFormulas(): ActiveFormulas | null {
  const [active, setActive] = useState<ActiveFormulas | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchActiveFormulas()
      .then((value) => {
        if (!cancelled) setActive(value)
      })
      .catch(() => {
        /* the built-in text stands */
      })
    return () => {
      cancelled = true
    }
  }, [])
  return active
}
