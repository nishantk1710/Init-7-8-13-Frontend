// Adoption Tracking (FR-9) -- same fetch-on-mount pattern as
// use-live-recommendations.ts's useLiveRecommendations.

"use client"

import { useCallback, useEffect, useState } from "react"

import { ApiError } from "@/lib/api/client"
import {
  fetchAdoptionList,
  fetchAdoptionSummary,
  type AdoptionListRow,
  type AdoptionSummaryParams,
  type AdoptionSummaryResult,
  type RecommendationListParams,
} from "@/features/initiative-7/services/i7-api"

export interface LiveAdoptionState {
  items: AdoptionListRow[] | null
  total: number
  loading: boolean
  error: ApiError | Error | null
  refetch: () => void
}

/** GET /recommendations/adoption, refetched whenever `params` changes. */
export function useLiveAdoption(
  params: Omit<RecommendationListParams, "sort" | "sortDesc"> = {},
  options: { enabled?: boolean } = {},
): LiveAdoptionState {
  const enabled = options.enabled ?? true
  const [items, setItems] = useState<AdoptionListRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [tick, setTick] = useState(0)
  const paramsKey = JSON.stringify(params)

  const [requestKey, setRequestKey] = useState(`${paramsKey}:${tick}`)
  if (requestKey !== `${paramsKey}:${tick}`) {
    setRequestKey(`${paramsKey}:${tick}`)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    // Each adoption row costs a lookup in SAP's change history, so a page that
    // does not need the rows does not ask for them.
    if (!enabled) {
      setItems(null)
      setTotal(0)
      setLoading(false)
      return
    }
    let cancelled = false

    fetchAdoptionList(JSON.parse(paramsKey) as RecommendationListParams)
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
        setTotal(result.total)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setItems(null)
        setLoading(false)
        setError(err instanceof Error ? err : new Error("Failed to load adoption tracking."))
      })

    return () => {
      cancelled = true
    }
  }, [paramsKey, tick, enabled])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { items, total, loading, error, refetch }
}

export interface LiveAdoptionSummaryState {
  summary: AdoptionSummaryResult | null
  loading: boolean
  error: ApiError | Error | null
  refetch: () => void
}

/** GET /recommendations/adoption/summary -- the persisted ledger's
 * portfolio-wide counts (or, with `params`, a narrowed set), refetched
 * whenever `params` change. Powers the Inventory Planning overview's
 * adoption-rate card ("always-on dashboard") and the quarterly report's SAP
 * Adoption section, both reading the same summary. */
export function useLiveAdoptionSummary(params: AdoptionSummaryParams = {}): LiveAdoptionSummaryState {
  const [summary, setSummary] = useState<AdoptionSummaryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [tick, setTick] = useState(0)

  // Reset to "loading" as soon as `plant`/`tick` changes, during render
  // rather than in the effect below -- the React-endorsed way to derive
  // state from a changed key without the "setState synchronously in an
  // effect" cascading-render smell (see use-live-recommendations.ts's
  // identical pattern).
  const paramsKey = JSON.stringify(params)
  const requestKeyValue = `${paramsKey}:${tick}`
  const [requestKey, setRequestKey] = useState(requestKeyValue)
  if (requestKey !== requestKeyValue) {
    setRequestKey(requestKeyValue)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false

    fetchAdoptionSummary(JSON.parse(paramsKey) as AdoptionSummaryParams)
      .then((result) => {
        if (cancelled) return
        setSummary(result)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setSummary(null)
        setLoading(false)
        setError(err instanceof Error ? err : new Error("Failed to load adoption summary."))
      })

    return () => {
      cancelled = true
    }
  }, [paramsKey, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { summary, loading, error, refetch }
}
