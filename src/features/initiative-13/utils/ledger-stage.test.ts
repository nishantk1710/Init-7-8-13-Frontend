import { describe, expect, it } from "vitest"

import type { UtilisationLedgerEntry } from "@/lib/api/i13"

import { ledgerStage, ledgerStageLabel } from "./ledger-stage"

function entry(overrides: Partial<UtilisationLedgerEntry> = {}): UtilisationLedgerEntry {
  return {
    ledgerId: "L1",
    material: "8000005632",
    materialDescription: null,
    plant: "1300",
    reservationNumber: null,
    reservationItem: null,
    prNumber: null,
    prItem: null,
    poNumber: null,
    poItem: null,
    receivedQuantity: null,
    issuedQuantity: null,
    openQuantity: null,
    firstGrDate: null,
    latestGrDate: null,
    firstGiDate: null,
    latestGiDate: null,
    procurementStatus: "OPEN",
    utilisationStatus: "NOT_ISSUED",
    linkageStatus: "UNMATCHED",
    dataSource: "",
    attributionStatus: null,
    attributionEvidence: null,
    ...overrides,
  }
}

describe("ledgerStage", () => {
  it("is null when no document is linked", () => {
    expect(ledgerStage(entry())).toBeNull()
    expect(ledgerStageLabel(entry())).toBe("Not linked")
  })

  it("takes the furthest document that exists", () => {
    expect(ledgerStage(entry({ reservationNumber: "R1" }))).toBe("RESERVATION")
    expect(ledgerStage(entry({ reservationNumber: "R1", prNumber: "P1" }))).toBe("PR")
    expect(ledgerStage(entry({ prNumber: "P1", poNumber: "O1" }))).toBe("PO")
  })

  it("reads GR and GI from dates or quantities", () => {
    expect(ledgerStage(entry({ poNumber: "O1", firstGrDate: "2026-09-01" }))).toBe("GR")
    expect(ledgerStage(entry({ poNumber: "O1", receivedQuantity: 2 }))).toBe("GR")
    expect(ledgerStage(entry({ receivedQuantity: 2, issuedQuantity: 1 }))).toBe("GI")
  })

  it("does not count a zero quantity as a receipt", () => {
    expect(ledgerStage(entry({ poNumber: "O1", receivedQuantity: 0 }))).toBe("PO")
  })

  it("says when only part of the quantity was issued", () => {
    const partly = entry({ firstGiDate: "2026-09-10", utilisationStatus: "PARTIALLY_ISSUED" })
    expect(ledgerStageLabel(partly)).toBe("Partly issued")
    expect(ledgerStageLabel({ ...partly, utilisationStatus: "FULLY_ISSUED" })).toBe("Goods issued")
  })
})
