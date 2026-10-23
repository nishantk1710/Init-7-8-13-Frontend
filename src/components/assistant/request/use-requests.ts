"use client"

import { useEffect, useState } from "react"

import {
  getRequest,
  listRequests,
  type ApiRequest,
  type ApiRequestSummary,
} from "@/lib/api/assistant-requests"

/** A fetch's three states. `error` is the thrown value, for `isNotEnabled` and the message. */
export type Loaded<T> = { data: T | null; error: unknown; loading: boolean }

/** Read once. `reload` re-reads on demand -- after a live UAT simulation. */
function useLoaded<T>(load: () => Promise<T>, key: string): Loaded<T> & { reload: () => void } {
  const [state, setState] = useState<Loaded<T>>({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    load()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }))
    return () => {
      cancelled = true
    }
    // `load` is a fresh closure every render; `key` says when it means something new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick])
  return { ...state, reload: () => setTick((t) => t + 1) }
}

export function useRequest(requestId: string) {
  return useLoaded<ApiRequest>(() => getRequest(requestId), requestId)
}

export function useRequestList() {
  return useLoaded<ApiRequestSummary[]>(() => listRequests(), "list")
}
