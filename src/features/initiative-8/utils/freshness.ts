import type { ApiI8Freshness } from "@/lib/api/i8"
import { formatApiDate, formatApiDateTime } from "@/lib/api/format"

/**
 * How current the I08 screens say they are, in words (`GET /i8/status`).
 *
 * **Two numbers, pointing opposite ways on purpose.** The load time takes the
 * OLDEST source load — everything behind the screen is at least this fresh.
 * The coverage date takes the NEWEST activity — nothing after it has reached
 * us. Each is the bound that cannot overstate freshness, and they are not
 * interchangeable: a daily sync that pulls an unchanging extract reports
 * "loaded this morning" forever, which is true and tells a user nothing about
 * whether anything has actually happened.
 *
 * That is not hypothetical. On 27-Nov-2026 nonprod had loaded 90 seconds
 * earlier and held no activity newer than 5 November.
 *
 * Kept apart from React so the wording can be tested without rendering.
 */

/** Past this many days behind, the coverage date is worth noticing. */
export const STALE_AFTER_DAYS = 7

export interface FreshnessNote {
  /** The line on screen. */
  label: string
  /** The hover detail: per-table loads, the build time, the gap. */
  title: string
  /** `warn` once coverage falls more than `STALE_AFTER_DAYS` behind. */
  tone: "muted" | "warn"
}

function daysBetween(from: string, to: string): number | null {
  const start = new Date(`${from}T00:00:00Z`).getTime()
  const end = new Date(`${to}T00:00:00Z`).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.round((end - start) / 86_400_000)
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

/**
 * The note for one `/i8/status` reading, or null when there is nothing
 * truthful to say.
 *
 * Null rather than a guess in two cases: the status could not be read, and a
 * deployment that records neither a load nor a coverage date — the local dev
 * copy, which is bulk-loaded from CSV and writes no ingestion runs. An empty
 * space says "not known" more honestly than a date would.
 */
export function freshnessNote(status: ApiI8Freshness | null): FreshnessNote | null {
  if (!status) return null

  // A first build, with nothing yet to describe. Said plainly, because the
  // screen behind it is empty and the reason is not the user's fault.
  if (!status.builtAt && status.buildingSince) {
    return {
      label: "Preparing SAP data…",
      title: `Started ${formatApiDateTime(status.buildingSince)}.\nThe screens fill in when it finishes.`,
      tone: "muted",
    }
  }

  const parts: string[] = []
  const detail: string[] = []

  if (status.loadedAt) {
    parts.push(`SAP data loaded ${formatApiDateTime(status.loadedAt)}`)
    const tables = status.tables ?? []
    const behind = tables.filter((t) => t.loadedAt && t.loadedAt !== status.newestLoadedAt)
    const never = tables.filter((t) => !t.loadedAt)
    if (status.newestLoadedAt && status.newestLoadedAt !== status.loadedAt) {
      // The headline is the oldest, so say what the newest was — otherwise a
      // reader cannot tell a wholly stale feed from one table lagging.
      detail.push(`Newest source loaded ${formatApiDateTime(status.newestLoadedAt)}`)
      for (const table of behind.slice(0, 4)) {
        detail.push(`${table.table} last loaded ${formatApiDateTime(table.loadedAt)}`)
      }
    } else if (tables.length > 0) {
      detail.push(`All ${tables.length - never.length} loaded sources are from this time`)
    }
    for (const table of never.slice(0, 3)) {
      detail.push(`${table.table} has never loaded`)
    }
  }

  let tone: "muted" | "warn" = "muted"
  if (status.coverageTo) {
    const gap = daysBetween(status.coverageTo, status.referenceDate)
    const age = gap !== null && gap > STALE_AFTER_DAYS ? ` — ${plural(gap, "day")} ago` : ""
    if (age) tone = "warn"
    parts.push(`covers activity to ${formatApiDate(status.coverageTo)}${age}`)
    detail.push("Coverage is the newest purchase order, requisition or goods movement in the data.")
  }

  if (parts.length === 0) return null
  if (status.builtAt) detail.push(`Snapshot built ${formatApiDateTime(status.builtAt)}`)
  if (status.buildingSince) detail.push("A new update is running.")

  return { label: parts.join(" · "), title: detail.join("\n"), tone }
}
