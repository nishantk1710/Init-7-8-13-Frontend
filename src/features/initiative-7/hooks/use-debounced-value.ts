"use client"

import { useEffect, useState } from "react"

/** `value`, but only after it has stopped changing for `delayMs` -- so typing in a search box
 * asks the backend once, when the person pauses, not once per keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
