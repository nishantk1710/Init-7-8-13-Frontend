// Adoption Tracking (FR-9) -- same fetch-on-mount pattern as
// use-live-recommendations.ts's useLiveRecommendations.

"use client"

import { useCallback, useEffect, useState } from "react"

import { ApiError } from "@/lib/api/client"
import {
  fetchAdoptionList,
  type AdoptionListRow,
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
): LiveAdoptionState {
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
  }, [paramsKey, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { items, total, loading, error, refetch }
}
