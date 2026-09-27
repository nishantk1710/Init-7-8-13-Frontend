// Part 35 -- portfolio-wide counts for the Overview KPI row.
//
// InventoryPortfolioKpis normally derives its counts from whichever
// `recommendations` array it's given -- correct in scenario/generated mode,
// where that array IS the whole catalogue. In live mode it is at most one
// 200-row page (see live-overview-workspace.tsx's LIVE_OVERVIEW_PAGE_SIZE),
// so "X% of recommendations" computed from that page is not a portfolio
// figure -- with ~2.3M accumulated rows, a page that happens to be almost
// entirely NOT_EVALUABLE (which the same display-status collapse as
// READY_FOR_REVIEW maps to "Pending Review", see i7-api.ts's STATUS_MAP)
// can read "200 Recommendations, 100.0% of recommendations" without a single
// one of them being genuinely submitted. GET /recommendations/summary is a
// real SQL aggregate over the whole (optionally filtered) set and is the
// correct source for a KPI that claims to be a percentage of "all
// recommendations".

"use client"

import { useEffect, useState } from "react"

import {
  fetchRecommendationSummary,
  type RecommendationListParams,
  type RecommendationSummaryStats,
} from "@/features/initiative-7/services/i7-api"

export interface LiveRecommendationSummaryState {
  summary: RecommendationSummaryStats | null
  loading: boolean
  error: Error | null
}

export function useLiveRecommendationSummary(
  params: Omit<RecommendationListParams, "page" | "pageSize" | "sort"> = {},
): LiveRecommendationSummaryState {
  const [state, setState] = useState<LiveRecommendationSummaryState>({
    summary: null,
    loading: true,
    error: null,
  })

  const paramsKey = JSON.stringify(params)
  const [requestKey, setRequestKey] = useState(paramsKey)
  if (requestKey !== paramsKey) {
    setRequestKey(paramsKey)
    setState((prev) => ({ ...prev, loading: true, error: null }))
  }

  useEffect(() => {
    let cancelled = false

    fetchRecommendationSummary(JSON.parse(paramsKey) as RecommendationListParams)
      .then((summary) => {
        if (cancelled) return
        setState({ summary, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          summary: null,
          loading: false,
          error: error instanceof Error ? error : new Error("Failed to load recommendation summary."),
        })
      })

    return () => {
      cancelled = true
    }
  }, [paramsKey])

  return state
}
