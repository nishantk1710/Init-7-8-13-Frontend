import { describe, expect, it } from "vitest"

import type { UtilisationLedgerEntry } from "@/lib/api/i13"

import {
  coverTone,
  displayTone,
  formatShare,
  idleTone,
  journeySteps,
  journeyStop,
  percentLabel,
  relativeDue,
} from "./oar-display"

describe("coverTone", () => {
  it("is urgent under one month", () => {
    expect(coverTone(0)).toBe("urgent")
    expect(coverTone(0.9)).toBe("urgent")
  })

  it("counts exactly 1 and exactly 6 months as in between", () => {
    expect(coverTone(1)).toBe("caution")
    expect(coverTone(6)).toBe("caution")
  })

  it("is healthy over six months", () => {
    expect(coverTone(6.1)).toBe("healthy")
  })
})

describe("idleTone", () => {
  it("turns red at 150 days", () => {
    expect(idleTone(149)).toBe("caution")
    expect(idleTone(150)).toBe("urgent")
  })
})

describe("displayTone", () => {
  it("maps the status-label tones", () => {
    expect(displayTone("success")).toBe("healthy")
    expect(displayTone("warning")).toBe("caution")
    expect(displayTone("danger")).toBe("urgent")
    expect(displayTone("info")).toBe("primary")
    expect(displayTone("neutral")).toBe("neutral")
  })
})

describe("shares", () => {
  it("never rounds a real share to 0 or 100", () => {
    expect(formatShare(0.4)).toBe("0.4")
    expect(formatShare(99.6)).toBe("99.6")
    expect(formatShare(42.4)).toBe("42")
  })

  it("is 0% of an empty total", () => {
    expect(percentLabel(5, 0)).toBe("0%")
    expect(percentLabel(1, 4)).toBe("25%")
  })
})

describe("relativeDue", () => {
  const now = new Date("2026-10-22T15:00:00Z")

  it("counts whole days ahead", () => {
    expect(relativeDue("2026-10-27T09:00:00Z", now)).toEqual({ label: "in 5 days", overdue: false })
    expect(relativeDue("2026-10-23T01:00:00Z", now)).toEqual({ label: "in 1 day", overdue: false })
  })

  it("says today, and overdue for the past", () => {
    expect(relativeDue("2026-10-22T23:00:00Z", now)).toEqual({ label: "due today", overdue: false })
    expect(relativeDue("2026-10-19T09:00:00Z", now)).toEqual({ label: "3 days overdue", overdue: true })
  })

  it("is null for an unreadable date", () => {
    expect(relativeDue("not a date", now)).toBeNull()
  })
})

const entry: UtilisationLedgerEntry = {
  ledgerId: "L1",
  material: "100",
  plant: "1300",
  reservationNumber: "5001",
  reservationItem: "1",
  prNumber: "1001",
  prItem: "10",
  poNumber: "4501",
  poItem: null,
  receivedQuantity: 2,
  issuedQuantity: null,
  openQuantity: 2,
  orderedQuantity: null,
  firstGrDate: "2026-10-01",
  latestGrDate: "2026-10-05",
  firstGiDate: null,
  latestGiDate: null,
  expectedDeliveryDate: null,
  procurementStatus: "RECEIVED",
  utilisationStatus: "NOT_ISSUED",
  linkageStatus: "FULL_CHAIN",
  dataSource: "SAP",
  attributionStatus: null,
  attributionEvidence: null,
  issueMatch: null,
  deliveryCount: 1,
  nextPlannedIssueDate: null,
  nextPlannedIssueQuantity: null,
}

describe("journeySteps", () => {
  it("reaches each step whose document SAP recorded", () => {
    const steps = journeySteps(entry)
    expect(steps.map((s) => s.reached)).toEqual([true, true, true, true, false])
    expect(steps[0].detail).toBe("Rsnum 5001/1")
    expect(steps[2].detail).toBe("PO 4501")
    expect(steps[3].detail).toBe("First 2026-10-01, latest 2026-10-05")
    expect(steps[4].detail).toBe("Not issued yet")
  })
})

describe("journeyStop", () => {
  it("names the furthest step reached and the next one", () => {
    const stop = journeyStop(journeySteps(entry))
    expect(stop?.after?.label).toBe("Goods receipt")
    expect(stop?.next.label).toBe("Goods issue")
  })

  it("is null once the goods issue is recorded, even with an earlier gap", () => {
    const issued = { ...entry, reservationNumber: null, firstGiDate: "2026-10-09" }
    expect(journeyStop(journeySteps(issued))).toBeNull()
  })

  it("stops before the first step when nothing is linked", () => {
    const bare = { ...entry, reservationNumber: null, prNumber: null, poNumber: null, firstGrDate: null }
    expect(journeyStop(journeySteps(bare))).toEqual({ after: null, next: expect.objectContaining({ key: "reservation" }) })
  })
})
