import type { RepairChain } from "@/features/initiative-8/types/repair"
import {
  JUSTIFICATION_CELL_LABEL,
  LEAD_TIME_VERDICT_LABEL,
  OVERDUE_STATUS_LABEL,
  isPartiallyReceived,
  justificationCellOf,
  overdueStatusOf,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import type { SAPDocumentReference } from "@/lib/domain/contracts"

/**
 * The register's export, as plain functions over `RepairChain[]`, testable
 * without React.
 *
 * The register's filters and search used to live here too, run in the browser
 * over every line. Since 18-Oct-2026 the server runs them (`GET
 * /api/i8/register`) and the screen asks for one page; the export asks for
 * every line the same filters match (`fetchAllRegisterLines`), so the file is
 * still the view it came from.
 */

/** The "no filter" value the I08 dropdowns use. */
export const ALL = "all"

function documentLabel(doc: SAPDocumentReference | undefined): string {
  if (!doc) return ""
  return doc.line ? `${doc.documentNumber}/${doc.line}` : doc.documentNumber
}

/**
 * The export's columns, in the order the screen shows them: what a repair is
 * doing first, the declaration and justification next, then the reference
 * columns (criticality, stock, SAP documents) the screen keeps at the end.
 */
export const REGISTER_CSV_HEADERS = [
  "Line",
  "Material",
  "Description",
  "Plant",
  "Vendor",
  "Qty under repair",
  "Repair status",
  "Days in current stage",
  "Turnaround (days)",
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
  "Exceptions",
  "Criticality",
  "Stock on hand",
  "Reorder point",
  "Repair PR",
  "Repair PO",
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
  return chains.map((c) => {
    const justification = justificationCellOf(c)
    return [
      c.id,
      c.material.materialCode,
      c.material.description,
      `${c.plant.plantId} ${c.plant.name}`,
      vendorLabel(c),
      c.qtyUnderRepair,
      c.repairStatus,
      // Empty, never 0: an open line has no turnaround YET, and a 0 in a
      // spreadsheet cell asserts "came back the same day".
      c.daysInCurrentStage ?? "",
      c.daysAtVendor ?? "",
      isPartiallyReceived(c) ? "Yes" : "No",
      c.poBlocked ? "Yes" : "No",
      c.expectedReturn ?? "",
      OVERDUE_STATUS_LABEL[overdueStatusOf(c)],
      c.daysOpen,
      c.daysElapsed ?? "",
      c.agingBucket,
      // The label the screen shows, not the raw enum -- the same reason the
      // overdue column above exports through OVERDUE_STATUS_LABEL. A line with
      // no benchmark exports as an empty cell rather than "NO_LEAD_TIME", so a
      // spreadsheet filter cannot group it with the verdicts.
      c.leadTimeStatus && c.leadTimeStatus !== "NO_LEAD_TIME"
        ? LEAD_TIME_VERDICT_LABEL[c.leadTimeStatus]
        : "",
      c.leadTimeDays ?? "",
      c.daysOverLeadTime ?? "",
      c.declarationStatus,
      c.declaredBy ?? "",
      c.declaredAt ?? "",
      // Empty, not "—", for a line nothing touched: a dash is screen
      // punctuation, and in a spreadsheet it is a value.
      justification === "NONE" ? "" : JUSTIFICATION_CELL_LABEL[justification],
      // The types raised, not a count: a spreadsheet filter on "2" tells
      // nobody which two checks fired. Empty where the fetch failed, for the
      // same reason an unknown number is never exported as 0.
      c.exceptions ? c.exceptions.map((e) => e.type).join(" ") : "",
      c.criticality ?? "",
      c.stockOnHand ?? "",
      c.reorderPoint ?? "",
      documentLabel(c.repairPR),
      documentLabel(c.repairPO),
      c.raisedAt,
    ]
  })
}
