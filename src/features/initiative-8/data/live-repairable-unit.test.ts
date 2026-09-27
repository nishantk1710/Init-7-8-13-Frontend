import { describe, expect, it } from "vitest"

import {
  repairableUnitVerdict,
  toRepairableUnit,
} from "@/features/initiative-8/data/live-repairable-unit"
import type { ApiRepairableUnit } from "@/lib/api/i8"

/**
 * The Duplicate Guard's adapter (FR-6).
 *
 * The answers below are the three the live backend gives for the materials the
 * page offers as examples, trimmed. The tests are about keeping "unknown"
 * unknown and never softening a "yes".
 */

/** 8000004665 @ 1300 — one open repair, already past its promised date. */
function openRepair(overrides: Partial<ApiRepairableUnit> = {}): ApiRepairableUnit {
  return {
    materialId: "8000004665",
    plant: "1300",
    isRepairableMaterial: true,
    exists: true,
    sources: ["ON_REPAIR_ORDER"],
    stockOnHand: "0",
    stockIsUnknown: false,
    stockLocations: 3,
    openRepairLines: 1,
    quantityUnderRepair: "1",
    soonestDueDate: "2025-04-24",
    overdueLines: 1,
    headline:
      "There is 1 open repair for 1 unit, the earliest due back 2025-04-24 (1 of them already past the promised date).",
    caveats: [
      "A repair being open means the purchase order exists, not that the unit has physically reached the vendor -- no dispatch movement is recorded against it.",
    ],
    evidence: [
      {
        purchasingDocument: "4500001052",
        item: "1310",
        quantity: "1",
        raisedAt: "2025-04-07",
        dueDate: "2025-04-24",
        daysOverdue: 518,
        vendor: null,
        vendorName: null,
        status: "PO Issued",
        dispatched: false,
      },
    ],
    referenceDate: "2026-09-24",
    ...overrides,
  }
}

describe("toRepairableUnit", () => {
  it("passes the backend's headline and caveats through untouched", () => {
    const answer = toRepairableUnit(openRepair())
    expect(answer.headline).toContain("1 open repair")
    expect(answer.caveats).toHaveLength(1)
  })

  it("labels the sources for display", () => {
    expect(toRepairableUnit(openRepair({ sources: ["STOCK", "ON_REPAIR_ORDER"] })).sources).toEqual([
      "In stock",
      "On repair order",
    ])
  })

  it("keeps a source it does not recognise rather than dropping it", () => {
    const body = openRepair({ sources: ["IN_TRANSIT" as "STOCK"] })
    expect(toRepairableUnit(body).sources).toEqual(["IN_TRANSIT"])
  })

  it("treats stock with no record as unknown, never zero", () => {
    // Zero stock is what talks somebody into a duplicate purchase.
    const answer = toRepairableUnit(openRepair({ stockOnHand: null, stockIsUnknown: true }))
    expect(answer.stockOnHand).toBeUndefined()
  })

  it("lets stockIsUnknown win even if a number came with it", () => {
    const answer = toRepairableUnit(openRepair({ stockOnHand: "0", stockIsUnknown: true }))
    expect(answer.stockOnHand).toBeUndefined()
  })

  it("parses a real zero as zero", () => {
    expect(toRepairableUnit(openRepair()).stockOnHand).toBe(0)
  })

  it("adapts each open repair line, with a register link and an honest vendor", () => {
    const [line] = toRepairableUnit(openRepair()).evidence
    expect(line.id).toBe("4500001052-1310")
    expect(line.repairPO).toEqual({ type: "PO", documentNumber: "4500001052", line: "1310" })
    expect(line.quantity).toBe(1)
    expect(line.daysOverdue).toBe(518)
    expect(line.vendor).toBe("Unknown vendor")
    expect(line.dueDate).not.toContain("-")
  })

  it("invents no due date for a line that never had one", () => {
    const body = openRepair({
      soonestDueDate: null,
      evidence: [{ ...openRepair().evidence[0], dueDate: null, daysOverdue: null }],
    })
    const answer = toRepairableUnit(body)
    expect(answer.soonestDueDate).toBeUndefined()
    expect(answer.evidence[0].dueDate).toBeUndefined()
    expect(answer.evidence[0].daysOverdue).toBeUndefined()
  })
})

describe("repairableUnitVerdict", () => {
  it("warns when a unit already exists — the duplicate this screen catches", () => {
    expect(repairableUnitVerdict(toRepairableUnit(openRepair()))).toEqual({
      tone: "warning",
      title: "A repairable unit already exists",
    })
  })

  it("informs when nothing exists", () => {
    // 8000000000 @ 1300: none in stock and no repair on order.
    const answer = toRepairableUnit(
      openRepair({ exists: false, sources: [], openRepairLines: 0, evidence: [], caveats: [] }),
    )
    expect(repairableUnitVerdict(answer).tone).toBe("info")
    expect(repairableUnitVerdict(answer).title).toBe("No repairable unit found")
  })

  it("says so plainly for a material outside the 80-series", () => {
    const answer = toRepairableUnit(
      openRepair({ materialId: "12345", isRepairableMaterial: false, exists: false, sources: [] }),
    )
    expect(repairableUnitVerdict(answer).title).toBe("Not a repairable material")
  })
})
