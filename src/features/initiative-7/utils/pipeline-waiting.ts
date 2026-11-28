// How long something in the Pipeline has been waiting, and whether that is a problem. Shared by the recommendations
// table and the Convert to OAR requests table of the Pipeline page, so both say "Slow" and "Stuck" at the same days.

/** Days since `updatedAt` (a submit, hold, approval or rejection updates the row in place), against wall-clock "now". */
export function liveWaitingDays(updatedAt: string | undefined): number | null {
  if (!updatedAt) return null
  const parsed = new Date(updatedAt).getTime()
  if (Number.isNaN(parsed)) return null
  return Math.max(0, Math.round((Date.now() - parsed) / 86_400_000))
}

/** Illustrative thresholds, not an agreed SLA -- applied only to rows still in motion; a finished or not yet
 * submitted row is never "stuck". */
export function liveHealth(days: number | null): "On track" | "Slow" | "Stuck" | null {
  if (days === null) return null
  if (days > 14) return "Stuck"
  if (days > 7) return "Slow"
  return "On track"
}

export const HEALTH_TONE: Record<"On track" | "Slow" | "Stuck", "success" | "warning" | "danger"> = {
  "On track": "success",
  Slow: "warning",
  Stuck: "danger",
}
