import type { RepairChain } from "@/features/initiative-8/types/repair"
import {
  NO_CRITICALITY,
  OVERDUE_STATUS_LABEL,
  overdueStatusOf,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import type { SAPDocumentReference } from "@/lib/domain/contracts"

/**
 * The register's filtering and export, as plain functions over `RepairChain[]`.
 *
 * Pulled out of the table component so the rules are testable without React,
 * and so the CSV and the screen can never disagree about which rows a filter
 * matches: the export is built from exactly the array the table renders.
 */

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

/** The rows matching every active filter. Client side, over the full register. */
export function filterRegister(chains: RepairChain[], filters: RegisterFilters): RepairChain[] {
  return chains.filter((c) => {
    if (filters.plant !== ALL && c.plant.plantId !== filters.plant) return false
    if (filters.vendor !== ALL && vendorLabel(c) !== filters.vendor) return false
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

export const REGISTER_CSV_HEADERS = [
  "Line",
  "Material",
  "Description",
  "Plant",
  "Criticality",
  "Stock on hand",
  "Reorder point",
  "Repair PR",
  "Repair PO",
  "Blocked in SAP",
  "Vendor",
  "Qty under repair",
  "Repair status",
  "Receipt status",
  "Overdue status",
  "Expected return",
  "Days open",
  "Aging band",
  "Lead-time status",
  "Planned lead time (days)",
  "Days over lead time",
  "Declaration status",
  "Raised",
]

/**
 * One CSV row per chain handed in — already filtered by the caller, so the file
 * is the view it came from and not the whole register.
 *
 * Unknown values are empty cells, never 0: a CSV cell is read without the
 * column's caveats beside it, and an exported 0 asserts "none" where the
 * source only said "not recorded".
 */
export function registerRowsToCsv(chains: RepairChain[]): (string | number)[][] {
  return chains.map((c) => [
    c.id,
    c.material.materialCode,
    c.material.description,
    `${c.plant.plantId} ${c.plant.name}`,
    c.criticality ?? "",
    c.stockOnHand ?? "",
    c.reorderPoint ?? "",
    documentLabel(c.repairPR),
    documentLabel(c.repairPO),
    c.poBlocked ? "Yes" : "No",
    vendorLabel(c),
    c.qtyUnderRepair,
    c.repairStatus,
    c.receiptStatus,
    OVERDUE_STATUS_LABEL[overdueStatusOf(c)],
    c.expectedReturn ?? "",
    c.daysOpen,
    c.agingBucket,
    c.leadTimeStatus ?? "",
    c.leadTimeDays ?? "",
    c.daysOverLeadTime ?? "",
    c.declarationStatus,
    c.raisedAt,
  ])
}
