import type { RepairChain } from "@demo/features/initiative-8/types/repair"
import {
  JUSTIFICATION_CELL_LABEL,
  LEAD_TIME_VERDICT_LABEL,
  NO_CRITICALITY,
  OVERDUE_STATUS_LABEL,
  isPartiallyReceived,
  justificationCellOf,
  overdueStatusOf,
} from "@demo/features/initiative-8/utils/status"
import type { SAPDocumentReference } from "@demo/lib/domain/contracts"

/** The "no filter" value every register dropdown uses. */
export const ALL = "all"

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
}

export const NO_REGISTER_FILTERS: RegisterFilters = {
  plant: ALL,
  vendor: ALL,
  repairStatus: ALL,
  overdue: ALL,
  criticality: ALL,
  declarationStatus: ALL,
  aging: ALL,
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
    return true
  })
}

function documentLabel(doc: SAPDocumentReference | undefined): string {
  if (!doc) return ""
  return doc.line ? `${doc.documentNumber}/${doc.line}` : doc.documentNumber
}

/** The export's columns, in the order the screen shows them. Same as live. */
export const REGISTER_CSV_HEADERS = [
  "Line",
  "Material",
  "Description",
  "Plant",
  "Vendor",
  "Qty under repair",
  "Repair status",
  "Partially received",
  "Blocked in SAP",
  "Expected return",
  "Overdue status",
  "Days open",
  "Days elapsed",
  "Aging band",
  "Lead-time status",
  "Planned lead time (days)",
  "Days over lead time",
  "Declaration status",
  "Declared by",
  "Declared at",
  "Justification",
  "Criticality",
  "Stock on hand",
  "Reorder point",
  "Repair PR",
  "Repair PO",
  "Raised",
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
      c.repairStatus,
      isPartiallyReceived(c) ? "Yes" : "No",
      c.poBlocked ? "Yes" : "No",
      c.expectedReturn,
      OVERDUE_STATUS_LABEL[overdueStatusOf(c)],
      c.daysOpen,
      c.daysElapsed ?? "",
      c.agingBucket,
      c.leadTimeStatus && c.leadTimeStatus !== "NO_LEAD_TIME"
        ? LEAD_TIME_VERDICT_LABEL[c.leadTimeStatus]
        : "",
      c.leadTimeDays ?? "",
      c.daysOverLeadTime ?? "",
      c.declarationStatus,
      c.declaredBy ?? "",
      c.declaredAt ?? "",
      justification === "NONE" ? "" : JUSTIFICATION_CELL_LABEL[justification],
      c.criticality ?? "",
      c.stockOnHand,
      c.reorderPoint,
      documentLabel(c.repairPR),
      documentLabel(c.repairPO),
      c.raisedAt,
    ]
  })
}
