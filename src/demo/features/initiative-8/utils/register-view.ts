import { documentLabel } from "@demo/features/initiative-8/model/snapshot"
import type { RepairChain } from "@demo/features/initiative-8/types/repair"
import {
  JUSTIFICATION_CELL_LABEL,
  LEAD_TIME_VERDICT_LABEL,
  NO_CRITICALITY,
  OVERDUE_STATUS_LABEL,
  STAGE_LABEL,
  isPartiallyReceived,
  justificationCellOf,
  overdueStatusOf,
} from "@demo/features/initiative-8/utils/status"

/** The "no filter" value every register dropdown uses. */
export const ALL = "all"

/** The Exceptions filter's one narrowing choice: lines with an open exception. */
export const OPEN_EXCEPTIONS = "open"

export type RegisterFilters = {
  plant: string
  vendor: string
  repairStatus: string
  /** An `OverdueStatus`, or `ALL`. */
  overdue: string
  /** A criticality rating, `NO_CRITICALITY` for unrated lines, or `ALL`. */
  criticality: string
  declarationStatus: string
  aging: string
  /**
   * `OPEN_EXCEPTIONS` keeps only lines with an Open or In-progress exception
   * on the queue (FR-8 / FR-9) — the "what needs chasing" view. `ALL` is any.
   */
  exceptions: string
}

export const NO_REGISTER_FILTERS: RegisterFilters = {
  plant: ALL,
  vendor: ALL,
  repairStatus: ALL,
  overdue: ALL,
  criticality: ALL,
  declarationStatus: ALL,
  aging: ALL,
  exceptions: ALL,
}

export function filterRegister(chains: RepairChain[], filters: RegisterFilters): RepairChain[] {
  return chains.filter((c) => {
    if (filters.plant !== ALL && c.plant.plantId !== filters.plant) return false
    if (filters.vendor !== ALL && c.vendor !== filters.vendor) return false
    if (filters.repairStatus !== ALL && c.repairStatus !== filters.repairStatus) return false
    if (filters.overdue !== ALL && overdueStatusOf(c) !== filters.overdue) return false
    if (filters.criticality !== ALL && (c.criticality ?? NO_CRITICALITY) !== filters.criticality) {
      return false
    }
    if (filters.declarationStatus !== ALL && c.declarationStatus !== filters.declarationStatus) {
      return false
    }
    if (filters.aging !== ALL && c.agingBucket !== filters.aging) return false
    if (filters.exceptions === OPEN_EXCEPTIONS && c.openExceptionIds.length === 0) return false
    return true
  })
}

/**
 * The export's columns, in the order the screen shows them, with the dates and
 * links the screen keeps on the detail page added at the end — so the file
 * carries every stage of FR-3, the stage aging of FR-9 and the trace of FR-8
 * without anyone having to open each repair.
 */
export const REGISTER_CSV_HEADERS = [
  "Line",
  "Material",
  "Description",
  "Plant",
  "Vendor",
  "Qty under repair",
  "Qty sent",
  "Repair status",
  "Partially received",
  "Blocked in SAP",
  "Stage",
  "In stage since",
  "Days in stage",
  "Stage aging band",
  "Expected return",
  "Overdue status",
  "Days past due",
  "In grace",
  "Days open",
  "Days elapsed",
  "Aging band",
  "Turnaround (days)",
  "Lead-time status",
  "Planned lead time (days)",
  "Days over lead time",
  "Declaration status",
  "Declared by",
  "Declared at",
  "Justification",
  "Session",
  "Reservation",
  "Open exceptions",
  "Criticality",
  "Stock on hand",
  "Reorder point",
  "Repair PR",
  "Repair PO",
  "Removed",
  "Raised",
  "Received",
  "Back in stock",
  "Scrapped",
]

/** One CSV row per chain handed in — already filtered, so the file is the view. */
export function registerRowsToCsv(chains: RepairChain[]): (string | number)[][] {
  return chains.map((c) => {
    const justification = justificationCellOf(c)
    return [
      c.id,
      c.material.materialCode,
      c.material.description,
      `${c.plant.plantId} ${c.plant.name}`,
      c.vendor,
      c.qtyUnderRepair,
      c.quantity,
      c.repairStatus,
      isPartiallyReceived(c) ? "Yes" : "No",
      c.poBlocked ? "Yes" : "No",
      STAGE_LABEL[c.stage],
      c.stageEnteredAt,
      c.daysInStage,
      c.stageAgingBucket,
      c.expectedReturn ?? "",
      OVERDUE_STATUS_LABEL[overdueStatusOf(c)],
      // Only once the date has passed; a negative here would read as a typo.
      c.daysPastDue !== undefined && c.daysPastDue > 0 ? c.daysPastDue : "",
      c.inGrace ? "Yes" : "No",
      c.daysOpen,
      c.daysElapsed ?? "",
      c.agingBucket,
      c.turnaroundDays ?? "",
      c.leadTimeStatus && c.leadTimeStatus !== "NO_LEAD_TIME"
        ? LEAD_TIME_VERDICT_LABEL[c.leadTimeStatus]
        : "",
      c.leadTimeDays ?? "",
      c.daysOverLeadTime ?? "",
      c.declarationStatus,
      c.declaredBy ?? "",
      c.declaredAt ?? "",
      justification === "NONE" ? "" : JUSTIFICATION_CELL_LABEL[justification],
      c.sessionId ?? "",
      documentLabel(c.reservation),
      c.openExceptionIds.join("; "),
      c.criticality ?? "",
      c.stockOnHand ?? "",
      c.reorderPoint ?? "",
      documentLabel(c.repairPR),
      documentLabel(c.repairPO),
      c.removedAt ?? "",
      c.raisedAt,
      c.receivedAt ?? "",
      c.backInStockAt ?? "",
      c.scrappedAt ?? "",
    ]
  })
}
