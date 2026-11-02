// Which kind of report a label is, and which reports the Reports page lists under each toggle.
//
// A monthly report is the same report over one month, saved under a label such as "Oct 2026"; a quarterly one is
// "Q4 2026". The two share the backend's list, so the page tells them apart by the label alone.

import { landingQuarters } from "@/features/initiative-7/utils/quarterly-snapshot"

export type ReportKind = "monthly" | "quarterly"

export const REPORT_KINDS: { id: ReportKind; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
]

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "Q4 2026" is quarterly; anything else ("Oct 2026") is a month. */
export function reportKindOf(label: string): ReportKind {
  return /^Q[1-4]\s+\d{4}$/.test(label.trim()) ? "quarterly" : "monthly"
}

/** Sort key for a month label: "Oct 2026" -> 2026 * 12 + 9. Unknown labels sort last. */
function monthKey(label: string): number {
  const [name, year] = label.trim().split(/\s+/)
  const index = MONTHS.indexOf(name ?? "")
  return index < 0 || !year ? -1 : Number(year) * 12 + index
}

/**
 * The labels the landing grid shows for one toggle, newest first. Quarterly lists every generated quarter plus the Q2
 * snapshot, which is always offered. Monthly lists the months that have a generated report -- there is no snapshot to
 * offer. Nothing is held back in either: a report appears as soon as it is generated.
 */
export function landingReports(kind: ReportKind, generated: string[]): string[] {
  if (kind === "quarterly") return landingQuarters(generated.filter((label) => reportKindOf(label) === "quarterly"))
  return Array.from(new Set(generated.filter((label) => reportKindOf(label) === "monthly"))).sort(
    (a, b) => monthKey(b) - monthKey(a),
  )
}

/** The words a page uses for one kind: "month" or "quarter", and the heading of its closing position. */
export function reportNoun(kind: ReportKind): { singular: "month" | "quarter"; endPosition: string; total: string } {
  return kind === "monthly"
    ? { singular: "month", endPosition: "Month-end position", total: "Month total" }
    : { singular: "quarter", endPosition: "Quarter-end position", total: "Quarter total" }
}
