"use client"

import { useEffect, useState } from "react"

import type { DemoRun } from "@/lib/assistant/demo/script"
import { allRuns, subscribe } from "@/lib/assistant/demo/store"

/**
 * Every demo session in this browser, kept current as runs change.
 *
 * `null` until the first read: the runs live in localStorage, which the server
 * render cannot see, so the first client render has nothing to show yet.
 */
export function useDemoRuns(): DemoRun[] | null {
  const [runs, setRuns] = useState<DemoRun[] | null>(null)
  useEffect(() => {
    const read = () => setRuns(allRuns())
    read()
    return subscribe(read)
  }, [])
  return runs
}
