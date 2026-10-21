"use client"

import { useEffect, useState } from "react"

import type { ApiDepartment } from "@/lib/api/assistant"
import {
  getRequest,
  listRequests,
  requestDepartments,
  type ApiRequest,
  type ApiRequestSummary,
} from "@/lib/api/assistant-requests"
import { ASSISTANT_DEMO } from "@/lib/assistant/demo/flag"
import { subscribe } from "@/lib/assistant/request/store"

/** A fetch's three states. `error` is the thrown value, for `isNotEnabled` and the message. */
export type Loaded<T> = { data: T | null; error: unknown; loading: boolean }

/**
 * Read once, and again whenever the demo store changes (the demo's simulated
 * links). `reload` re-reads on demand -- after a live UAT simulation.
 */
function useLoaded<T>(load: () => Promise<T>, key: string): Loaded<T> & { reload: () => void } {
  const [state, setState] = useState<Loaded<T>>({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    load()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }))
    const off = ASSISTANT_DEMO ? subscribe(() => setTick((t) => t + 1)) : undefined
    return () => {
      cancelled = true
      off?.()
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

/** One plant's department codes: `own` for a line's select, `all` for the searchable picker. */
export function useDepartments(plant: string | null): { all: ApiDepartment[]; own: string[]; loaded: boolean } {
  const [state, setState] = useState<{ plant: string | null; all: ApiDepartment[]; loaded: boolean }>({
    plant: null,
    all: [],
    loaded: false,
  })
  useEffect(() => {
    if (!plant) return
    let cancelled = false
    requestDepartments(plant)
      .then((r) => !cancelled && setState({ plant, all: r.items, loaded: r.loaded }))
      .catch(() => !cancelled && setState({ plant, all: [], loaded: false }))
    return () => {
      cancelled = true
    }
  }, [plant])
  const current = state.plant === plant ? state : { all: [], loaded: false }
  return {
    all: current.all,
    own: current.all.filter((d) => d.primary).map((d) => d.code),
    loaded: current.loaded,
  }
}
