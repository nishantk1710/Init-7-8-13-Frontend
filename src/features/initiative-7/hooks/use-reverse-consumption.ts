// Min-Max -> OAR recommendations: the fetch hook for one material-plant's consumption chart.
//
// Fetches only while a row is open (the caller mounts it with the open row), so an untouched page asks for none.

"use client"

import { useEffect, useState } from "react"

import { fetchReverseConsumption } from "@/features/initiative-7/services/reverse-conversion-api"
import type { ApiReverseConsumption } from "@/features/initiative-7/types/reverse-conversion"

export interface ReverseConsumptionState {
  data: ApiReverseConsumption | null
  loading: boolean
  error: Error | null
}

export function useReverseConsumption(material: string, plant: string, anchor: string | undefined): ReverseConsumptionState {
  const key = `${material}|${plant}|${anchor ?? ""}`
  const [state, setState] = useState<ReverseConsumptionState & { key: string }>({ key, data: null, loading: true, error: null })

  // A different row or anchor starts a new request: show "loading" straight away, during render.
  if (state.key !== key) setState({ key, data: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    fetchReverseConsumption(material, plant, anchor)
      .then((data) => {
        if (!cancelled) setState({ key, data, loading: false, error: null })
      })
      .catch((failure: unknown) => {
        if (cancelled) return
        setState({ key, data: null, loading: false, error: failure instanceof Error ? failure : new Error("Failed to load consumption.") })
      })
    return () => {
      cancelled = true
    }
  }, [key, material, plant, anchor])

  return { data: state.data, loading: state.loading, error: state.error }
}
