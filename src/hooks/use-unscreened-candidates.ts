"use client"

import { useEffect, useState } from "react"

import { getCodingUnscreened } from "@/lib/api/i8"

/** The Repair Candidates page: where the menu's badge points. */
export const CODING_CANDIDATES_PATH = "/repairable-spares/coding-candidates"

/**
 * How many repair candidates wait for the AI screen, for the menu's badge on
 * Repair Candidates (4-Nov-2026): rows a data reload brought in, or whose PO,
 * PR or movement text changed, are judged only when somebody runs the screen.
 *
 * Read off the screen the page already built -- the backend never builds one
 * to answer -- so the count is unknown (no badge) until somebody has opened
 * the page since the last restart. Asked again on every page change: the
 * answer is a lookup, not a query. A failed request keeps the last count.
 */
export function useUnscreenedCandidates(pathname: string): number | undefined {
  const [unscreened, setUnscreened] = useState<number | undefined>(undefined)

  useEffect(() => {
    let current = true
    getCodingUnscreened()
      .then((result) => {
        if (current) setUnscreened(result.unscreened ?? undefined)
      })
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [pathname])

  return unscreened && unscreened > 0 ? unscreened : undefined
}
