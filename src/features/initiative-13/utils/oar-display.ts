// Display-only bands and phrasing for the OAR screens: which colour a number
// is drawn in, and how a date reads. Nothing here reclassifies a value the
// backend computed -- months of cover, days idle and due dates arrive as they
// are and only their presentation is decided.

import type { Tone } from "@/features/initiative-13/utils/status-labels"
import type { UtilisationLedgerEntry } from "@/lib/api/i13"

/** The semantic tones a pill, bar or card is drawn in. */
export type DisplayTone = "healthy" | "caution" | "urgent" | "primary" | "neutral"

/** The status-labels tones, in the display vocabulary. */
export function displayTone(tone: Tone): DisplayTone {
  switch (tone) {
    case "success":
      return "healthy"
    case "warning":
      return "caution"
    case "danger":
      return "urgent"
    case "info":
      return "primary"
    default:
      return "neutral"
  }
}

// ---------------------------------------------------------------- cover

/** Under 1 month is urgent, 1 to 6 months in between, over 6 months healthy (agreed 22 Oct). */
export const COVER_URGENT_BELOW_MONTHS = 1
export const COVER_HEALTHY_ABOVE_MONTHS = 6
/** Where the cover bar is full. Longer cover draws a full bar. */
export const COVER_BAR_MAX_MONTHS = 12

export const COVER_BANDS: { tone: DisplayTone; label: string }[] = [
  { tone: "urgent", label: "Under 1 month" },
  { tone: "caution", label: "1–6 months" },
  { tone: "healthy", label: "Over 6 months" },
]

export function coverTone(months: number): DisplayTone {
  if (months < COVER_URGENT_BELOW_MONTHS) return "urgent"
  if (months > COVER_HEALTHY_ABOVE_MONTHS) return "healthy"
  return "caution"
}

// ---------------------------------------------------------------- idle

/** Idle this long or longer is drawn red on the non-mover and consumption tables. */
export const LONG_IDLE_DAYS = 150
/** Where the idle bar is full: three years. Longer idles draw a full bar. */
export const IDLE_BAR_MAX_DAYS = 1095

export function isLongIdle(days: number): boolean {
  return days >= LONG_IDLE_DAYS
}

export function idleTone(days: number): DisplayTone {
  return isLongIdle(days) ? "urgent" : "caution"
}

// ---------------------------------------------------------------- shares

/** `count` as a share of `total`, 0..1; 0 for an empty total. */
export function shareOf(count: number, total: number): number {
  return total > 0 ? count / total : 0
}

/** "0.4" rather than "0" for a real but small share; never "100" for 99.6. */
export function formatShare(percent: number): string {
  if (percent === 0 || percent === 100) return String(percent)
  if (percent < 1) return percent.toFixed(1)
  if (percent > 99) return Math.min(percent, 99.9).toFixed(1)
  return String(Math.round(percent))
}

/** `formatShare` of count/total, with the % sign. */
export function percentLabel(count: number, total: number): string {
  return `${formatShare(shareOf(count, total) * 100)}%`
}

// ---------------------------------------------------------------- due dates

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * "in 5 days", "due today", "2 days overdue" -- whole calendar days between
 * the two dates in UTC, so the hint does not flip at a time-of-day boundary.
 */
export function relativeDue(dueAt: string, now: Date = new Date()): { label: string; overdue: boolean } | null {
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return null
  const dayOf = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const days = Math.round((dayOf(due) - dayOf(now)) / DAY_MS)
  const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`
  if (days === 0) return { label: "due today", overdue: false }
  if (days > 0) return { label: `in ${plural(days)}`, overdue: false }
  return { label: `${plural(-days)} overdue`, overdue: true }
}

// ---------------------------------------------------------------- journey

export type JourneyStep = {
  key: "reservation" | "pr" | "po" | "gr" | "gi"
  label: string
  reached: boolean
  /** The document or date behind the step, or why it is not reached. */
  detail: string
}

function docRef(prefix: string, number: string | null, item: string | null): string | null {
  return number ? `${prefix} ${number}${item ? `/${item}` : ""}` : null
}

function dateRange(first: string | null, latest: string | null): string | null {
  if (!first) return null
  return `First ${first}${latest && latest !== first ? `, latest ${latest}` : ""}`
}

/** A ledger line's five steps, each reached when SAP recorded its document. */
export function journeySteps(entry: UtilisationLedgerEntry): JourneyStep[] {
  const rows: [JourneyStep["key"], string, string | null, string][] = [
    ["reservation", "Reservation", docRef("Rsnum", entry.reservationNumber, entry.reservationItem), "Not linked"],
    ["pr", "PR", docRef("PR", entry.prNumber, entry.prItem), "Not linked"],
    ["po", "PO", docRef("PO", entry.poNumber, entry.poItem), "Not linked"],
    ["gr", "Goods receipt", dateRange(entry.firstGrDate, entry.latestGrDate), "No goods receipt yet"],
    ["gi", "Goods issue", dateRange(entry.firstGiDate, entry.latestGiDate), "Not issued yet"],
  ]
  return rows.map(([key, label, detail, missing]) => ({
    key,
    label,
    reached: detail !== null,
    detail: detail ?? missing,
  }))
}

/**
 * Where the line stops: the furthest step reached, and the step after it.
 * `null` once the last step is reached. A gap before the furthest step (a PO
 * with no PR on record) is a linkage gap the stepper shows, not a stop.
 */
export function journeyStop(steps: JourneyStep[]): { after: JourneyStep | null; next: JourneyStep } | null {
  const furthest = steps.findLastIndex((s) => s.reached)
  if (furthest === steps.length - 1) return null
  return { after: furthest >= 0 ? steps[furthest] : null, next: steps[furthest + 1] }
}
