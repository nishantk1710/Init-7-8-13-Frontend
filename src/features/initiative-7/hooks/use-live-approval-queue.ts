// Part 22 — I07 complete frontend live data integration.
//
// Live-mode data source for the Approvals workspace. Unlike the scenario
// simulation (context/workflow-context.tsx), which derives a submitted/
// stepIndex/outcome/requestedBy state purely from an in-memory clone of the
// mock dataset, this fetches the real recommendation rows already in the
// approval chain (via the list endpoint's `status` filter -- PENDING_
// APPROVAL/HELD/APPROVED/REJECTED/ADJUSTED/SENT_BACK are exactly the
// backend's real submitted-state statuses) and, for the one currently
// SELECTED row, the real workflow state (GET .../workflow-state) so the
// sidebar can show the real route/pending-role without needing bulk
// per-row workflow state for the whole queue.

"use client"

import { useEffect, useState } from "react"

import { fetchRecommendations, fetchWorkflowState } from "@/features/initiative-7/services/i7-api"
import type { ApiWorkflowStateResponse } from "@/features/initiative-7/types/api"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

/** The backend's own submitted-state statuses -- everything that has left
 * READY_FOR_REVIEW and entered (or finished) the approval chain. Matches
 * i7-api.ts's mapStatus reduction: PENDING_APPROVAL/HELD -> "In Approval",
 * APPROVED/SAP_EXECUTION_PENDING -> "Approved", REJECTED -> "Rejected",
 * SENT_BACK -> "Returned", ADJUSTED -> "In Approval". */
const SUBMITTED_STATUSES = [
  "PENDING_APPROVAL",
  "HELD",
  "APPROVED",
  "REJECTED",
  "SENT_BACK",
  "ADJUSTED",
  "SAP_EXECUTION_PENDING",
  "SAP_EXECUTED",
]

const LIVE_APPROVALS_PAGE_SIZE = 200

/** Repeated pipeline runs during testing can leave more than one
 * recommendation row per material-plant (recommendation_id is not a
 * database-unique key -- see recommendations-workspace.tsx's own
 * dedupeByMaterialPlant, the same fix applied there for the Recommendations
 * table). Fetching 8 status buckets independently and flattening them
 * (below) makes this worse: the same duplicated material can appear more
 * than once within a single bucket, which is exactly what produced React's
 * "two children with the same key" warning here. Keeps the first occurrence
 * per material+plant, matching the order fetchRecommendations already
 * returns (newest first is not guaranteed here -- SUBMITTED_STATUSES has no
 * sort applied -- so this is "first seen," not "newest," unlike the
 * Recommendations table's own dedupe). */
function dedupeByMaterialPlant(recommendations: Recommendation[]): Recommendation[] {
  const seen = new Set<string>()
  const result: Recommendation[] = []
  for (const rec of recommendations) {
    const key = `${rec.material.materialId}|${rec.plantId}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(rec)
  }
  return result
}

export interface LiveApprovalQueueState {
  recommendations: Recommendation[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

/** Fetches every recommendation currently in (or through) the approval
 * chain, across all of the backend's submitted statuses -- one call per
 * status rather than one call per recommendation, since the list endpoint
 * only accepts a single `status` filter value at a time. */
export function useLiveApprovalQueue(): LiveApprovalQueueState {
  const [state, setState] = useState<Omit<LiveApprovalQueueState, "refetch">>({
    recommendations: [],
    loading: true,
    error: null,
  })
  const [tick, setTick] = useState(0)

  // Reset to "loading" during render when `tick` changes, rather than via a
  // synchronous setState at the top of the effect below -- see the
  // identical pattern (and rationale) in use-live-recommendations.ts.
  const [requestKey, setRequestKey] = useState(tick)
  if (requestKey !== tick) {
    setRequestKey(tick)
    setState((prev) => ({ ...prev, loading: true, error: null }))
  }

  useEffect(() => {
    let cancelled = false

    Promise.all(
      SUBMITTED_STATUSES.map((status) =>
        fetchRecommendations({ status, pageSize: LIVE_APPROVALS_PAGE_SIZE }).then(
          (result) => result.recommendations,
        ),
      ),
    )
      .then((batches) => {
        if (cancelled) return
        setState({ recommendations: dedupeByMaterialPlant(batches.flat()), loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          recommendations: [],
          loading: false,
          error: error instanceof Error ? error : new Error("Failed to load the approval queue."),
        })
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  return { ...state, refetch: () => setTick((t) => t + 1) }
}

export interface LiveWorkflowStateResult {
  state: ApiWorkflowStateResponse | null
  loading: boolean
  error: Error | null
}

/** The real route/pending-role for ONE recommendation -- fetched only for
 * whichever row the approvals table currently has selected, not for the
 * whole queue, avoiding an N-calls-per-row cost on a list view. */
export function useLiveWorkflowState(recommendationId: string | null): LiveWorkflowStateResult {
  const [result, setResult] = useState<LiveWorkflowStateResult>({
    state: null,
    loading: recommendationId !== null,
    error: null,
  })

  // Same render-time reset pattern as the other live hooks in this file.
  const [requestKey, setRequestKey] = useState(recommendationId)
  if (requestKey !== recommendationId) {
    setRequestKey(recommendationId)
    setResult({ state: null, loading: recommendationId !== null, error: null })
  }

  useEffect(() => {
    if (!recommendationId) {
      return
    }
    let cancelled = false

    fetchWorkflowState(recommendationId)
      .then((state) => {
        if (cancelled) return
        setResult({ state, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setResult({
          state: null,
          loading: false,
          error: error instanceof Error ? error : new Error("Failed to load workflow state."),
        })
      })

    return () => {
      cancelled = true
    }
  }, [recommendationId])

  return result
}
