import { getMaterial } from "@demo/features/initiative-8/data/materials"
import type { I8Snapshot } from "@demo/features/initiative-8/model/snapshot"
import type { ExceptionType, RepairChain } from "@demo/features/initiative-8/types/repair"
import { NO_CRITICALITY } from "@demo/features/initiative-8/utils/status"

/**
 * The figures the Overview and the KPI cards quote, from any slice of the
 * snapshot — so a plant / vendor / criticality filter (FR-10) narrows every
 * number on the page the same way.
 */

export const ALL = "all"

/** Filter value for a material with no criticality rating. */
export const NOT_RATED = NO_CRITICALITY

export interface I8Filters {
  plant: string
  vendor: string
  criticality: string
}

export const NO_FILTERS: I8Filters = { plant: ALL, vendor: ALL, criticality: ALL }

export type SnapshotSlice = Pick<
  I8Snapshot,
  "lines" | "universe" | "reservations" | "purchases" | "sessions" | "exceptions" | "justifications" | "dispatches"
>

function criticalityOf(materialId: string): string {
  return getMaterial(materialId)?.criticality ?? NOT_RATED
}

/**
 * The snapshot narrowed by the Overview's filters. Vendor applies to what has
 * a vendor — repair lines, and the exceptions raised on a repair line.
 */
export function filterSnapshot(s: SnapshotSlice, f: I8Filters): SnapshotSlice {
  const keep = (materialId: string, plantId: string) =>
    (f.plant === ALL || plantId === f.plant) &&
    (f.criticality === ALL || criticalityOf(materialId) === f.criticality)
  const lines = s.lines.filter(
    (l) => keep(l.material.materialId, l.plant.plantId) && (f.vendor === ALL || l.vendor === f.vendor),
  )
  const lineIds = new Set(lines.map((l) => l.id))
  return {
    lines,
    universe: s.universe.filter((u) => keep(u.material.materialId, u.plant.plantId)),
    reservations: s.reservations.filter((r) => keep(r.materialId, r.plantId)),
    purchases: s.purchases.filter((p) => keep(p.materialId, p.plantId)),
    sessions: s.sessions.filter((x) => keep(x.materialId, x.plantId)),
    exceptions: s.exceptions.filter(
      (e) =>
        keep(e.material.materialId, e.plant.plantId) &&
        (f.vendor === ALL || (e.repairId !== undefined && lineIds.has(e.repairId))),
    ),
    justifications: s.justifications.filter((j) => keep(j.material.materialId, j.plant.plantId)),
    dispatches: s.dispatches.filter((d) => keep(d.materialId, d.plantId)),
  }
}

export function isOpenLine(line: RepairChain): boolean {
  return line.overdueStatus !== "RECEIVED" && line.overdueStatus !== "SCRAPPED"
}

export interface Ratio {
  count: number
  total: number
  /** Whole percent; undefined when there is nothing to measure. */
  percent?: number
}

function ratio(count: number, total: number): Ratio {
  return { count, total, percent: total > 0 ? Math.round((count / total) * 100) : undefined }
}

export interface I8Metrics {
  universeMaterials: number
  universeRows: number
  totalLines: number
  openLines: number
  overdueLines: number
  noDueDateLines: number
  qtyUnderRepair: number
  /** Open lines still owed a declaration, plus every Flagged line. */
  pendingDeclarations: number
  /** FR-10 attestation compliance: lines raised since the control went live that carry a declaration. */
  declarationCompliance: Ratio
  /** FR-10 session compliance: 80-series reservations since go-live with a valid session ID. */
  sessionCompliance: Ratio
  /** Purchases made while a repairable unit existed that carry a justification. */
  justificationCompliance: Ratio
  /** Sessions where the requester chose repair — the benefit FRS §8 counts. */
  avoided: { sessions: number; units: number; value: number }
  /** Average dispatch-to-receipt days over lines that came back. */
  averageTurnaround?: number
  openExceptions: number
  openByType: Record<ExceptionType, number>
}

export function summarise(s: SnapshotSlice): I8Metrics {
  const open = s.lines.filter(isOpenLine)
  const postCutoverLines = s.lines.filter((l) => !l.preAutomation)
  const postCutoverReservations = s.reservations.filter((r) => !r.preAutomation)
  const checkedPurchases = s.purchases.filter((p) => !p.preAutomation && p.basis.length > 0)
  const chose = s.sessions.filter((x) => x.avoidedValue > 0)
  const turnarounds = s.lines.flatMap((l) => (l.turnaroundDays === undefined ? [] : [l.turnaroundDays]))
  const openExceptions = s.exceptions.filter((e) => e.status === "OPEN" || e.status === "IN_PROGRESS")
  const openByType: Record<ExceptionType, number> = {
    OVERDUE_REPAIR: 0,
    MISSING_ATTESTATION: 0,
    MISSING_SESSION_ID: 0,
    UNJUSTIFIED_ACQUISITION: 0,
  }
  for (const e of openExceptions) openByType[e.type] += 1

  return {
    universeMaterials: new Set(s.universe.map((u) => u.material.materialId)).size,
    universeRows: s.universe.length,
    totalLines: s.lines.length,
    openLines: open.length,
    overdueLines: open.filter((l) => l.overdueStatus === "OVERDUE").length,
    noDueDateLines: open.filter((l) => l.overdueStatus === "NO_DUE_DATE").length,
    qtyUnderRepair: open.reduce((sum, l) => sum + l.qtyUnderRepair, 0),
    pendingDeclarations:
      open.filter((l) => l.declarationStatus === "Required").length +
      s.lines.filter((l) => l.declarationStatus === "Flagged").length,
    declarationCompliance: ratio(
      postCutoverLines.filter((l) => l.declarationStatus !== "Required").length,
      postCutoverLines.length,
    ),
    sessionCompliance: ratio(
      postCutoverReservations.filter((r) => r.sessionLink === "VALID").length,
      postCutoverReservations.length,
    ),
    justificationCompliance: ratio(
      checkedPurchases.filter((p) => p.justificationId).length,
      checkedPurchases.length,
    ),
    avoided: {
      sessions: chose.length,
      units: chose.reduce((sum, x) => sum + x.quantity, 0),
      value: chose.reduce((sum, x) => sum + x.avoidedValue, 0),
    },
    averageTurnaround:
      turnarounds.length > 0
        ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length)
        : undefined,
    openExceptions: openExceptions.length,
    openByType,
  }
}
