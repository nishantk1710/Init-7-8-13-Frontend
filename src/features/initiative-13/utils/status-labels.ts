// Display labels and tones for the backend's I13 enums, in one place.
//
// The dashboard used to carry its own copies of these, and they had drifted
// from the other screens ("Aligned" here, "On plan" on WATCH; CONFIRMED amber
// here, green on the Exceptions board). Labels only -- no value is
// reclassified here.

import type { AcquiredVsPlanStatus, ActExceptionStatus, ActExceptionType } from "@/lib/api/i13"

export type Tone = "neutral" | "info" | "success" | "warning" | "danger"

export const AGING_BAND_ORDER = ["FAST", "SLOW", "NON_MOVING"] as const

export const AGING_BAND_LABEL: Record<string, string> = {
  FAST: "Fast-moving",
  SLOW: "Slow-moving",
  NON_MOVING: "Non-moving",
}

export const AGING_BAND_TONE: Record<string, Tone> = {
  FAST: "success",
  SLOW: "warning",
  NON_MOVING: "danger",
}

export const PLAN_STATUS_ORDER: AcquiredVsPlanStatus[] = [
  "ON_PLAN",
  "BELOW_PLAN",
  "ABOVE_PLAN",
  "NO_PLAN",
]

export const PLAN_STATUS_LABEL: Record<AcquiredVsPlanStatus, string> = {
  ON_PLAN: "On plan",
  BELOW_PLAN: "Below plan",
  ABOVE_PLAN: "Above plan",
  NO_PLAN: "No plan",
}

export const PLAN_STATUS_TONE: Record<AcquiredVsPlanStatus, Tone> = {
  ON_PLAN: "success",
  BELOW_PLAN: "warning",
  ABOVE_PLAN: "danger",
  NO_PLAN: "neutral",
}

export const EXCEPTION_STATUS_ORDER: ActExceptionStatus[] = [
  "OPEN",
  "AWAITING_REQUESTER",
  "ESCALATED",
  "CONFIRMED",
  "RESOLVED",
]

export const EXCEPTION_STATUS_LABEL: Record<ActExceptionStatus, string> = {
  OPEN: "Open — not routed",
  AWAITING_REQUESTER: "Awaiting requester",
  ESCALATED: "Escalated to HOD",
  CONFIRMED: "Confirmed",
  RESOLVED: "Resolved",
}

export const EXCEPTION_STATUS_TONE: Record<ActExceptionStatus, Tone> = {
  OPEN: "neutral",
  AWAITING_REQUESTER: "warning",
  ESCALATED: "danger",
  CONFIRMED: "success",
  RESOLVED: "success",
}

export const EXCEPTION_TYPE_LABEL: Record<ActExceptionType, string> = {
  PLAN_BREACH: "Plan breach",
  NO_PLAN: "No plan",
  NO_PLAN_GRNI: "No plan + 30-day GRNI",
  QUANTITY_OVERRIDE: "Quantity override",
}

/** `StatusBadge` has no neutral/info tone of its own. */
export function badgeTone(tone: Tone): "default" | "success" | "warning" | "danger" {
  return tone === "neutral" || tone === "info" ? "default" : tone
}

/**
 * Counts per key in a fixed display order, then any key the backend sent that
 * the order does not know, so a new enum value shows up rather than vanishing.
 */
export function orderedCounts<T>(
  rows: T[],
  keyFn: (row: T) => string,
  order: readonly string[]
): { key: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = keyFn(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const extra = [...counts.keys()].filter((k) => !order.includes(k))
  return [...order, ...extra].map((key) => ({ key, count: counts.get(key) ?? 0 }))
}
