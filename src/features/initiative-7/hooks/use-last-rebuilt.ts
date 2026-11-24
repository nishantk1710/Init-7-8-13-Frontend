// When the I07 results were last rebuilt, for the Inventory Planning header badge.
//
// One small read-only call. A failure just leaves the badge out (null): a missing "last rebuilt" label must
// never get in the way of the page itself.

"use client"

import { useEffect, useState } from "react"

import { fetchLastRebuilt } from "@/features/initiative-7/services/i7-api"

/** The UTC timestamp of the last rebuild, or ``null`` while loading, when nothing has been built, or on failure. */
export function useLastRebuilt(): string | null {
  const [rebuiltAt, setRebuiltAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchLastRebuilt()
      .then((value) => {
        if (!cancelled) setRebuiltAt(value)
      })
      .catch(() => {
        // left out on purpose: see above
      })
    return () => {
      cancelled = true
    }
  }, [])

  return rebuiltAt
}
