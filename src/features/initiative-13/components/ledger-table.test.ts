// Procurement lines show only what SAP recorded (5-Nov-2026): a line a
// reservation raised keeps its goods issue; a stock refill (NOT_TRACKED) ends
// at goods receipt, with no estimated issue and no "Estimated" tag.

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { UtilizationLedgerTable } from "@/features/initiative-13/components/ledger-table"
import type { UtilisationLedgerEntry } from "@/lib/api/i13"

const raised: UtilisationLedgerEntry = {
  ledgerId: "L1",
  material: "100",
  plant: "1300",
  reservationNumber: "5001",
  reservationItem: "1",
  prNumber: "1001",
  prItem: "10",
  poNumber: "4501",
  poItem: "10",
  receivedQuantity: 5,
  issuedQuantity: 3,
  openQuantity: 2,
  orderedQuantity: 5,
  firstGrDate: "2026-10-01",
  latestGrDate: "2026-10-01",
  firstGiDate: "2026-10-09",
  latestGiDate: "2026-10-09",
  expectedDeliveryDate: null,
  procurementStatus: "RECEIVED",
  utilisationStatus: "PARTIALLY_ISSUED",
  linkageStatus: "RESERVATION_LINKED",
  dataSource: "SAP",
  attributionStatus: null,
  attributionEvidence: null,
  issueMatch: "RESERVATION",
  deliveryCount: 1,
  nextPlannedIssueDate: null,
  nextPlannedIssueQuantity: null,
}

const refill: UtilisationLedgerEntry = {
  ...raised,
  ledgerId: "L2",
  reservationNumber: null,
  reservationItem: null,
  prNumber: "1002",
  poNumber: "4502",
  issuedQuantity: 0,
  openQuantity: 5,
  firstGiDate: null,
  latestGiDate: null,
  utilisationStatus: "NOT_TRACKED",
  linkageStatus: "FULL_CHAIN",
  issueMatch: "OLDEST_DELIVERY_FIRST",
}

function render(entries: UtilisationLedgerEntry[]): string {
  return renderToStaticMarkup(createElement(UtilizationLedgerTable, { entries }))
}

describe("UtilizationLedgerTable", () => {
  it("shows a reservation-raised line's goods issue and its reservation", () => {
    const html = render([raised])
    expect(html).toContain("Partially issued")
    expect(html).toContain("Matched to reservation 5001/1")
    expect(html).not.toContain("Not tracked")
  })

  it("ends a stock refill at goods receipt, with no estimate", () => {
    const html = render([refill])
    expect(html).toContain("Stock refill")
    expect(html).toContain(">Not tracked</td>")
    expect(html).not.toContain("Estimated")
    // The journey (and its "Not tracked per delivery" step) renders on expand: oar-display.test.ts.
  })
})
