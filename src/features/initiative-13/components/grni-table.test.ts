// 30-Day GR-Not-Issued shows only what SAP records against a PO line (UAT,
// 23-Nov-2026): the goods receipt. SAP posts a goods issue against the material
// and reservation, never the PO, so no issued quantity or estimate is shown.

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { GrniTable } from "@/features/initiative-13/components/grni-table"
import type { GrniEntry } from "@/lib/api/i13"

const line: GrniEntry = {
  ledgerId: "L1",
  material: "5000014659",
  materialDescription: "ANGLE STEEL 50 X 50 X 6 6 M",
  plant: "1300",
  materialScope: "OAR",
  prNumber: null,
  prItem: null,
  poNumber: "4500012345",
  poItem: "10",
  reservationNumber: null,
  reservationItem: null,
  receivedQuantity: 10,
  issuedQuantity: 4,
  outstandingQuantity: 6,
  deliveryCount: 2,
  firstGrDate: "2026-09-01",
  lastGrDate: "2026-10-01",
  daysSinceGr: 53,
  thresholdDays: 30,
  firstIssueDate: "2026-10-05",
  lastIssueDate: "2026-10-20",
  issueMatch: "OLDEST_DELIVERY_FIRST",
  nextPlannedIssueDate: "2026-12-01",
  nextPlannedIssueQuantity: 3,
  utilisationStatus: "PARTIALLY_ISSUED",
}

function render(rows: GrniEntry[]): string {
  return renderToStaticMarkup(createElement(GrniTable, { rows }))
}

describe("GrniTable", () => {
  it("shows the PO line's goods receipt and nothing about issues", () => {
    const html = render([line])
    for (const heading of [">Material<", ">Plant<", ">PO<", ">GR date<", ">Received qty<", ">Days since GR<"]) {
      expect(html).toContain(heading)
    }
    for (const gone of [">Issued<", ">In stock<", ">Issued on<", ">Next planned issue<", ">How matched<", "Estimated"]) {
      expect(html).not.toContain(gone)
    }
    expect(html).toContain("latest of 2 deliveries")
    expect(html).toContain("53 days")
  })

  it("says plainly when nothing is listed", () => {
    expect(render([])).toContain("Nothing has been sitting unissued past the threshold.")
  })
})
