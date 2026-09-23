// Presentation-only transforms for the Utilisation Dashboard (W6.7).
//
// Everything here is a grouping/join/filter over fields the backend already
// computed (aging band, acquired-vs-plan status, critical-impact indicator,
// confirmation presence) -- never a re-derivation of business rules. See
// `pages/utilisation-dashboard-page.tsx` for how these compose with the API
// client.

import type { ActException, JustificationEntry, ReclassificationCandidate, WatchMetric } from "@/lib/api/i13"

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

export type CriticalFilter = "all" | "yes" | "no" | "unknown"

export interface NonMoverRow extends WatchMetric {
  criticalImpactIndicator: boolean | null
}

/** Joins WATCH/ACT rows to W6.5's reclassification candidates on
 * (material, plant) to attach the backend-computed `critical_impact_indicator`
 * -- the only criticality signal available for OAR positions today (there is
 * no per-material-plant criticality-tier endpoint). A row with no matching
 * candidate is `null` ("unknown"), never coerced to `false`. */
export function attachCriticalImpactIndicator(
  rows: WatchMetric[],
  candidates: ReclassificationCandidate[]
): NonMoverRow[] {
  const byKey = new Map(candidates.map((c) => [`${c.material}::${c.plant}`, c.criticalImpactIndicator]))
  return rows.map((row) => ({
    ...row,
    criticalImpactIndicator: byKey.get(`${row.material}::${row.plant}`) ?? null,
  }))
}

export function matchesCriticalFilter(row: { criticalImpactIndicator: boolean | null }, filter: CriticalFilter): boolean {
  if (filter === "all") return true
  if (filter === "unknown") return row.criticalImpactIndicator === null
  return row.criticalImpactIndicator === (filter === "yes")
}

/** Most recent `calculatedAt` across a set of WATCH/ACT rows, for the
 * dashboard's "last refreshed" indicator. `null` when no row carries a
 * timestamp (e.g. an empty result), never today's date as a stand-in. */
export function buildLastRefreshedAt(rows: { calculatedAt: string | null }[]): string | null {
  const timestamps = rows.map((r) => r.calculatedAt).filter((v): v is string => v !== null)
  if (timestamps.length === 0) return null
  return timestamps.reduce((latest, current) => (current > latest ? current : latest))
}

// --- CSV row builders -----------------------------------------------------
//
// Each returns exactly the rows handed to it (already filtered by the
// caller) as flat string/number tuples for `downloadCsv` -- no re-filtering,
// no aggregation.

export function nonMoverRowsToCsv(rows: NonMoverRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.material,
    r.plant,
    r.agingBand,
    r.daysSinceLastMovement ?? "",
    r.stockOnHand ?? "",
    r.consumptionCount12m,
    r.criticalImpactIndicator === null ? "Unknown" : r.criticalImpactIndicator ? "Yes" : "No",
  ])
}

export function acquiredVsPlanRowsToCsv(rows: WatchMetric[]): (string | number)[][] {
  return rows.map((r) => [
    r.material,
    r.plant,
    r.plannedQuantity ?? "",
    // Empty, not 0. An exported cell reading 0 asserts that nothing arrived;
    // an empty one says nobody recorded what did. This file is the boundary
    // where that distinction would quietly be lost.
    r.receivedQuantity ?? "",
    r.issuedQuantity ?? "",
    r.acquiredVsPlanVarianceQuantity ?? "",
    r.acquiredVsPlanVariancePercentage ?? "",
    r.acquiredVsPlanStatus,
  ])
}

export function exceptionRowsToCsv(rows: ActException[]): (string | number)[][] {
  return rows.map((r) => [
    r.exceptionType,
    r.material,
    r.plant,
    r.ownerRequesterId ?? "",
    r.status,
    r.detectedAt,
    r.requesterDueAt ?? "",
    r.escalatedAt ?? "",
    r.routingStatus ?? "",
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
