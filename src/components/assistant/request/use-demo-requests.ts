"use client"

import { useEffect, useState } from "react"

import type { RequestRecord } from "@/lib/assistant/request/record"
import { allRequests, subscribe } from "@/lib/assistant/request/store"

/**
 * Every demo request in this browser, kept current. `null` until the first
 * client read -- localStorage is invisible to the server render.
 */
export function useDemoRequests(): RequestRecord[] | null {
  const [requests, setRequests] = useState<RequestRecord[] | null>(null)
  useEffect(() => {
    const read = () => setRequests(allRequests())
    read()
    return subscribe(read)
  }, [])
  return requests
}
