/**
 * Wording shared by the session trace screen and its downloaded file, so the
 * two cannot say different things.
 */

/** Display only -- the band is the backend's. */
export const BAND_LABEL: Record<string, string> = {
  FAST: "Fast-moving",
  SLOW: "Slow-moving",
  NON_MOVING: "Non-moving",
}

/** Why months of cover is blank, in words -- the backend sends a code. */
const COVER_REASON: Record<string, string> = {
  INSUFFICIENT_HISTORY: "not enough consumption history",
}

export function coverReasonText(reason: string): string {
  return COVER_REASON[reason] ?? reason.replace(/_/g, " ").toLowerCase()
}

/** `OPEN` -> `Open`: the plan's status is a code on the wire. */
export function planStatusLabel(status: string): string {
  const words = status.replace(/_/g, " ").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function formatWindow(start: string | null, end: string | null): string | null {
  if (!start && !end) return null
  if (start && end) return `${start} to ${end}`
  return start ? `from ${start}` : `by ${end}`
}

export function formatInstant(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
