import { describe, expect, it } from "vitest"

import type { RepairChain } from "../types/repair"
import {
  UNKNOWN,
  formatDaysRemaining,
  hasNoDueDate,
  isRepairOverdue,
  orUnknown,
  vendorLabel,
} from "./status"

/**
 * A repair chain with only the fields a test cares about set.
 *
 * Everything here is deliberately the "happy" case, so each test changes one
 * thing and the assertion is about that one thing.
 */
function chain(overrides: Partial<RepairChain> = {}): RepairChain {
  return {
    id: "RC-TEST",
    material: { materialId: "8000005632", materialCode: "8000005632", description: "Motor" },
    plant: { plantId: "1300", name: "Black Mountain" },
    qtyUnderRepair: 1,
    repairPR: { type: "PR", documentNumber: "2000028376" },
    repairStatus: "At Vendor",
    receiptStatus: "Awaiting Receipt",
    declarationStatus: "Required",
    daysOpen: 40,
    agingBucket: "31-45",
    raisedAt: "2026-08-01",
    expectedReturn: "2026-09-30",
    repairCost: 8914.34,
    newUnitLeadTimeDays: 31,
    ...overrides,
  }
}

describe("isRepairOverdue", () => {
  it("is false when the return date has not passed", () => {
    expect(isRepairOverdue(chain({ daysRemainingInRepair: 7 }))).toBe(false)
  })

  it("is true once the return date has passed", () => {
    expect(isRepairOverdue(chain({ daysRemainingInRepair: -12 }))).toBe(true)
  })

  it("is FALSE for a line with no agreed return date", () => {
    // The regression this whole helper exists for.
    //
    // `undefined < 0` is false in JavaScript, so the obvious inline test
    // quietly reports an undated line as on time. It is not on time -- nothing
    // is known about it, and 63 of the 1,225 repair lines in the July extract
    // are in that state. `hasNoDueDate` is what surfaces them.
    const undated = chain({ daysRemainingInRepair: undefined, expectedReturn: undefined })
    expect(isRepairOverdue(undated)).toBe(false)
    expect(hasNoDueDate(undated)).toBe(true)
  })

  it("is false for a repair that already came back, however late it was", () => {
    expect(
      isRepairOverdue(
        chain({ repairStatus: "Closed", daysRemainingInRepair: -300, receivedAt: "2026-08-20" }),
      ),
    ).toBe(false)
  })

  it("prefers the backend's overdueStatus over the date arithmetic", () => {
    // The API is authoritative: it applies the configurable grace period,
    // which the frontend does not know about.
    expect(isRepairOverdue(chain({ overdueStatus: "ON_TIME", daysRemainingInRepair: -3 }))).toBe(
      false,
    )
    expect(isRepairOverdue(chain({ overdueStatus: "OVERDUE", daysRemainingInRepair: 5 }))).toBe(true)
    expect(isRepairOverdue(chain({ overdueStatus: "NO_DUE_DATE" }))).toBe(false)
    expect(isRepairOverdue(chain({ overdueStatus: "RECEIVED" }))).toBe(false)
  })
})

describe("hasNoDueDate", () => {
  it("is false when a date exists", () => {
    expect(hasNoDueDate(chain({ expectedReturn: "2026-09-30" }))).toBe(false)
  })

  it("follows the backend when it says so", () => {
    expect(hasNoDueDate(chain({ overdueStatus: "NO_DUE_DATE" }))).toBe(true)
    expect(hasNoDueDate(chain({ overdueStatus: "ON_TIME", expectedReturn: undefined }))).toBe(false)
  })
})

describe("formatDaysRemaining", () => {
  it("counts down, then counts overdue", () => {
    expect(formatDaysRemaining(chain({ daysRemainingInRepair: 7 }))).toBe("7 days remaining")
    expect(formatDaysRemaining(chain({ daysRemainingInRepair: -12 }))).toBe("12 days overdue")
  })

  it("says so rather than showing a number nobody agreed", () => {
    expect(formatDaysRemaining(chain({ overdueStatus: "NO_DUE_DATE" }))).toBe(
      "No return date agreed",
    )
  })

  it("never renders NaN or a negative zero", () => {
    expect(formatDaysRemaining(chain({ daysRemainingInRepair: 0 }))).toBe("0 days remaining")
  })
})

describe("vendorLabel", () => {
  it("prefers the name, falls back to the code", () => {
    expect(vendorLabel(chain({ vendor: "503036", vendorName: "Wild Bulls Properties CC" }))).toBe(
      "Wild Bulls Properties CC",
    )
    // Only 4 of the 61 repair vendors in the extract resolve to a name.
    expect(vendorLabel(chain({ vendor: "400709" }))).toBe("400709")
  })

  it("names the gap when the PO header is missing", () => {
    // 455 of the 1,225 repair lines. Grouped, never dropped.
    expect(vendorLabel(chain({ vendor: undefined }))).toBe("Unknown vendor")
  })
})

describe("orUnknown", () => {
  it("keeps a real zero distinct from an unknown", () => {
    // The distinction the whole nullable-stock change is about: no stock and
    // no stock record are different answers, and only one of them is zero.
    expect(orUnknown(0)).toBe("0")
    expect(orUnknown(undefined)).toBe(UNKNOWN)
  })
})
