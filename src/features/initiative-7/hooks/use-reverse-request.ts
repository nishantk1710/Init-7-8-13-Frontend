// Min-Max -> OAR: one material-plant's conversion request -- load it, raise it, decide it.
//
// Loaded only while a row is open (the caller mounts it with the open row). Every write is followed by a reload,
// so what is shown is what the backend holds, not what this hook assumes happened.

"use client"

import { useCallback, useEffect, useState } from "react"

import { ApiError } from "@/lib/api/client"
import {
  actOnReverseRequest,
  createReverseRequest,
  declineReverseRequest,
  fetchReverseRequest,
  type ReverseRequestAction,
} from "@/features/initiative-7/services/reverse-conversion-requests-api"
import type { ApiReverseRequestDetail } from "@/features/initiative-7/types/reverse-conversion"

export interface ReverseRequestState {
  detail: ApiReverseRequestDetail | null
  loading: boolean
  /** A sentence for a failed load or write; null when all is well. */
  error: string | null
  /** The server has no conversion-request endpoints (HTTP 404 on the load): an older backend is deployed. Nothing can be
   * asked or decided until it is updated, so the buttons are not offered. */
  unavailable: boolean
  busy: boolean
  /** Raise the request. Resolves true when the backend accepted it. */
  submit: (comment?: string) => Promise<boolean>
  /** Decline to convert it, with a reason, without sending it for approval. Resolves true when recorded. */
  decline: (comment: string) => Promise<boolean>
  /** Apply one approval action as ``actorRole``. Resolves true when the backend accepted it. */
  act: (actorRole: string, action: ReverseRequestAction, comment?: string) => Promise<boolean>
}

function messageOf(failure: unknown): string {
  if (failure instanceof ApiError) return failure.message
  return failure instanceof Error ? failure.message : "Something went wrong."
}

export function useReverseRequest(material: string, plant: string, onChanged?: () => void): ReverseRequestState {
  const [detail, setDetail] = useState<ApiReverseRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  // A different row starts a fresh load: show "loading" straight away, during render.
  const key = `${material}|${plant}`
  const [loadedKey, setLoadedKey] = useState(key)
  if (loadedKey !== key) {
    setLoadedKey(key)
    setDetail(null)
    setLoading(true)
    setError(null)
    setUnavailable(false)
  }

  const load = useCallback(async () => {
    try {
      setDetail(await fetchReverseRequest(material, plant))
      setError(null)
      setUnavailable(false)
    } catch (failure) {
      setUnavailable(failure instanceof ApiError && failure.status === 404)
      setError(messageOf(failure))
    } finally {
      setLoading(false)
    }
  }, [material, plant])

  useEffect(() => {
    let cancelled = false
    fetchReverseRequest(material, plant)
      .then((found) => {
        if (cancelled) return
        setDetail(found)
        setError(null)
        setUnavailable(false)
        setLoading(false)
      })
      .catch((failure: unknown) => {
        if (cancelled) return
        setUnavailable(failure instanceof ApiError && failure.status === 404)
        setError(messageOf(failure))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [material, plant])

  const write = useCallback(
    async (call: () => Promise<unknown>): Promise<boolean> => {
      setBusy(true)
      setError(null)
      try {
        await call()
        await load()
        onChanged?.()
        return true
      } catch (failure) {
        setError(messageOf(failure))
        return false
      } finally {
        setBusy(false)
      }
    },
    [load, onChanged],
  )

  const submit = useCallback((comment?: string) => write(() => createReverseRequest(material, plant, comment)), [write, material, plant])
  const decline = useCallback(
    (comment: string) => write(() => declineReverseRequest(material, plant, comment)),
    [write, material, plant],
  )
  const currentId = detail?.current?.id
  const act = useCallback(
    (actorRole: string, action: ReverseRequestAction, comment?: string) => {
      if (currentId === undefined) return Promise.resolve(false)
      return write(() => actOnReverseRequest(currentId, actorRole, action, comment))
    },
    [write, currentId],
  )

  return { detail, loading, error, unavailable, busy, submit, decline, act }
}
