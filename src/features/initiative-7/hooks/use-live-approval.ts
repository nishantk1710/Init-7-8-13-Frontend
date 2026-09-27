// Part 21 — I07 frontend/backend integration.
//
// Approval actions for a LIVE recommendation, backed by the real workflow
// endpoints (app/api/i7/approvals.py). Deliberately separate from
// context/workflow-context.tsx's InventoryWorkflowProvider, which simulates a
// fixed 4-role chain entirely in memory for the scenario/generated fixtures
// and is unchanged by this slice -- the two are not merged into one
// mechanism because the real backend's workflow (up to 8 roles, criticality-
// routed or the fixed OAR chain, HOLD/RELEASE_HOLD, an immutable ledger) is
// materially different from the scenario simulation, and forcing them onto
// one hook would mean redesigning one or the other, which Part 21 forbids.
//
// AUTHENTICATION LIMITATION (Part 13 is deferred): `actorId`/`actorRole` are
// not derived from any real signed-in identity -- there is none yet (see
// app/core/security.py, a placeholder). The caller supplies them explicitly,
// exactly as the backend's ApprovalActionRequest documents. This hook does
// not invent a login; it exposes the same limitation the API already has.

"use client"

import { useCallback, useEffect, useState } from "react"

import { ApiError } from "@/lib/api/client"
import {
  applyApprovalAction,
  fetchApprovalHistory,
  submitForApproval,
} from "@/features/initiative-7/services/i7-api"
import type {
  ApiApprovalAction,
  ApiApprovalHistoryEntry,
  ApiApprovalRole,
  ApiWorkflowStateResponse,
} from "@/features/initiative-7/types/api"

export interface LiveApprovalState {
  submitting: boolean
  error: ApiError | Error | null
  lastState: ApiWorkflowStateResponse | null
}

export interface UseLiveApproval extends LiveApprovalState {
  submit: (actorId: string) => Promise<void>
  act: (actorId: string, actorRole: ApiApprovalRole, action: ApiApprovalAction, comment?: string) => Promise<void>
}

/** `onChanged` is called after a successful submit/act so the caller can
 * refetch the recommendation detail (its status/chain_index/current_version
 * will have moved) -- this hook does not own recommendation state itself. */
export function useLiveApproval(recommendationId: string, onChanged?: () => void): UseLiveApproval {
  const [state, setState] = useState<LiveApprovalState>({
    submitting: false,
    error: null,
    lastState: null,
  })

  const run = useCallback(
    async (call: () => Promise<ApiWorkflowStateResponse>) => {
      setState((prev) => ({ ...prev, submitting: true, error: null }))
      try {
        const result = await call()
        setState({ submitting: false, error: null, lastState: result })
        onChanged?.()
      } catch (error) {
        setState({
          submitting: false,
          error: error instanceof Error ? error : new Error("Approval action failed."),
          lastState: null,
        })
      }
    },
    [onChanged],
  )

  const submit = useCallback(
    (actorId: string) => run(() => submitForApproval(recommendationId, actorId)),
    [recommendationId, run],
  )

  const act = useCallback(
    (actorId: string, actorRole: ApiApprovalRole, action: ApiApprovalAction, comment?: string) =>
      run(() => applyApprovalAction(recommendationId, actorId, actorRole, action, comment)),
    [recommendationId, run],
  )

  return { ...state, submit, act }
}

export interface LiveApprovalHistoryState {
  entries: ApiApprovalHistoryEntry[]
  loading: boolean
  error: ApiError | Error | null
}

/** GET .../approval-history, refetched whenever `reloadKey` changes -- pass
 * an incrementing value (or the recommendation's current_version) so a
 * caller that just applied an action can force a refresh without this hook
 * polling on its own. */
export function useLiveApprovalHistory(recommendationId: string, reloadKey: unknown = 0): LiveApprovalHistoryState {
  const [state, setState] = useState<LiveApprovalHistoryState>({
    entries: [],
    loading: true,
    error: null,
  })

  // See use-live-recommendations.ts's identical pattern: reset to "loading"
  // during render when the request key changes, rather than via a
  // synchronous setState at the top of the effect below.
  const requestKeyValue = `${recommendationId}:${String(reloadKey)}`
  const [requestKey, setRequestKey] = useState(requestKeyValue)
  if (requestKey !== requestKeyValue) {
    setRequestKey(requestKeyValue)
    setState((prev) => ({ ...prev, loading: true, error: null }))
  }

  useEffect(() => {
    let cancelled = false

    fetchApprovalHistory(recommendationId)
      .then((response) => {
        if (cancelled) return
        setState({ entries: response.items, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          entries: [],
          loading: false,
          error: error instanceof Error ? error : new Error("Failed to load approval history."),
        })
      })

    return () => {
      cancelled = true
    }
  }, [recommendationId, reloadKey])

  return state
}
