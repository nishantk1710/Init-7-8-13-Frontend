// Presentation-only transforms for the Utilisation Dashboard (W6.7).
//
// Everything here is a grouping/join/filter over fields the backend already
// computed (aging band, acquired-vs-plan status, confirmation presence) --
// never a re-derivation of business rules. See
// `pages/utilisation-dashboard-page.tsx` for how these compose with the API
// client.

import type { JustificationEntry, PlanVsIssuedRow, WatchMetric } from "@/lib/api/i13"
import { PLAN_VS_ISSUED_SOURCE_LABEL, PLAN_VS_ISSUED_STATUS_LABEL } from "@/features/initiative-13/utils/status-labels"

/** Generic "count rows by a key" grouping, used for every distribution chart
 * on the dashboard (aging, acquired-vs-plan, exception status/type). */
export function countByField<T>(rows: T[], keyFn: (row: T) => string): { bucket: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = keyFn(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([bucket, count]) => ({ bucket, count }))
}

/** The Non-Mover Drilldown's scope: WATCH/ACT rows the backend has already
 * classified as `NON_MOVING` -- never a days-since-movement threshold
 * recomputed here. */
export function filterNonMovers(rows: WatchMetric[]): WatchMetric[] {
  return rows.filter((row) => row.agingBand === "NON_MOVING")
}

/** Most recent `calculatedAt` across a set of WATCH/ACT rows, for the
 * dashboard's "last refreshed" indicator. `null` when no row carries a
 * timestamp (e.g. an empty result), never today's date as a stand-in. */
export function buildLastRefreshedAt(rows: { calculatedAt: string | null }[]): string | null {
  const timestamps = rows.map((r) => r.calculatedAt).filter((v): v is string => v !== null)
  if (timestamps.length === 0) return null
  return timestamps.reduce((latest, current) => (current > latest ? current : latest))
}

// --- Export row builders -----------------------------------------------------
//
// Each returns exactly the rows handed to it (already filtered by the
// caller) as flat string/number tuples for `downloadExcel` -- no re-filtering,
// no aggregation.

/** Shown where no goods issue is on record: the "or never issued" of the non-moving rule. */
export const NEVER_ISSUED = "Never issued"

/** The Non-movers export: the table's four columns -- Material, Plant, Last issued, Stock on hand. */
export function nonMoverRowsToCsv(rows: WatchMetric[]): (string | number)[][] {
  return rows.map((r) => [r.material, r.plant, r.lastIssueDate ?? NEVER_ISSUED, r.stockOnHand ?? ""])
}

export function planVsIssuedRowsToCsv(rows: PlanVsIssuedRow[]): (string | number)[][] {
  return rows.map((r) => [
    PLAN_VS_ISSUED_SOURCE_LABEL[r.source],
    r.material,
    r.plant,
    r.reservations.join(", "),
    Number(r.plannedQuantity),
    Number(r.issuedQuantity),
    PLAN_VS_ISSUED_STATUS_LABEL[r.status],
    r.dueDate ?? "",
    r.overdue ? "Yes" : "No",
  ])
}

export function justificationRowsToCsv(rows: JustificationEntry[]): (string | number)[][] {
  return rows.map((r) => [
    r.exceptionId,
    r.exceptionType,
    r.material,
    r.plant,
    r.ownerRequesterId ?? "",
    r.reasonCategory,
    r.freeText,
    r.actorId,
    r.submittedAt,
  ])
}
